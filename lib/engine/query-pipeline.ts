import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { plugins, decisionTrees, queryLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveSources, type RetrievedChunk } from "./retrieval";
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

export interface QueryResult {
  answer: string;
  citations: Array<{
    id: string;
    document: string;
    page?: number;
    section?: string;
    excerpt: string;
  }>;
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

export async function runQueryPipeline(
  pluginSlug: string,
  query: string,
  apiKeyId?: string,
  options?: { skipPublishCheck?: boolean },
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
  const sources = await retrieveSources(query, plugin.id);
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

  return {
    answer: guardedResult.cleanedAnswer,
    citations: guardedResult.citations,
    decisionPath,
    confidence: guardedResult.confidence,
    pluginVersion: plugin.version,
  };
}

function extractQueryParams(query: string): Record<string, string> {
  // Simple extraction — the LLM-backed version would be smarter
  const params: Record<string, string> = {};
  const lowerQuery = query.toLowerCase();

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
