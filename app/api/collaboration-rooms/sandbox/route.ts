import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { collaborationRooms, collaborationSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { streamCollaboration } from "@/lib/engine/collaboration";
import type { CollaborationMode } from "@/lib/engine/collaboration";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { roomId, query } = body;

    if (!roomId || !query) {
      return NextResponse.json({ error: "Missing roomId or query" }, { status: 400 });
    }

    const room = await db.query.collaborationRooms.findFirst({
      where: and(
        eq(collaborationRooms.id, roomId),
        eq(collaborationRooms.creatorId, user.id),
      ),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const [session] = await db
      .insert(collaborationSessions)
      .values({
        roomId: room.id,
        queryText: query,
        status: "deliberating",
      })
      .returning();

    const stream = await streamCollaboration({
      expertSlugs: room.expertSlugs,
      query,
      mode: room.mode as CollaborationMode,
      maxRounds: room.maxRounds,
      skipPublishCheck: true,
    });

    const encoder = new TextEncoder();
    const transformedStream = new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let lastEventData: Record<string, unknown> | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            controller.enqueue(value);

            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  lastEventData = JSON.parse(line.slice(6));
                } catch { /* skip */ }
              }
            }
          }

          if (lastEventData && (lastEventData as { type: string }).type === "done") {
            await db
              .update(collaborationSessions)
              .set({
                status: "complete",
                rounds: (lastEventData as { rounds: unknown }).rounds as typeof collaborationSessions.$inferSelect.rounds,
                consensus: (lastEventData as { consensus: unknown }).consensus as typeof collaborationSessions.$inferSelect.consensus,
                latencyMs: (lastEventData as { latencyMs: number }).latencyMs,
              })
              .where(eq(collaborationSessions.id, session.id));
          }
        } catch {
          await db
            .update(collaborationSessions)
            .set({ status: "error" })
            .where(eq(collaborationSessions.id, session.id));

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Stream error" })}\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(transformedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
