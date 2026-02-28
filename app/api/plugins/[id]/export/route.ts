import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

function safeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase();
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

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      plugin: {
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        description: plugin.description,
        domain: plugin.domain,
        systemPrompt: plugin.systemPrompt,
        citationMode: plugin.citationMode,
        isPublished: plugin.isPublished,
        config: plugin.config ?? {},
        createdAt: plugin.createdAt.toISOString(),
        updatedAt: plugin.updatedAt.toISOString(),
      },
      documents: plugin.documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        rawText: doc.rawText,
        metadata: doc.metadata ?? {},
        createdAt: doc.createdAt.toISOString(),
      })),
      decisionTrees: plugin.decisionTrees.map((tree) => ({
        id: tree.id,
        name: tree.name,
        description: tree.description,
        treeData: tree.treeData,
        isActive: tree.isActive,
        createdAt: tree.createdAt.toISOString(),
      })),
    };

    const body = JSON.stringify(payload, null, 2);
    const fileName = safeFileName(plugin.slug || plugin.name || "plugin-export");

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}.json"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
