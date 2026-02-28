export interface LexicConfig {
  apiKey: string;
  baseUrl?: string;
  defaultPlugin?: string;
  timeout?: number;
}

export interface QueryOptions {
  plugin?: string;
  query: string;
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
  | { type: "done"; citations: Citation[]; decisionPath: DecisionStep[]; confidence: "high" | "medium" | "low"; pluginVersion: string }
  | { type: "error"; error: string };
