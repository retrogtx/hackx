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

  // Collect all [Source N] references and whether they're valid
  const allRefs: Array<{ fullMatch: string; index: number; valid: boolean }> = [];
  const sourceRefs = answer.matchAll(/\[Source\s+(\d+)\]/gi);

  for (const match of sourceRefs) {
    totalRefs++;
    const sourceIdx = parseInt(match[1]) - 1; // 1-based to 0-based
    const valid = sourceIdx >= 0 && sourceIdx < sources.length;

    if (valid) {
      const source = sources[sourceIdx];
      const citationId = `src_${sourceIdx + 1}`;

      if (!citations.find((c) => c.id === citationId)) {
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
      allRefs.push({ fullMatch: match[0], index: match.index!, valid: false });
    }
  }

  // Strip phantom citations from the answer text so users don't see
  // broken references like [Source 15] when only 3 sources exist
  for (const ref of allRefs) {
    if (!ref.valid) {
      cleanedAnswer = cleanedAnswer.replace(ref.fullMatch, "");
    }
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
  totalRefs: number,
): "high" | "medium" | "low" {
  // No sources found in the database at all — nothing to cite
  if (sourceCount === 0) return "low";

  // Zero real citations — AI didn't reference any real source
  if (realCitationCount === 0) return "low";

  // More phantoms than real citations — AI is making up references
  if (phantomCount > realCitationCount) return "low";

  // Good coverage: 3+ real citations AND no phantom majority
  if (realCitationCount >= 3 && phantomCount === 0) return "high";

  // Decent coverage: 3+ real but some phantoms, or 2 real with none
  if (realCitationCount >= 3) return "medium";
  if (realCitationCount >= 2 && phantomCount === 0) return "high";

  // 1-2 real citations
  return "medium";
}
