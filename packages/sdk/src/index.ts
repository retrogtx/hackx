import type {
  LexicConfig,
  QueryOptions,
  QueryResult,
  LexicError,
  StreamEvent,
} from "./types";

export type { LexicConfig, QueryOptions, QueryResult, Citation, DecisionStep, LexicError, StreamEvent } from "./types";

const DEFAULT_BASE_URL = "https://dawk-ps2.vercel.app";
const DEFAULT_TIMEOUT = 120_000;

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
   *
   * @param options.plugin - Plugin slug (overrides activePlugin for this call)
   * @param options.query  - The question to ask the expert
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
      const res = await fetch(`${this.baseUrl}/api/v1/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ plugin, query: options.query }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as LexicError;
        throw new LexicAPIError(
          body.error || `HTTP ${res.status}`,
          res.status,
        );
      }

      return (await res.json()) as QueryResult;
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
   *   - done    → final citations, confidence, decision path
   *   - error   → something went wrong
   *
   * Usage:
   * ```ts
   * for await (const event of lexic.queryStream({ query: "..." })) {
   *   if (event.type === "delta") process.stdout.write(event.text);
   *   if (event.type === "done") console.log(event.citations);
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
      const res = await fetch(`${this.baseUrl}/api/v1/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ plugin, query: options.query, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as LexicError;
        throw new LexicAPIError(body.error || `HTTP ${res.status}`, res.status);
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
            // skip malformed events
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
}

export class LexicAPIError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LexicAPIError";
    this.status = status;
  }
}
