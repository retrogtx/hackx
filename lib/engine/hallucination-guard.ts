import type { CitationResult } from "./citation";

const REFUSAL_MESSAGE =
  "I don't have verified information on this topic in my knowledge base. Please consult a qualified professional.";

/**
 * Phrases that indicate the AI itself admitted it can't answer.
 *
 * IMPORTANT: Only include phrases that are unambiguous refusals.
 * Do NOT include generic disclaimers like "consult a qualified professional"
 * because those appear in legitimate engineering/medical answers as
 * standard advice (e.g. "The minimum cover is 50mm [Source 1]. For
 * site-specific conditions, consult a qualified professional.")
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

/**
 * Detect if the AI's answer is primarily a refusal, not a legitimate answer
 * with a disclaimer tacked on.
 *
 * Only triggers on SHORT answers (under 300 chars) because genuine refusals
 * are brief one-liners. A 500-word cited answer that ends with "consult a
 * professional" is NOT a refusal — it's a good answer with standard advice.
 */
function detectSelfRefusal(answer: string): boolean {
  if (answer.length > 300) return false;

  const lower = answer.toLowerCase();
  return REFUSAL_PATTERNS.some((phrase) => lower.includes(phrase));
}

export function applyHallucinationGuard(result: CitationResult): CitationResult {
  const { cleanedAnswer, citations, phantomCount, realRefCount } = result;

  // CHECK 1: Zero real citations — AI cited nothing real
  if (citations.length === 0) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      phantomCount,
      realRefCount,
    };
  }

  // CHECK 2: AI itself admitted it can't answer (short refusal with a
  // token citation thrown in). Only triggers on short answers to avoid
  // false-refusing legitimate long answers with standard disclaimers.
  if (detectSelfRefusal(cleanedAnswer)) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      phantomCount,
      realRefCount,
    };
  }

  // CHECK 3: Phantom majority — more fake ref occurrences than real ones.
  // Uses realRefCount (per-occurrence) not citations.length (unique sources)
  // so repeated valid citations like "[Source 1] [Source 1] [Source 7]"
  // (2 real refs) aren't unfairly penalized against 1 phantom.
  if (phantomCount > 0 && phantomCount > realRefCount) {
    return {
      cleanedAnswer: REFUSAL_MESSAGE,
      citations: [],
      confidence: "low",
      phantomCount,
      realRefCount,
    };
  }

  // All checks passed — return as-is.
  // Confidence was already computed by processCitations using the same
  // realRefCount vs phantomCount logic, so no need to downgrade here.
  return result;
}
