import type { RetrievedChunk } from "./retrieval";
import type { CitationEntry } from "@/lib/db/schema";

export interface CitationResult {
  cleanedAnswer: string;
  citations: CitationEntry[];
  confidence: "high" | "medium" | "low";
  usedSourceIndices: number[];
  unresolvedRefs: number[];
  totalRefs: number;
}

export function processCitations(
  answer: string,
  sources: RetrievedChunk[],
): CitationResult {
  const citations: CitationEntry[] = [];
  const cleanedAnswer = answer;
  const usedSourceIndices: number[] = [];
  const unresolvedRefs: number[] = [];
  let totalRefs = 0;

  // Find all [Source N] references in the answer
  const sourceRefs = answer.matchAll(/\[Source\s+(\d+)\]/gi);

  for (const match of sourceRefs) {
    totalRefs += 1;
    const sourceIdx = parseInt(match[1]) - 1; // 1-based to 0-based
    if (sourceIdx >= 0 && sourceIdx < sources.length) {
      const source = sources[sourceIdx];
      const citationId = `src_${sourceIdx + 1}`;
      if (!usedSourceIndices.includes(sourceIdx)) {
        usedSourceIndices.push(sourceIdx);
      }

      if (!citations.find((c) => c.id === citationId)) {
        citations.push({
          id: citationId,
          document: source.documentName,
          documentId: source.documentId,
          chunkId: source.id,
          chunkIndex: source.chunkIndex,
          sourceRank: sourceIdx + 1,
          similarity: source.similarity,
          fileType: source.fileType,
          page: source.pageNumber ?? undefined,
          section: source.sectionTitle ?? undefined,
          excerpt: source.content.slice(0, 200) + (source.content.length > 200 ? "..." : ""),
        });
      }
    } else {
      const unresolvedRef = sourceIdx + 1;
      if (!unresolvedRefs.includes(unresolvedRef)) {
        unresolvedRefs.push(unresolvedRef);
      }
    }
  }

  // Compute confidence based on citation coverage
  const confidence = computeConfidence(citations.length, sources.length, unresolvedRefs.length);

  return {
    cleanedAnswer,
    citations,
    confidence,
    usedSourceIndices,
    unresolvedRefs,
    totalRefs,
  };
}

function computeConfidence(
  citationCount: number,
  sourceCount: number,
  unresolvedCount: number,
): "high" | "medium" | "low" {
  if (unresolvedCount > 0) return "low";
  if (citationCount >= 3) return "high";
  if (citationCount >= 1) return "medium";
  if (sourceCount > 0) return "medium";
  return "low";
}
