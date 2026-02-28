export interface LexicConfig {
  apiKey: string;
  baseUrl?: string;
  defaultPlugin?: string;
  timeout?: number;
}

export interface QueryRequestOptions {
  citationMode?: "inline" | "footnote" | "off";
  maxSources?: number;
  includeDecisionPath?: boolean;
}

export interface QueryOptions {
  plugin?: string;
  query: string;
  context?: Array<{ role: "user" | "assistant"; content: string }>;
  options?: QueryRequestOptions;
}

export interface Citation {
  id: string;
  document: string;
  page?: number;
  section?: string;
  excerpt: string;
}

export interface DecisionStep {
  step: number;
  node: string;
  label: string;
  value?: string;
  result?: string;
}

export interface QueryResult {
  answer: string;
  citations: Citation[];
  decisionPath: DecisionStep[];
  confidence: "high" | "medium" | "low";
  pluginVersion: string;
}

export interface LexicError {
  error: string;
  status?: number;
}

export type StreamEvent =
  | { type: "status"; status: string; message: string; sourceCount?: number }
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; citations: Citation[]; decisionPath: DecisionStep[]; confidence: "high" | "medium" | "low"; pluginVersion: string }
  | { type: "error"; error: string };

// ─── Collaboration Types ─────────────────────────────────────────────

export type CollaborationMode = "debate" | "consensus" | "review";

export interface CollaborateOptions {
  experts: string[];
  query: string;
  mode?: CollaborationMode;
  maxRounds?: number;
}

export interface ExpertResponse {
  pluginSlug: string;
  pluginName: string;
  domain: string;
  answer: string;
  citations: Citation[];
  confidence: "high" | "medium" | "low";
  revised: boolean;
  revisionNote?: string;
}

export interface CollaborationRound {
  roundNumber: number;
  responses: ExpertResponse[];
}

export interface ConflictEntry {
  topic: string;
  positions: Array<{ expert: string; stance: string }>;
  resolved: boolean;
  resolution?: string;
}

export interface ConsensusResult {
  answer: string;
  confidence: "high" | "medium" | "low";
  agreementLevel: number;
  citations: Citation[];
  conflicts: ConflictEntry[];
  expertContributions: Array<{ expert: string; domain: string; keyPoints: string[] }>;
}

export interface CollaborationResult {
  rounds: CollaborationRound[];
  consensus: ConsensusResult;
  latencyMs: number;
}

export type CollaborationStreamEvent =
  | { type: "status"; status: string; message: string }
  | { type: "experts_resolved"; experts: Array<{ slug: string; name: string; domain: string; sourceCount: number; hasDecisionTree: boolean }> }
  | { type: "round_start"; round: number; totalRounds: number }
  | { type: "expert_thinking"; expert: string; expertName: string; domain: string; message: string }
  | { type: "expert_response"; round: number; expert: string; expertName: string; domain: string; answer: string; citations: Citation[]; confidence: "high" | "medium" | "low"; revised: boolean }
  | { type: "round_complete"; round: number }
  | { type: "done"; rounds: CollaborationRound[]; consensus: ConsensusResult; latencyMs: number }
  | { type: "error"; error: string };
