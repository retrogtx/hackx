import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { collaborationRooms, collaborationSessions, plugins } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const room = await db.query.collaborationRooms.findFirst({
      where: and(eq(collaborationRooms.id, id), eq(collaborationRooms.creatorId, user.id)),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const sessions = await db.query.collaborationSessions.findMany({
      where: eq(collaborationSessions.roomId, room.id),
      orderBy: desc(collaborationSessions.createdAt),
    });

    const expertDetails = await Promise.all(
      room.expertSlugs.map(async (slug) => {
        const plugin = await db.query.plugins.findFirst({
          where: eq(plugins.slug, slug),
        });
        return plugin
          ? { slug: plugin.slug, name: plugin.name, domain: plugin.domain }
          : { slug, name: slug, domain: "unknown" };
      }),
    );

    return NextResponse.json({ ...room, expertDetails, sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const room = await db.query.collaborationRooms.findFirst({
      where: and(eq(collaborationRooms.id, id), eq(collaborationRooms.creatorId, user.id)),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    await db.delete(collaborationRooms).where(eq(collaborationRooms.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
