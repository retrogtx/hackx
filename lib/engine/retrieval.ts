import { db } from "@/lib/db";
import { knowledgeChunks, knowledgeDocuments } from "@/lib/db/schema";
import { sql, eq, and, gt, cosineDistance } from "drizzle-orm";
import { embedText } from "./embedding";

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
  documentId: string;
  documentName: string;
  fileType: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  chunkIndex: number;
}

export async function retrieveSources(
  query: string,
  pluginId: string,
  topK: number = 8,
  threshold: number = 0.3,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(query);

  const distance = cosineDistance(knowledgeChunks.embedding, queryEmbedding);
  const similarity = sql<number>`1 - (${distance})`;

  const results = await db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
      similarity,
      documentId: knowledgeChunks.documentId,
      documentName: knowledgeDocuments.fileName,
      fileType: knowledgeDocuments.fileType,
      pageNumber: knowledgeChunks.pageNumber,
      sectionTitle: knowledgeChunks.sectionTitle,
      chunkIndex: knowledgeChunks.chunkIndex,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeChunks.documentId, knowledgeDocuments.id))
    .where(
      and(
        eq(knowledgeChunks.pluginId, pluginId),
        gt(similarity, threshold),
      ),
    )
    .orderBy(distance)
    .limit(topK);

  return results;
}
