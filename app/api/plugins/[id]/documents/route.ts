import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins, knowledgeDocuments, knowledgeChunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { chunkText } from "@/lib/engine/chunker";
import { embedTexts } from "@/lib/engine/embedding";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/pdf",
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Verify ownership
    const plugin = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    });
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const docs = await db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.pluginId, id));

    return NextResponse.json(docs);
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

    // Verify ownership
    const plugin = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    });
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;
    const fileName = formData.get("fileName") as string || file?.name || "untitled";
    const fileType = formData.get("fileType") as string || "markdown";

    let rawText = text || "";

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 },
        );
      }

      if (file.type && !ALLOWED_FILE_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Allowed: .txt, .md, .csv, .json, .pdf` },
          { status: 400 },
        );
      }

      rawText = await file.text();
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "No content provided" },
        { status: 400 },
      );
    }

    // 1. Create document record
    const [doc] = await db
      .insert(knowledgeDocuments)
      .values({
        pluginId: id,
        fileName,
        fileType,
        rawText,
      })
      .returning();

    // 2. Chunk the text
    const chunks = chunkText(rawText, { fileName, fileType });

    // 3. Embed all chunks
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await embedTexts(chunkTexts);

    // 4. Insert chunks with embeddings
    if (chunks.length > 0) {
      await db.insert(knowledgeChunks).values(
        chunks.map((chunk, i) => ({
          documentId: doc.id,
          pluginId: id,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber ?? null,
          sectionTitle: chunk.sectionTitle ?? null,
          embedding: embeddings[i],
          metadata: chunk.metadata,
        })),
      );
    }

    return NextResponse.json({
      ...doc,
      chunksCreated: chunks.length,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }

    const plugin = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    });
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    await db
      .delete(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.id, docId),
          eq(knowledgeDocuments.pluginId, id),
        ),
      );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
