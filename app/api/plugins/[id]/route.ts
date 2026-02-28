import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const plugin = await db.query.plugins.findFirst({
    where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    with: { documents: true, decisionTrees: true },
  });
  if (!plugin) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }
  return NextResponse.json(plugin);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const existing = await db.query.plugins.findFirst({
    where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }

  const allowedCitationModes = ["mandatory", "optional", "none"];
  const citationMode = body.citationMode ?? existing.citationMode;
  if (!allowedCitationModes.includes(citationMode)) {
    return NextResponse.json(
      { error: `Invalid citationMode. Allowed: ${allowedCitationModes.join(", ")}` },
      { status: 400 },
    );
  }

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
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await db.query.plugins.findFirst({
    where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
  }

  await db.delete(plugins).where(eq(plugins.id, id));
  return NextResponse.json({ success: true });
}
