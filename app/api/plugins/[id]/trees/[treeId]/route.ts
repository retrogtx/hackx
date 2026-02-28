import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins, decisionTrees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function verifyPluginOwnership(pluginId: string, userId: string) {
  const plugin = await db.query.plugins.findFirst({
    where: and(eq(plugins.id, pluginId), eq(plugins.creatorId, userId)),
  });
  return plugin;
}

function handleError(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; treeId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, treeId } = await params;

    const plugin = await verifyPluginOwnership(id, user.id);
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const tree = await db.query.decisionTrees.findFirst({
      where: and(
        eq(decisionTrees.id, treeId),
        eq(decisionTrees.pluginId, id),
      ),
    });

    if (!tree) {
      return NextResponse.json({ error: "Tree not found" }, { status: 404 });
    }

    return NextResponse.json(tree);
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; treeId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, treeId } = await params;

    const plugin = await verifyPluginOwnership(id, user.id);
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const existing = await db.query.decisionTrees.findFirst({
      where: and(
        eq(decisionTrees.id, treeId),
        eq(decisionTrees.pluginId, id),
      ),
    });
    if (!existing) {
      return NextResponse.json({ error: "Tree not found" }, { status: 404 });
    }

    const body = await req.json();

    const [updated] = await db
      .update(decisionTrees)
      .set({
        name: body.name ?? existing.name,
        description: body.description ?? existing.description,
        treeData: body.treeData ?? existing.treeData,
        isActive: body.isActive ?? existing.isActive,
      })
      .where(eq(decisionTrees.id, treeId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; treeId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, treeId } = await params;

    const plugin = await verifyPluginOwnership(id, user.id);
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const existing = await db.query.decisionTrees.findFirst({
      where: and(
        eq(decisionTrees.id, treeId),
        eq(decisionTrees.pluginId, id),
      ),
    });
    if (!existing) {
      return NextResponse.json({ error: "Tree not found" }, { status: 404 });
    }

    await db.delete(decisionTrees).where(eq(decisionTrees.id, treeId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
