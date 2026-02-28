import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { collaborationRooms, collaborationSessions, plugins } from "@/lib/db/schema";
import { eq, and, or, desc } from "drizzle-orm";

export async function GET() {
  try {
    const user = await requireUser();
    const rooms = await db.query.collaborationRooms.findMany({
      where: eq(collaborationRooms.creatorId, user.id),
      orderBy: desc(collaborationRooms.updatedAt),
    });

    const roomsWithStats = await Promise.all(
      rooms.map(async (room) => {
        const sessions = await db.query.collaborationSessions.findMany({
          where: eq(collaborationSessions.roomId, room.id),
        });

        const expertNames: string[] = [];
        for (const slug of room.expertSlugs) {
          const plugin = await db.query.plugins.findFirst({
            where: eq(plugins.slug, slug),
          });
          if (plugin) expertNames.push(plugin.name);
        }

        return {
          ...room,
          sessionCount: sessions.length,
          expertNames,
        };
      }),
    );

    return NextResponse.json(roomsWithStats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { name, mode = "debate", expertSlugs, maxRounds = 3 } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 });
    }
    if (!Array.isArray(expertSlugs) || expertSlugs.length < 2) {
      return NextResponse.json({ error: "At least 2 expert plugins required" }, { status: 400 });
    }
    if (expertSlugs.length > 5) {
      return NextResponse.json({ error: "Maximum 5 experts per room" }, { status: 400 });
    }

    for (const slug of expertSlugs) {
      const plugin = await db.query.plugins.findFirst({
        where: and(
          eq(plugins.slug, slug),
          or(eq(plugins.isPublished, true), eq(plugins.creatorId, user.id)),
        ),
      });
      if (!plugin) {
        return NextResponse.json(
          { error: `Plugin not found or access denied: ${slug}` },
          { status: 404 },
        );
      }
    }

    const [room] = await db
      .insert(collaborationRooms)
      .values({
        creatorId: user.id,
        name: name.trim(),
        mode,
        expertSlugs,
        maxRounds: Math.min(Number(maxRounds) || 3, 3),
      })
      .returning();

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
