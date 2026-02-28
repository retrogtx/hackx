import { db } from "@/lib/db";
import { knowledgeChunks, knowledgeDocuments } from "@/lib/db/schema";
import { sql, eq, and, gt } from "drizzle-orm";
import { embedText } from "./embedding";

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  chunkIndex: number;
}

export async function retrieveSources(
  query: string,
  pluginId: string,
  topK: number = 8,
  threshold: number = 0.4,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(query);

  const results = await db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
      similarity: sql<number>`1 - (${knowledgeChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
      documentId: knowledgeChunks.documentId,
      documentName: knowledgeDocuments.fileName,
      pageNumber: knowledgeChunks.pageNumber,
      sectionTitle: knowledgeChunks.sectionTitle,
      chunkIndex: knowledgeChunks.chunkIndex,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(
      and(
        eq(knowledgeChunks.pluginId, pluginId),
        gt(
          sql`1 - (${knowledgeChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
          threshold,
        ),
      ),
    )
    .orderBy(sql`${knowledgeChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
    .limit(topK);

  return results;
}
