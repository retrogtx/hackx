import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type User = Awaited<ReturnType<typeof requireUser>>;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: User;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const plugin = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
      with: { documents: true, decisionTrees: true },
    });
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }
    return NextResponse.json(plugin);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: User;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    });
    if (!existing) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const allowedCitationModes = ["mandatory", "optional", "none", "off"];
    const rawCitationMode = body.citationMode ?? existing.citationMode;
    if (!allowedCitationModes.includes(rawCitationMode)) {
      return NextResponse.json(
        { error: `Invalid citationMode. Allowed: ${allowedCitationModes.join(", ")}` },
        { status: 400 },
      );
    }
    // Normalize "off" to "none" for DB storage
    const citationMode = rawCitationMode === "off" ? "none" : rawCitationMode;

    const [updated] = await db
      .update(plugins)
      .set({
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        domain: body.domain ?? existing.domain,
        systemPrompt: body.systemPrompt ?? existing.systemPrompt,
        citationMode,
        isPublished: body.isPublished ?? existing.isPublished,
        updatedAt: new Date(),
      })
      .where(eq(plugins.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: User;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    });
    if (!existing) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    await db.delete(plugins).where(eq(plugins.id, id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
