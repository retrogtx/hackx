import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins, decisionTrees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const plugin = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    });
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const trees = await db
      .select()
      .from(decisionTrees)
      .where(eq(decisionTrees.pluginId, id));

    return NextResponse.json(trees);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const plugin = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    });
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, description, treeData } = body;

    if (!name || !treeData) {
      return NextResponse.json(
        { error: "Missing required fields: name, treeData" },
        { status: 400 },
      );
    }

    // Validate treeData structure
    if (
      typeof treeData !== "object" ||
      typeof treeData.rootNodeId !== "string" ||
      typeof treeData.nodes !== "object" ||
      treeData.nodes === null ||
      !treeData.nodes[treeData.rootNodeId]
    ) {
      return NextResponse.json(
        { error: "Invalid treeData: must have rootNodeId (string) and nodes (object) with the root node present" },
        { status: 400 },
      );
    }

    // Validate each node has required fields
    for (const [nodeId, node] of Object.entries(treeData.nodes)) {
      const n = node as Record<string, unknown>;
      if (!n.id || !n.type || !n.label) {
        return NextResponse.json(
          { error: `Invalid node "${nodeId}": must have id, type, and label` },
          { status: 400 },
        );
      }
      if (!["condition", "action", "question"].includes(n.type as string)) {
        return NextResponse.json(
          { error: `Invalid node "${nodeId}": type must be "condition", "action", or "question"` },
          { status: 400 },
        );
      }
    }

    const [tree] = await db
      .insert(decisionTrees)
      .values({
        pluginId: id,
        name,
        description: description || null,
        treeData,
      })
      .returning();

    return NextResponse.json(tree, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
