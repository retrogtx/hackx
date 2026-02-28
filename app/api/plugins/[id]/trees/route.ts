import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins, decisionTrees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

function handleError(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
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
    });
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const trees = await db
      .select()
      .from(decisionTrees)
      .where(eq(decisionTrees.pluginId, id));

    return NextResponse.json(trees);
  } catch (error) {
    return handleError(error);
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
    return handleError(error);
  }
}
