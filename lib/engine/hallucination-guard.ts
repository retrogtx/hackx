import type { CitationResult } from "./citation";

const REFUSAL_MESSAGE =
  "I don't have verified information on this topic in my knowledge base. Please consult a qualified professional.";

/** Phrases that indicate the AI itself admitted it can't answer */
const REFUSAL_PATTERNS = [
  "i don't have verified information",
  "i don't have enough information",
  "i cannot find",
  "i cannot answer",
  "not available in my knowledge base",
  "no relevant information",
  "beyond the scope of the provided",
  "the provided sources do not",
  "the source documents do not contain",
  "i'm unable to find",
  "i am unable to find",
  "consult a qualified professional",
];

function detectSelfRefusal(answer: string): boolean {
  const lower = answer.toLowerCase();
  return REFUSAL_PATTERNS.some((phrase) => lower.includes(phrase));
}

export function applyHallucinationGuard(result: CitationResult): CitationResult {
  const { cleanedAnswer, citations, phantomCount, totalRefs } = result;

  // CHECK 1: Zero real citations — AI cited nothing real
  // No matter how long the answer is, if it has no verified sources, refuse
  if (citations.length === 0) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      phantomCount,
      totalRefs,
    };
  }

  // CHECK 2: AI itself admitted it can't answer
  // Sometimes the AI says "I don't have info" but still gets medium confidence
  // because it threw in a citation. Detect this and respect the AI's own refusal.
  if (detectSelfRefusal(cleanedAnswer)) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      phantomCount,
      totalRefs,
    };
  }

  // CHECK 3: Phantom majority — more fake citations than real ones
  // If AI wrote [Source 1] [Source 7] [Source 15] but only Source 1 exists,
  // that's 2 phantoms vs 1 real — the AI is making up references
  if (phantomCount > 0 && phantomCount > citations.length) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      phantomCount,
      totalRefs,
    };
  }

  // CHECK 4: Some phantoms but answer is mostly real — downgrade to medium
  // Don't refuse, but warn that something was off
  if (phantomCount > 0 && result.confidence === "high") {
    return {
      ...result,
      confidence: "medium",
    };
  }

  // All checks passed — return as-is
  return result;
}
