import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

function normalizeConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }
  return { ...(config as Record<string, unknown>) };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();

    const existing = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    });
    if (!existing) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const baseConfig = normalizeConfig(existing.config);
    const nextConfig =
      typeof body.marketplaceShared === "boolean"
        ? {
            ...baseConfig,
            marketplaceShared: body.marketplaceShared,
          }
        : baseConfig;

    const [updated] = await db
      .update(plugins)
      .set({
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        domain: body.domain ?? existing.domain,
        systemPrompt: body.systemPrompt ?? existing.systemPrompt,
        citationMode: body.citationMode ?? existing.citationMode,
        isPublished: body.isPublished ?? existing.isPublished,
        config: nextConfig,
        updatedAt: new Date(),
      })
      .where(eq(plugins.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
