import type {
  LexicConfig,
  QueryOptions,
  QueryResult,
  LexicError,
  StreamEvent,
  Citation,
  DecisionStep,
  CollaborateOptions,
  CollaborationResult,
  CollaborationStreamEvent,
  ReviewOptions,
  ReviewResult,
  ReviewAnnotation,
  ReviewStreamEvent,
} from "./types";

export type {
  LexicConfig, QueryOptions, QueryRequestOptions, QueryResult, Citation, DecisionStep, LexicError, StreamEvent,
  CollaborateOptions, CollaborationResult, CollaborationStreamEvent, CollaborationMode,
  ExpertResponse, CollaborationRound, ConsensusResult, ConflictEntry,
  ReviewOptions, ReviewResult, ReviewAnnotation, ReviewSummary, ReviewStreamEvent,
} from "./types";

const DEFAULT_BASE_URL = "https://dawk-ps2.vercel.app";
const DEFAULT_TIMEOUT = 120_000;

/**
 * Normalize a raw API response into a well-typed QueryResult.
 * Handles missing fields, wrong types, and unexpected shapes so callers
 * always get a predictable object regardless of API version quirks.
 */
function normalizeQueryResult(raw: Record<string, unknown>): QueryResult {
  return {
    answer: typeof raw.answer === "string" ? raw.answer : "",
    citations: Array.isArray(raw.citations)
      ? (raw.citations as Record<string, unknown>[]).map(normalizeCitation)
      : [],
    decisionPath: Array.isArray(raw.decisionPath)
      ? (raw.decisionPath as Record<string, unknown>[]).map(normalizeDecisionStep)
      : [],
    confidence: isConfidence(raw.confidence) ? raw.confidence : "low",
    pluginVersion: typeof raw.pluginVersion === "string" ? raw.pluginVersion : "unknown",
  };
}

function normalizeCitation(raw: Record<string, unknown>): Citation {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    document: typeof raw.document === "string" ? raw.document : "",
    page: typeof raw.page === "number" ? raw.page : undefined,
    section: typeof raw.section === "string" ? raw.section : undefined,
    excerpt: typeof raw.excerpt === "string" ? raw.excerpt : "",
  };
}

function normalizeDecisionStep(raw: Record<string, unknown>): DecisionStep {
  return {
    step: typeof raw.step === "number" ? raw.step : 0,
    node: typeof raw.node === "string" ? raw.node : "",
    label: typeof raw.label === "string" ? raw.label : "",
    value: typeof raw.value === "string" ? raw.value : undefined,
    result: typeof raw.result === "string" ? raw.result : undefined,
  };
}

function isConfidence(v: unknown): v is "high" | "medium" | "low" {
  return v === "high" || v === "medium" || v === "low";
}

export class Lexic {
  private apiKey: string;
  private baseUrl: string;
  private activePlugin: string | null;
  private timeout: number;

  constructor(config: LexicConfig) {
    if (!config.apiKey) {
      throw new Error("Lexic: apiKey is required");
    }

    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.activePlugin = config.defaultPlugin || null;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Set the active plugin for subsequent queries.
   * Hot-swap: just call this to switch domains mid-conversation.
   */
  setActivePlugin(pluginSlug: string): void {
    this.activePlugin = pluginSlug;
  }

  /** Returns the currently active plugin slug, or null. */
  getActivePlugin(): string | null {
    return this.activePlugin;
  }

  /**
   * Query an expert plugin. Returns a cited, decision-tree-backed answer.
   */
  async query(options: QueryOptions): Promise<QueryResult> {
    const plugin = options.plugin || this.activePlugin;
    if (!plugin) {
      throw new Error(
        "Lexic: no plugin specified. Pass `plugin` in query options or call setActivePlugin() first.",
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body: Record<string, unknown> = {
        plugin,
        query: options.query,
      };
      if (options.context?.length) body.context = options.context;
      if (options.options) body.options = options.options;

      const res = await fetch(`${this.baseUrl}/api/v1/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as LexicError;
        throw new LexicAPIError(
          errBody.error || `HTTP ${res.status}`,
          res.status,
        );
      }

      const raw = (await res.json()) as Record<string, unknown>;
      return normalizeQueryResult(raw);
    } catch (err) {
      if (err instanceof LexicAPIError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new LexicAPIError(`Request timed out after ${this.timeout}ms`, 408);
      }
      throw new LexicAPIError((err as Error).message || "Network error", 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Stream a query response. Yields events as they arrive:
   *   - status  → pipeline progress (searching KB, web search, generating)
   *   - delta   → text token
   *   - done    → final answer, citations, confidence, decision path
   *   - error   → something went wrong
   *
   * Usage:
   * ```ts
   * for await (const event of lexic.queryStream({ query: "..." })) {
   *   if (event.type === "delta") process.stdout.write(event.text);
   *   if (event.type === "done") console.log(event.answer, event.citations);
   * }
   * ```
   */
  async *queryStream(options: QueryOptions): AsyncGenerator<StreamEvent> {
    const plugin = options.plugin || this.activePlugin;
    if (!plugin) {
      throw new Error(
        "Lexic: no plugin specified. Pass `plugin` in query options or call setActivePlugin() first.",
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body: Record<string, unknown> = {
        plugin,
        query: options.query,
        stream: true,
      };
      if (options.context?.length) body.context = options.context;
      if (options.options) body.options = options.options;

      const res = await fetch(`${this.baseUrl}/api/v1/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as LexicError;
        throw new LexicAPIError(errBody.error || `HTTP ${res.status}`, res.status);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new LexicAPIError("No response stream", 0);

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;
            yield event;
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      if (err instanceof LexicAPIError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new LexicAPIError(`Request timed out after ${this.timeout}ms`, 408);
      }
      throw new LexicAPIError((err as Error).message || "Network error", 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convenience wrapper: streams a query and resolves with the full QueryResult
   * once complete. Useful when you want streaming progress events but still
   * want a single resolved result at the end.
   */
  async queryStreamToResult(
    options: QueryOptions,
    onEvent?: (event: StreamEvent) => void,
  ): Promise<QueryResult> {
    let fullText = "";
    let finalResult: QueryResult | null = null;

    for await (const event of this.queryStream(options)) {
      onEvent?.(event);

      if (event.type === "delta") {
        fullText += event.text;
      } else if (event.type === "done") {
        finalResult = {
          answer: event.answer || fullText,
          citations: Array.isArray(event.citations)
            ? event.citations.map((c) => normalizeCitation(c as unknown as Record<string, unknown>))
            : [],
          decisionPath: Array.isArray(event.decisionPath)
            ? event.decisionPath.map((d) => normalizeDecisionStep(d as unknown as Record<string, unknown>))
            : [],
          confidence: isConfidence(event.confidence) ? event.confidence : "low",
          pluginVersion: typeof event.pluginVersion === "string" ? event.pluginVersion : "unknown",
        };
      } else if (event.type === "error") {
        throw new LexicAPIError(event.error, 0);
      }
    }

    if (finalResult) return finalResult;

    return {
      answer: fullText,
      citations: [],
      decisionPath: [],
      confidence: "low",
      pluginVersion: "unknown",
    };
  }

  /**
   * Run a multi-expert collaboration session. Multiple SME plugins
   * debate/review the query and produce a synthesized consensus.
   */
  async collaborate(options: CollaborateOptions): Promise<CollaborationResult> {
    if (!options.experts?.length || options.experts.length < 2) {
      throw new Error("Lexic: collaborate requires at least 2 expert plugin slugs");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2);

    try {
      const body: Record<string, unknown> = {
        experts: options.experts,
        query: options.query,
        mode: options.mode || "debate",
        maxRounds: options.maxRounds || 3,
      };

      const res = await fetch(`${this.baseUrl}/api/v1/collaborate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as LexicError;
        throw new LexicAPIError(errBody.error || `HTTP ${res.status}`, res.status);
      }

      return (await res.json()) as CollaborationResult;
    } catch (err) {
      if (err instanceof LexicAPIError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new LexicAPIError(`Request timed out after ${this.timeout * 2}ms`, 408);
      }
      throw new LexicAPIError((err as Error).message || "Network error", 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convenience wrapper: streams a collaboration and resolves with the
   * final CollaborationResult. Fires `onEvent` for every SSE event so
   * callers can render token-by-token progress (expert_thinking,
   * expert_response, round_complete, etc.).
   *
   * Usage:
   * ```ts
   * const result = await lexic.collaborateStreamToResult(
   *   { experts: ["eng", "safety"], query: "..." },
   *   (event) => {
   *     if (event.type === "expert_response") console.log(event.expertName, event.answer);
   *     if (event.type === "round_complete") console.log("Round done");
   *   },
   * );
   * console.log(result.consensus.answer);
   * ```
   */
  async collaborateStreamToResult(
    options: CollaborateOptions,
    onEvent?: (event: CollaborationStreamEvent) => void,
  ): Promise<CollaborationResult> {
    let finalResult: CollaborationResult | null = null;

    for await (const event of this.collaborateStream(options)) {
      onEvent?.(event);

      if (event.type === "done") {
        finalResult = {
          rounds: event.rounds,
          consensus: event.consensus,
          latencyMs: event.latencyMs,
        };
      } else if (event.type === "error") {
        throw new LexicAPIError(event.error, 0);
      }
    }

    if (finalResult) return finalResult;

    throw new LexicAPIError("Collaboration stream ended without a result", 0);
  }

  /**
   * Stream a collaboration session. Yields events as experts respond:
   *   - experts_resolved → which experts joined
   *   - round_start      → deliberation round beginning
   *   - expert_thinking   → an expert is generating
   *   - expert_response   → an expert's full response
   *   - round_complete    → round finished
   *   - done              → final consensus + all rounds
   *   - error             → something went wrong
   */
  async *collaborateStream(options: CollaborateOptions): AsyncGenerator<CollaborationStreamEvent> {
    if (!options.experts?.length || options.experts.length < 2) {
      throw new Error("Lexic: collaborate requires at least 2 expert plugin slugs");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2);

    try {
      const body: Record<string, unknown> = {
        experts: options.experts,
        query: options.query,
        mode: options.mode || "debate",
        maxRounds: options.maxRounds || 3,
        stream: true,
      };

      const res = await fetch(`${this.baseUrl}/api/v1/collaborate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as LexicError;
        throw new LexicAPIError(errBody.error || `HTTP ${res.status}`, res.status);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new LexicAPIError("No response stream", 0);

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            yield JSON.parse(line.slice(6)) as CollaborationStreamEvent;
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err instanceof LexicAPIError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new LexicAPIError(`Request timed out after ${this.timeout * 2}ms`, 408);
      }
      throw new LexicAPIError((err as Error).message || "Network error", 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Submit a document for expert review. Returns annotations with citations.
   */
  async review(options: ReviewOptions): Promise<ReviewResult> {
    const plugin = options.plugin || this.activePlugin;
    if (!plugin) {
      throw new Error(
        "Lexic: no plugin specified. Pass `plugin` in review options or call setActivePlugin() first.",
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2);

    try {
      const body: Record<string, unknown> = {
        plugin,
        document: options.document,
        title: options.title || "Untitled",
      };

      const res = await fetch(`${this.baseUrl}/api/v1/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as LexicError;
        throw new LexicAPIError(errBody.error || `HTTP ${res.status}`, res.status);
      }

      const raw = (await res.json()) as Record<string, unknown>;
      return normalizeReviewResult(raw);
    } catch (err) {
      if (err instanceof LexicAPIError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new LexicAPIError(`Request timed out after ${this.timeout * 2}ms`, 408);
      }
      throw new LexicAPIError((err as Error).message || "Network error", 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Stream a document review. Yields events as annotations are found:
   *   - status         → progress updates
   *   - annotation     → individual finding
   *   - batch_complete → batch progress
   *   - done           → final result with all annotations and summary
   *   - error          → something went wrong
   */
  async *reviewStream(options: ReviewOptions): AsyncGenerator<ReviewStreamEvent> {
    const plugin = options.plugin || this.activePlugin;
    if (!plugin) {
      throw new Error(
        "Lexic: no plugin specified. Pass `plugin` in review options or call setActivePlugin() first.",
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout * 2);

    try {
      const body: Record<string, unknown> = {
        plugin,
        document: options.document,
        title: options.title || "Untitled",
        stream: true,
      };

      const res = await fetch(`${this.baseUrl}/api/v1/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as LexicError;
        throw new LexicAPIError(errBody.error || `HTTP ${res.status}`, res.status);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new LexicAPIError("No response stream", 0);

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            yield JSON.parse(line.slice(6)) as ReviewStreamEvent;
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err instanceof LexicAPIError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new LexicAPIError(`Request timed out after ${this.timeout * 2}ms`, 408);
      }
      throw new LexicAPIError((err as Error).message || "Network error", 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function normalizeReviewAnnotation(raw: Record<string, unknown>): ReviewAnnotation {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    segmentIndex: typeof raw.segmentIndex === "number" ? raw.segmentIndex : 0,
    startLine: typeof raw.startLine === "number" ? raw.startLine : 0,
    endLine: typeof raw.endLine === "number" ? raw.endLine : 0,
    originalText: typeof raw.originalText === "string" ? raw.originalText : "",
    severity: isReviewSeverity(raw.severity) ? raw.severity : "info",
    category: typeof raw.category === "string" ? raw.category : "",
    issue: typeof raw.issue === "string" ? raw.issue : "",
    suggestedFix: typeof raw.suggestedFix === "string" ? raw.suggestedFix : null,
    citations: Array.isArray(raw.citations)
      ? (raw.citations as Record<string, unknown>[]).map(normalizeCitation)
      : [],
    confidence: isConfidence(raw.confidence) ? raw.confidence : "low",
  };
}

function normalizeReviewResult(raw: Record<string, unknown>): ReviewResult {
  const rawSummary = (raw.summary || {}) as Record<string, unknown>;
  return {
    documentTitle: typeof raw.documentTitle === "string" ? raw.documentTitle : "",
    totalSegments: typeof raw.totalSegments === "number" ? raw.totalSegments : 0,
    annotations: Array.isArray(raw.annotations)
      ? (raw.annotations as Record<string, unknown>[]).map(normalizeReviewAnnotation)
      : [],
    summary: {
      errorCount: typeof rawSummary.errorCount === "number" ? rawSummary.errorCount : 0,
      warningCount: typeof rawSummary.warningCount === "number" ? rawSummary.warningCount : 0,
      infoCount: typeof rawSummary.infoCount === "number" ? rawSummary.infoCount : 0,
      passCount: typeof rawSummary.passCount === "number" ? rawSummary.passCount : 0,
      overallCompliance: isCompliance(rawSummary.overallCompliance) ? rawSummary.overallCompliance : "non-compliant",
      topIssues: Array.isArray(rawSummary.topIssues) ? rawSummary.topIssues.filter((i): i is string => typeof i === "string") : [],
    },
    confidence: isConfidence(raw.confidence) ? raw.confidence : "low",
    pluginVersion: typeof raw.pluginVersion === "string" ? raw.pluginVersion : "unknown",
    latencyMs: typeof raw.latencyMs === "number" ? raw.latencyMs : 0,
  };
}

function isReviewSeverity(v: unknown): v is "error" | "warning" | "info" | "pass" {
  return v === "error" || v === "warning" || v === "info" || v === "pass";
}

function isCompliance(v: unknown): v is "compliant" | "partially-compliant" | "non-compliant" {
  return v === "compliant" || v === "partially-compliant" || v === "non-compliant";
}

export class LexicAPIError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LexicAPIError";
    this.status = status;
  }
}
