import type { CitationResult } from "./citation";

const REFUSAL_MESSAGE =
  "I don't have verified information on this topic in my knowledge base. Please consult a qualified professional.";

export function applyHallucinationGuard(result: CitationResult): CitationResult {
  if (result.confidence === "low" && result.citations.length === 0) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      usedSourceIndices: [],
      unresolvedRefs: result.unresolvedRefs,
      totalRefs: result.totalRefs,
    };
  }
  return result;
}
