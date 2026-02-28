import type { RetrievedChunk } from "./retrieval";
import type { CitationEntry } from "@/lib/db/schema";

export interface CitationResult {
  cleanedAnswer: string;
  citations: CitationEntry[];
  confidence: "high" | "medium" | "low";
  usedSourceIndices: number[];
  unresolvedRefs: number[];
  totalRefs: number;
  /** Number of [Source N] refs that pointed to non-existent sources */
  phantomCount: number;
  /** Number of [Source N] refs that pointed to real sources (per-occurrence) */
  realRefCount: number;
}

export function processCitations(
  answer: string,
  sources: RetrievedChunk[],
): CitationResult {
  const citations: CitationEntry[] = [];
  let cleanedAnswer = answer;
  const usedSourceIndices: number[] = [];
  const unresolvedRefs: number[] = [];
  let totalRefs = 0;
  let phantomCount = 0;
  let realRefCount = 0;

  // Collect phantom refs (invalid [Source N] pointing to non-existent sources)
  const phantomRefs: string[] = [];
  const seenIds = new Set<string>();
  const sourceRefs = answer.matchAll(/\[Source\s+(\d+)\]/gi);

  for (const match of sourceRefs) {
    totalRefs += 1;
    const sourceIdx = parseInt(match[1]) - 1; // 1-based to 0-based

    if (sourceIdx >= 0 && sourceIdx < sources.length) {
      realRefCount++;
      const source = sources[sourceIdx];
      const citationId = `src_${sourceIdx + 1}`;

      if (!usedSourceIndices.includes(sourceIdx)) {
        usedSourceIndices.push(sourceIdx);
      }

      if (!seenIds.has(citationId)) {
        seenIds.add(citationId);
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
          excerpt:
            source.content.slice(0, 200) +
            (source.content.length > 200 ? "..." : ""),
        });
      }
    } else {
      // This [Source N] points to nothing — it's a phantom citation.
      phantomCount++;
      const unresolvedRef = sourceIdx + 1;
      if (!unresolvedRefs.includes(unresolvedRef)) {
        unresolvedRefs.push(unresolvedRef);
      }
      phantomRefs.push(match[0]);
    }
  }

  // Strip phantom citation tags so users never see broken [Source N] markers.
  for (const ref of phantomRefs) {
    cleanedAnswer = cleanedAnswer.replaceAll(ref, "");
  }

  // Clean up spacing artifacts after tag stripping.
  cleanedAnswer = cleanedAnswer
    .replace(/  +/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  const confidence = computeConfidence(realRefCount, sources.length, phantomCount);

  return {
    cleanedAnswer,
    citations,
    confidence,
    usedSourceIndices,
    unresolvedRefs,
    totalRefs,
    phantomCount,
    realRefCount,
  };
}

function computeConfidence(
  realRefCount: number,
  sourceCount: number,
  phantomCount: number,
): "high" | "medium" | "low" {
  // LOW: no source grounding or mostly broken citations.
  if (sourceCount === 0) return "low";
  if (realRefCount === 0) return "low";
  if (phantomCount > realRefCount) return "low";

  // HIGH: strong source usage with no phantom refs.
  if (realRefCount >= 2 && phantomCount === 0) return "high";

  // MEDIUM: partially grounded.
  return "medium";
}
