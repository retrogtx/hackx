const ANSWER_HANDLE_PREFIX = "answer-";

export function normalizeAnswerLabel(answer: string): string {
  return answer.trim();
}

export function answerToKey(answer: string): string {
  return normalizeAnswerLabel(answer).toLowerCase();
}

export function answerKeyToHandle(answer: string): string {
  return `${ANSWER_HANDLE_PREFIX}${encodeURIComponent(answerToKey(answer))}`;
}

export function answerHandleToKey(handle?: string | null): string | null {
  if (!handle || !handle.startsWith(ANSWER_HANDLE_PREFIX)) {
    return null;
  }

  const encoded = handle.slice(ANSWER_HANDLE_PREFIX.length);
  if (!encoded) return "";

  try {
    return decodeURIComponent(encoded).trim().toLowerCase();
  } catch {
    return encoded.trim().toLowerCase();
  }
}

export function normalizeQuestionOptions(options: string[]): string[] {
  const unique: string[] = [];
  const seenKeys = new Set<string>();

  for (const option of options) {
    const label = normalizeAnswerLabel(option);
    if (!label) continue;

    const key = answerToKey(label);
    if (seenKeys.has(key)) continue;

    seenKeys.add(key);
    unique.push(label);
  }

  return unique;
}
