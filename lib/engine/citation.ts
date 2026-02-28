import type { RetrievedChunk } from "./retrieval";
import type { CitationEntry } from "@/lib/db/schema";

export interface CitationResult {
  cleanedAnswer: string;
  citations: CitationEntry[];
  confidence: "high" | "medium" | "low";
}

export function processCitations(
  answer: string,
  sources: RetrievedChunk[],
): CitationResult {
  const citations: CitationEntry[] = [];
  let cleanedAnswer = answer;

  // Find all [Source N] references in the answer
  const sourceRefs = answer.matchAll(/\[Source\s+(\d+)\]/gi);

  for (const match of sourceRefs) {
    const sourceIdx = parseInt(match[1]) - 1; // 1-based to 0-based
    if (sourceIdx >= 0 && sourceIdx < sources.length) {
      const source = sources[sourceIdx];
      const citationId = `src_${sourceIdx + 1}`;

      if (!citations.find((c) => c.id === citationId)) {
        citations.push({
          id: citationId,
          document: source.documentName,
          page: source.pageNumber ?? undefined,
          section: source.sectionTitle ?? undefined,
          excerpt: source.content.slice(0, 200) + (source.content.length > 200 ? "..." : ""),
        });
      }
    }
  }

  // Compute confidence based on citation coverage
  const confidence = computeConfidence(citations.length, sources.length);

  return { cleanedAnswer, citations, confidence };
}

function computeConfidence(
  citationCount: number,
  sourceCount: number,
): "high" | "medium" | "low" {
  if (citationCount >= 3) return "high";
  if (citationCount >= 1) return "medium";
  if (sourceCount > 0) return "medium";
  return "low";
}
