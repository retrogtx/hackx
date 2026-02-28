import type { CitationResult } from "./citation";

const REFUSAL_MESSAGE =
  "I don't have verified information on this topic in my knowledge base. Please consult a qualified professional.";

/**
 * Phrases that indicate the AI itself admitted it can't answer.
 *
 * IMPORTANT: Only include phrases that are unambiguous refusals.
 * Do NOT include generic disclaimers like "consult a qualified professional"
 * because those appear in legitimate answers as standard advice.
 */
const REFUSAL_PATTERNS = [
  "i don't have verified information",
  "i don't have enough information",
  "i cannot answer this question",
  "not available in my knowledge base",
  "beyond the scope of the provided sources",
  "the provided sources do not contain",
  "the source documents do not contain",
];

function detectSelfRefusal(answer: string): boolean {
  if (answer.length > 300) return false;

  const lower = answer.toLowerCase();
  return REFUSAL_PATTERNS.some((phrase) => lower.includes(phrase));
}

export function applyHallucinationGuard(result: CitationResult): CitationResult {
  const {
    cleanedAnswer,
    citations,
    phantomCount,
    realRefCount,
    unresolvedRefs,
    totalRefs,
    usedSourceIndices,
  } = result;

  // CHECK 1: Zero real citations — AI cited nothing real.
  if (citations.length === 0) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      usedSourceIndices: [],
      unresolvedRefs,
      totalRefs,
      phantomCount,
      realRefCount,
    };
  }

  // CHECK 2: AI self-refusal (short non-answer with token citation).
  if (detectSelfRefusal(cleanedAnswer)) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      usedSourceIndices,
      unresolvedRefs,
      totalRefs,
      phantomCount,
      realRefCount,
    };
  }

  // CHECK 3: Phantom majority — more fake refs than real refs.
  if (phantomCount > 0 && phantomCount > realRefCount) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      usedSourceIndices,
      unresolvedRefs,
      totalRefs,
      phantomCount,
      realRefCount,
    };
  }

  return result;
}
