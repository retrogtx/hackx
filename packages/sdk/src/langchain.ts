/**
 * LangChain adapter for Lexic.
 *
 * Usage:
 *   import { LexicTool } from "lexic-sdk/langchain";
 *
 *   const tool = new LexicTool({
 *     apiKey: "lx_xxxxx",
 *     plugin: "structural-engineering-v1",
 *     name: "structural_expert",
 *     description: "Consult a structural engineering expert",
 *   });
 *
 *   // Add to any LangChain agent's tool list
 *   const agent = createOpenAIToolsAgent({ llm, tools: [tool], prompt });
 */

import { Lexic, LexicAPIError } from "./index";
import type {
  QueryResult,
  QueryRequestOptions,
  CollaborationResult,
  CollaborationMode,
  CollaborationStreamEvent,
  ReviewResult,
} from "./types";

export interface LexicToolConfig {
  apiKey: string;
  plugin: string;
  baseUrl?: string;
  name?: string;
  description?: string;
  /** Default query options applied to every call through this tool. */
  queryOptions?: QueryRequestOptions;
}

/**
 * A LangChain-compatible tool that wraps the Lexic query API.
 * Implements the minimal Tool interface so it works with any LangChain agent
 * without requiring langchain as a dependency.
 */
export class LexicTool {
  name: string;
  description: string;

  private client: Lexic;
  private plugin: string;
  private queryOptions?: QueryRequestOptions;

  constructor(config: LexicToolConfig) {
    this.client = new Lexic({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
    this.plugin = config.plugin;
    this.queryOptions = config.queryOptions;
    this.name = config.name || `lexic_${config.plugin.replace(/-/g, "_")}`;
    this.description =
      config.description ||
      `Query the "${config.plugin}" plugin for expert, cited answers on domain-specific questions.`;
  }

  /** LangChain Tool interface — called by the agent with a string input. */
  async call(input: string): Promise<string> {
    return this._call(input);
  }

  /**
   * LangChain StructuredTool._call implementation.
   * Returns a JSON string that includes the full answer with inline citations,
   * source metadata, confidence level, and the decision reasoning path.
   */
  async _call(input: string): Promise<string> {
    try {
      const result: QueryResult = await this.client.query({
        plugin: this.plugin,
        query: input,
        options: this.queryOptions,
      });

      return formatResultForAgent(result);
    } catch (err) {
      if (err instanceof LexicAPIError) {
        return JSON.stringify({ error: err.message, status: err.status });
      }
      return JSON.stringify({ error: (err as Error).message });
    }
  }

  /** Switch which plugin this tool queries (hot-swap). */
  setPlugin(pluginSlug: string): void {
    this.plugin = pluginSlug;
  }
}

/**
 * Format a QueryResult into a JSON string suitable for LLM agent consumption.
 * Includes full citation metadata (document, page, section, excerpt) so the
 * agent can reference sources accurately.
 */
// ─── Collaboration Tool ──────────────────────────────────────────────

export interface LexicCollaborationToolConfig {
  apiKey: string;
  experts: string[];
  baseUrl?: string;
  name?: string;
  description?: string;
  mode?: CollaborationMode;
  maxRounds?: number;
  onEvent?: (event: CollaborationStreamEvent) => void;
}

/**
 * A LangChain-compatible tool for multi-expert collaboration rooms.
 * Sends a query to multiple SME plugins, runs adversarial deliberation,
 * and returns the synthesized consensus with per-expert contributions.
 */
export class LexicCollaborationTool {
  name: string;
  description: string;

  private client: Lexic;
  private experts: string[];
  private mode: CollaborationMode;
  private maxRounds: number;
  private onEvent?: (event: CollaborationStreamEvent) => void;

  constructor(config: LexicCollaborationToolConfig) {
    this.client = new Lexic({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
    this.experts = config.experts;
    this.mode = config.mode || "debate";
    this.maxRounds = config.maxRounds || 3;
    this.onEvent = config.onEvent;
    this.name = config.name || "lexic_collaboration";
    this.description =
      config.description ||
      `Consult a panel of ${config.experts.length} domain experts who debate and synthesize a consensus answer. Experts: ${config.experts.join(", ")}`;
  }

  async call(input: string): Promise<string> {
    return this._call(input);
  }

  async _call(input: string): Promise<string> {
    try {
      const result = await this.client.collaborateStreamToResult(
        {
          experts: this.experts,
          query: input,
          mode: this.mode,
          maxRounds: this.maxRounds,
        },
        this.onEvent,
      );

      return formatCollaborationForAgent(result);
    } catch (err) {
      if (err instanceof LexicAPIError) {
        return JSON.stringify({ error: err.message, status: err.status });
      }
      return JSON.stringify({ error: (err as Error).message });
    }
  }

  setExperts(expertSlugs: string[]): void {
    this.experts = expertSlugs;
  }

  setMode(mode: CollaborationMode): void {
    this.mode = mode;
  }
}

function formatCollaborationForAgent(result: CollaborationResult): string {
  const { consensus, rounds } = result;

  const conflicts = (consensus.conflicts ?? []).map((c) => ({
    topic: c.topic,
    resolved: c.resolved,
    resolution: c.resolution,
    positions: c.positions,
  }));

  const contributions = (consensus.expertContributions ?? []).map((e) => ({
    expert: e.expert,
    domain: e.domain,
    keyPoints: e.keyPoints,
  }));

  const output: Record<string, unknown> = {
    consensus: consensus.answer,
    confidence: consensus.confidence,
    agreementLevel: consensus.agreementLevel,
    citations: (consensus.citations ?? []).map((c) => ({
      id: c.id,
      document: c.document,
      excerpt: c.excerpt,
    })),
    roundCount: rounds.length,
    expertContributions: contributions,
  };

  if (conflicts.length > 0) {
    output.conflicts = conflicts;
  }

  return JSON.stringify(output);
}

// ─── Review Tool ─────────────────────────────────────────────────────

export interface LexicReviewToolConfig {
  apiKey: string;
  plugin: string;
  baseUrl?: string;
  name?: string;
  description?: string;
}

/**
 * A LangChain-compatible tool for expert document review.
 * Submits a document for review and returns annotated findings with citations.
 */
export class LexicReviewTool {
  name: string;
  description: string;

  private client: Lexic;
  private plugin: string;

  constructor(config: LexicReviewToolConfig) {
    this.client = new Lexic({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
    this.plugin = config.plugin;
    this.name = config.name || `lexic_review_${config.plugin.replace(/-/g, "_")}`;
    this.description =
      config.description ||
      `Review a document using the "${config.plugin}" expert plugin. Returns annotated compliance findings with citations.`;
  }

  async call(input: string): Promise<string> {
    return this._call(input);
  }

  async _call(input: string): Promise<string> {
    try {
      const result: ReviewResult = await this.client.review({
        plugin: this.plugin,
        document: input,
        title: "LangChain Review",
      });

      return formatReviewForAgent(result);
    } catch (err) {
      if (err instanceof LexicAPIError) {
        return JSON.stringify({ error: err.message, status: err.status });
      }
      return JSON.stringify({ error: (err as Error).message });
    }
  }

  setPlugin(pluginSlug: string): void {
    this.plugin = pluginSlug;
  }
}

function formatReviewForAgent(result: ReviewResult): string {
  const issues = result.annotations
    .filter((a) => a.severity !== "pass")
    .map((a) => ({
      severity: a.severity,
      category: a.category,
      issue: a.issue,
      lines: `${a.startLine}-${a.endLine}`,
      suggestedFix: a.suggestedFix,
      citations: a.citations.map((c) => ({ id: c.id, document: c.document, excerpt: c.excerpt })),
    }));

  return JSON.stringify({
    documentTitle: result.documentTitle,
    compliance: result.summary.overallCompliance,
    confidence: result.confidence,
    summary: {
      errors: result.summary.errorCount,
      warnings: result.summary.warningCount,
      info: result.summary.infoCount,
    },
    issues,
  });
}

// ─── Single-Expert Formatting ────────────────────────────────────────

function formatResultForAgent(result: QueryResult): string {
  const citations = (result.citations ?? []).map((c) => ({
    id: c.id,
    document: c.document,
    ...(c.page != null && { page: c.page }),
    ...(c.section && { section: c.section }),
    excerpt: c.excerpt,
  }));

  const output: Record<string, unknown> = {
    answer: result.answer,
    confidence: result.confidence,
    citations,
  };

  if (result.decisionPath?.length) {
    output.decisionPath = result.decisionPath;
  }

  return JSON.stringify(output);
}
