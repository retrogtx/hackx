import { generateText, streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { plugins, decisionTrees, queryLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveSources, type RetrievedChunk } from "./retrieval";
import { executeDecisionTree, type DecisionResult } from "./decision-tree";
import { processCitations } from "./citation";
import { applyHallucinationGuard } from "./hallucination-guard";

const SOURCE_PRIORITY_PROMPT = `
RULES:
1. PRIORITISE the provided source documents. For claims from sources, cite with [Source N].
2. You may supplement with your own knowledge or web search when the sources are
   insufficient — but clearly distinguish sourced claims (cited) from general knowledge.
3. NEVER fabricate source citations. Only use [Source N] for actual provided sources.
4. If sources are relevant, lead with them. Add extra context from your knowledge after.
5. If no sources are provided or none are relevant, answer from your own knowledge and
   web search. Do NOT refuse to answer.
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

  // 5. LLM generation (GPT-5 with web search for supplementary info)
  const systemPrompt = `${plugin.systemPrompt}\n\n${SOURCE_PRIORITY_PROMPT}`;
  const userMessage = `
Source Documents:
${sourceContext || "No relevant sources found."}
${decisionContext}

User Question: ${query}

Answer the question. Prioritise the source documents above and cite them with [Source N]. You may supplement with your own knowledge or web search if needed.`;

  const { text } = await generateText({
    model: openai("gpt-5"),
    system: systemPrompt,
    prompt: userMessage,
    tools: {
      web_search: openai.tools.webSearch({ searchContextSize: "medium" }),
    },
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

export async function streamQueryPipeline(
  pluginSlug: string,
  query: string,
  apiKeyId?: string,
  options?: { skipPublishCheck?: boolean },
): Promise<ReadableStream<Uint8Array>> {
  const start = Date.now();
  const encoder = new TextEncoder();

  const plugin = await db.query.plugins.findFirst({
    where: eq(plugins.slug, pluginSlug),
  });
  if (!plugin) throw new Error(`Plugin not found: ${pluginSlug}`);
  if (!options?.skipPublishCheck && !plugin.isPublished) {
    throw new Error(`Plugin is not published: ${pluginSlug}`);
  }

  function sse(data: Record<string, unknown>) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  return new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        controller.enqueue(sse({ type: "status", status: "searching_kb", message: "Searching knowledge base..." }));

        const sources = await retrieveSources(query, plugin.id);
        console.log(`[QueryPipeline:stream] Plugin: ${pluginSlug}, Query: "${query.slice(0, 80)}", Sources found: ${sources.length}`);

        controller.enqueue(sse({
          type: "status",
          status: "kb_results",
          message: sources.length > 0
            ? `Found ${sources.length} relevant source${sources.length !== 1 ? "s" : ""}`
            : "No matching sources found — using AI knowledge + web",
          sourceCount: sources.length,
        }));

        let decisionResult: DecisionResult | null = null;
        const activeTrees = await db.query.decisionTrees.findMany({
          where: and(eq(decisionTrees.pluginId, plugin.id), eq(decisionTrees.isActive, true)),
        });
        if (activeTrees.length > 0) {
          decisionResult = executeDecisionTree(activeTrees[0].treeData, extractQueryParams(query));
          controller.enqueue(sse({ type: "status", status: "decision_tree", message: `Evaluated decision tree (${decisionResult.path.length} steps)` }));
        }

        const sourceContext = sources
          .map((s, i) => `[Source ${i + 1}] (${s.documentName}${s.sectionTitle ? `, ${s.sectionTitle}` : ""})\n${s.content}`)
          .join("\n\n---\n\n");

        const decisionContext = decisionResult
          ? `\nDecision Tree Analysis:\n${decisionResult.path.map((s) => `- ${s.label}: ${s.answer || s.result || (s.action?.recommendation ?? "")}`).join("\n")}`
          : "";

        const systemPrompt = `${plugin.systemPrompt}\n\n${SOURCE_PRIORITY_PROMPT}`;
        const userMessage = `
Source Documents:
${sourceContext || "No relevant sources found."}
${decisionContext}

User Question: ${query}

Answer the question. Prioritise the source documents above and cite them with [Source N]. You may supplement with your own knowledge or web search if needed.`;

        const result = streamText({
          model: openai("gpt-5"),
          system: systemPrompt,
          prompt: userMessage,
          tools: {
            web_search: openai.tools.webSearch({ searchContextSize: "medium" }),
          },
        });

        controller.enqueue(sse({ type: "status", status: "generating", message: "Generating response..." }));

        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            fullText += part.text;
            controller.enqueue(sse({ type: "delta", text: part.text }));
          } else if (part.type === "tool-call") {
            controller.enqueue(sse({ type: "status", status: "web_search", message: "Searching the web..." }));
          } else if (part.type === "tool-result") {
            controller.enqueue(sse({ type: "status", status: "web_search_done", message: "Web search complete" }));
          }
        }

        const citationResult = processCitations(fullText, sources);
        const guardedResult = applyHallucinationGuard(citationResult);

        const decisionPath = decisionResult
          ? decisionResult.path.map((s, i) => ({
              step: i + 1,
              node: s.nodeId,
              label: s.label,
              value: s.answer,
              result: s.action?.recommendation,
            }))
          : [];

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

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "done",
          citations: guardedResult.citations,
          decisionPath,
          confidence: guardedResult.confidence,
          pluginVersion: plugin.version,
        })}\n\n`));
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "error",
          error: err instanceof Error ? err.message : "Stream error",
        })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
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
