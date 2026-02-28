import type { RetrievedChunk } from "./retrieval";
import type { CitationEntry } from "@/lib/db/schema";

export interface CitationResult {
  cleanedAnswer: string;
  citations: CitationEntry[];
  confidence: "high" | "medium" | "low";
  /** Number of [Source N] refs that pointed to non-existent sources */
  phantomCount: number;
  /** Total [Source N] refs found in the raw answer (valid + phantom) */
  totalRefs: number;
}

export function processCitations(
  answer: string,
  sources: RetrievedChunk[],
): CitationResult {
  const citations: CitationEntry[] = [];
  let cleanedAnswer = answer;
  let phantomCount = 0;
  let totalRefs = 0;

  // Collect phantom refs (invalid [Source N] pointing to non-existent sources)
  const phantomRefs: string[] = [];
  const seenIds = new Set<string>();
  const sourceRefs = answer.matchAll(/\[Source\s+(\d+)\]/gi);

  for (const match of sourceRefs) {
    totalRefs++;
    const sourceIdx = parseInt(match[1]) - 1; // 1-based to 0-based

    if (sourceIdx >= 0 && sourceIdx < sources.length) {
      const source = sources[sourceIdx];
      const citationId = `src_${sourceIdx + 1}`;

      if (!seenIds.has(citationId)) {
        seenIds.add(citationId);
        citations.push({
          id: citationId,
          document: source.documentName,
          page: source.pageNumber ?? undefined,
          section: source.sectionTitle ?? undefined,
          excerpt:
            source.content.slice(0, 200) +
            (source.content.length > 200 ? "..." : ""),
        });
      }
    } else {
      // This [Source N] points to nothing — it's a phantom
      phantomCount++;
      phantomRefs.push(match[0]);
    }
  }

  // Strip ALL occurrences of each phantom citation from the answer text
  // so users don't see broken references like [Source 15] when only 3 sources exist.
  // Uses replaceAll to catch duplicates (AI may cite the same phantom twice).
  for (const ref of phantomRefs) {
    cleanedAnswer = cleanedAnswer.replaceAll(ref, "");
  }

  // Clean up double spaces left behind after stripping
  cleanedAnswer = cleanedAnswer.replace(/  +/g, " ").trim();

  const confidence = computeConfidence(
    citations.length,
    sources.length,
    phantomCount,
    totalRefs,
  );

  return { cleanedAnswer, citations, confidence, phantomCount, totalRefs };
}

function computeConfidence(
  realCitationCount: number,
  sourceCount: number,
  phantomCount: number,
  _totalRefs: number,
): "high" | "medium" | "low" {
  // --- LOW: something is clearly wrong ---
  if (sourceCount === 0) return "low";            // no sources in DB at all
  if (realCitationCount === 0) return "low";       // AI cited nothing real
  if (phantomCount > realCitationCount) return "low"; // more fakes than real

  // --- HIGH: strong evidence, no fakes ---
  if (realCitationCount >= 2 && phantomCount === 0) return "high";

  // --- MEDIUM: everything else ---
  // Has real citations but also some phantoms, or only 1 citation
  return "medium";
}
