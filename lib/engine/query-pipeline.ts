import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { plugins, decisionTrees, queryLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveSources } from "./retrieval";
import { executeDecisionTree, type DecisionResult } from "./decision-tree";
import { processCitations } from "./citation";
import { applyHallucinationGuard } from "./hallucination-guard";

const HALLUCINATION_GUARD_PROMPT = `
CRITICAL RULES:
1. ONLY use information from the provided source documents.
2. For EVERY factual claim, include an inline citation: [Source N].
3. If the source documents do NOT contain information to answer the question,
   respond EXACTLY: "I don't have verified information on this topic in my
   knowledge base. Please consult a qualified professional."
4. NEVER fabricate citations or reference documents not provided.
5. If partially answerable, answer what you can with citations and clearly
   state what you cannot verify.
`;

const RETRIEVAL_THRESHOLD = 0.4;

export interface SourceCard {
  id: string;
  rank: number;
  citationRef: string;
  document: string;
  fileType: string;
  page?: number;
  section?: string;
  excerpt: string;
  similarity: number;
  cited: boolean;
}

export interface TrustInfo {
  sourceOfTruth: "plugin_knowledge_base";
  retrievalThreshold: number;
  retrievedSourceCount: number;
  citedSourceCount: number;
  sourceCoverage: number;
  unresolvedCitationRefs: number[];
  trustedSourceCount: number;
  trustLevel: "high" | "medium" | "low";
  notes: string[];
}

export interface QueryResult {
  answer: string;
  citations: Array<{
    id: string;
    document: string;
    page?: number;
    section?: string;
    excerpt: string;
  }>;
  sources: SourceCard[];
  trust: TrustInfo;
  decisionPath: Array<{
    step: number;
    node: string;
    label: string;
    value?: string;
    result?: string;
  }>;
  confidence: "high" | "medium" | "low";
  pluginVersion: string;
}

interface QueryPipelineOptions {
  skipPublishCheck?: boolean;
  skipAuditLog?: boolean;
}

export async function runQueryPipeline(
  pluginSlug: string,
  query: string,
  apiKeyId?: string,
  options?: QueryPipelineOptions,
): Promise<QueryResult> {
  const start = Date.now();

  // 1. Resolve plugin
  const plugin = await db.query.plugins.findFirst({
    where: eq(plugins.slug, pluginSlug),
  });
  if (!plugin) throw new Error(`Plugin not found: ${pluginSlug}`);
  if (!options?.skipPublishCheck && !plugin.isPublished) {
    throw new Error(`Plugin is not published: ${pluginSlug}`);
  }

  // 2. Retrieve sources
  const sources = await retrieveSources(query, plugin.id, 8, RETRIEVAL_THRESHOLD);
  console.log(`[QueryPipeline] Plugin: ${pluginSlug}, Query: "${query.slice(0, 80)}", Sources found: ${sources.length}${sources.length > 0 ? `, top similarity: ${sources[0].similarity.toFixed(3)}` : ""}`);

  // 3. Decision tree evaluation
  let decisionResult: DecisionResult | null = null;
  const activeTrees = await db.query.decisionTrees.findMany({
    where: and(eq(decisionTrees.pluginId, plugin.id), eq(decisionTrees.isActive, true)),
  });

  if (activeTrees.length > 0) {
    // Simple param extraction from query for decision tree
    const extractedParams = extractQueryParams(query);
    decisionResult = executeDecisionTree(activeTrees[0].treeData, extractedParams);
  }

  // 4. Build context for LLM
  const sourceContext = sources
    .map((s, i) => `[Source ${i + 1}] (${s.documentName}${s.sectionTitle ? `, ${s.sectionTitle}` : ""})\n${s.content}`)
    .join("\n\n---\n\n");

  const decisionContext = decisionResult
    ? `\nDecision Tree Analysis:\n${decisionResult.path.map((s) => `- ${s.label}: ${s.answer || s.result || (s.action?.recommendation ?? "")}`).join("\n")}`
    : "";

  // 5. LLM generation
  const systemPrompt = `${plugin.systemPrompt}\n\n${HALLUCINATION_GUARD_PROMPT}`;
  const userMessage = `
Source Documents:
${sourceContext || "No relevant sources found."}
${decisionContext}

User Question: ${query}

Respond using the source documents above. Cite every claim with [Source N].`;

  const { text } = await generateText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    prompt: userMessage,
  });

  // 6. Citation post-processing
  const citationResult = processCitations(text, sources);

  // 7. Hallucination guard
  const guardedResult = applyHallucinationGuard(citationResult);

  const citedIndices = new Set(citationResult.usedSourceIndices);
  const sourcesPanel: SourceCard[] = sources.map((source, i) => ({
    id: `source_${i + 1}`,
    rank: i + 1,
    citationRef: `Source ${i + 1}`,
    document: source.documentName,
    fileType: source.fileType,
    page: source.pageNumber ?? undefined,
    section: source.sectionTitle ?? undefined,
    excerpt: source.content.slice(0, 220) + (source.content.length > 220 ? "..." : ""),
    similarity: Number(source.similarity.toFixed(3)),
    cited: citedIndices.has(i),
  }));

  const sourceCoverage = sources.length > 0
    ? Number((citationResult.usedSourceIndices.length / sources.length).toFixed(2))
    : 0;
  const trustedSourceCount = sources.filter((s) => s.similarity >= 0.6).length;
  const trustNotes: string[] = [];
  if (sources.length === 0) {
    trustNotes.push("No supporting chunks were retrieved from the plugin knowledge base.");
  } else {
    trustNotes.push(
      `Sources are retrieved only from this plugin's uploaded knowledge base (threshold >= ${RETRIEVAL_THRESHOLD}).`,
    );
  }
  if (citationResult.unresolvedRefs.length > 0) {
    trustNotes.push(
      `The answer referenced unresolved citations: ${citationResult.unresolvedRefs.map((n) => `[Source ${n}]`).join(", ")}.`,
    );
  }
  if (citationResult.usedSourceIndices.length === 0 && sources.length > 0) {
    trustNotes.push("No retrieved source was explicitly cited in the final answer.");
  }
  if (citationResult.totalRefs > 0 && citationResult.unresolvedRefs.length === 0) {
    trustNotes.push("All citation tags in the answer were resolved to retrieved source chunks.");
  }

  const trust: TrustInfo = {
    sourceOfTruth: "plugin_knowledge_base",
    retrievalThreshold: RETRIEVAL_THRESHOLD,
    retrievedSourceCount: sources.length,
    citedSourceCount: citationResult.usedSourceIndices.length,
    sourceCoverage,
    unresolvedCitationRefs: citationResult.unresolvedRefs,
    trustedSourceCount,
    trustLevel: computeTrustLevel({
      unresolvedCount: citationResult.unresolvedRefs.length,
      retrievedCount: sources.length,
      citedCount: citationResult.usedSourceIndices.length,
      trustedSourceCount,
    }),
    notes: trustNotes,
  };

  // 8. Build decision path for response
  const decisionPath = decisionResult
    ? decisionResult.path.map((s, i) => ({
        step: i + 1,
        node: s.nodeId,
        label: s.label,
        value: s.answer,
        result: s.action?.recommendation,
      }))
    : [];

  // 9. Audit log
  const latencyMs = Date.now() - start;
  if (!options?.skipAuditLog) {
    await db.insert(queryLogs).values({
      pluginId: plugin.id,
      apiKeyId: apiKeyId || null,
      queryText: query,
      responseText: guardedResult.cleanedAnswer,
      citations: guardedResult.citations,
      decisionPath,
      confidence: guardedResult.confidence,
      latencyMs,
    });
  }

  return {
    answer: guardedResult.cleanedAnswer,
    citations: guardedResult.citations,
    sources: sourcesPanel,
    trust,
    decisionPath,
    confidence: guardedResult.confidence,
    pluginVersion: plugin.version,
  };
}

function extractQueryParams(query: string): Record<string, string> {
  // Simple extraction — the LLM-backed version would be smarter
  const params: Record<string, string> = {};

  // Common engineering parameters
  const patterns: Record<string, RegExp> = {
    load_type: /(?:dead|live|wind|seismic|impact)\s*load/i,
    member_type: /\b(beam|column|slab|footing|wall|foundation)\b/i,
    exposure: /\b(mild|moderate|severe|very severe|extreme)\b/i,
    grade: /\b[mM]\s*(\d+)\b/,
    diameter: /(\d+)\s*(?:mm|cm|m)\s*(?:diameter|dia)/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = query.match(pattern);
    if (match) {
      params[key] = match[1] || match[0];
    }
  }

  return params;
}

function computeTrustLevel({
  unresolvedCount,
  retrievedCount,
  citedCount,
  trustedSourceCount,
}: {
  unresolvedCount: number;
  retrievedCount: number;
  citedCount: number;
  trustedSourceCount: number;
}): "high" | "medium" | "low" {
  if (unresolvedCount > 0) return "low";
  if (retrievedCount === 0 || citedCount === 0) return "low";
  if (citedCount >= 2 && trustedSourceCount > 0) return "high";
  return "medium";
}
