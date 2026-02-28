import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins, decisionTrees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveSources } from "@/lib/engine/retrieval";
import { processCitations } from "@/lib/engine/citation";
import { applyHallucinationGuard } from "@/lib/engine/hallucination-guard";
import { executeDecisionTree } from "@/lib/engine/decision-tree";

const RULES = `
RULES:
1. PRIORITISE the provided source documents. For claims from sources, cite with [Source N].
2. You may supplement with your own knowledge or web search when sources are insufficient.
3. NEVER fabricate source citations. Only use [Source N] for actual provided sources.
4. If no sources are relevant, answer from your own knowledge and web search.`;

function sse(data: Record<string, unknown>) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pluginId: string }> },
) {
  try {
    const user = await requireUser();
    const { pluginId } = await params;

    const plugin = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, pluginId), eq(plugins.creatorId, user.id)),
    });

    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const body = await req.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(sse({ type: "status", status: "searching_kb", message: "Searching knowledge base..." })));

          const sources = await retrieveSources(query, plugin.id);

          controller.enqueue(encoder.encode(sse({
            type: "status",
            status: "kb_results",
            message: sources.length > 0
              ? `Found ${sources.length} relevant source${sources.length !== 1 ? "s" : ""}`
              : "No matching sources found — using AI knowledge + web",
            sourceCount: sources.length,
          })));

          const activeTrees = await db.query.decisionTrees.findMany({
            where: and(eq(decisionTrees.pluginId, plugin.id), eq(decisionTrees.isActive, true)),
          });

          let decisionResult = null;
          if (activeTrees.length > 0) {
            const extractedParams: Record<string, string> = {};
            const memberMatch = query.match(/\b(beam|column|slab|footing)\b/i);
            if (memberMatch) extractedParams.member_type = memberMatch[1].toLowerCase();
            const exposureMatch = query.match(/\b(mild|moderate|severe|extreme)\b/i);
            if (exposureMatch) extractedParams.exposure = exposureMatch[1].toLowerCase();
            decisionResult = executeDecisionTree(activeTrees[0].treeData, extractedParams);

            controller.enqueue(encoder.encode(sse({ type: "status", status: "decision_tree", message: "Evaluating decision tree..." })));
          }

          const sourceContext = sources
            .map((s, i) => `[Source ${i + 1}] (${s.documentName}${s.sectionTitle ? `, ${s.sectionTitle}` : ""})\n${s.content}`)
            .join("\n\n---\n\n");

          const decisionContext = decisionResult
            ? `\nDecision Tree Analysis:\n${decisionResult.path.map((s) => `- ${s.label}: ${s.answer || s.result || (s.action?.recommendation ?? "")}`).join("\n")}`
            : "";

          controller.enqueue(encoder.encode(sse({ type: "status", status: "generating", message: "Generating response..." })));

          const result = streamText({
            model: openai("gpt-5"),
            system: `${plugin.systemPrompt}\n${RULES}`,
            prompt: `Source Documents:\n${sourceContext || "No relevant sources found."}\n${decisionContext}\n\nUser Question: ${query}\n\nAnswer the question. Prioritise the source documents and cite them with [Source N]. Supplement with your own knowledge or web search if needed.`,
            tools: {
              web_search: openai.tools.webSearch({ searchContextSize: "medium" }),
            },
          });

          let fullText = "";

          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              fullText += part.text;
              controller.enqueue(encoder.encode(sse({ type: "delta", text: part.text })));
            } else if (part.type === "tool-call") {
              controller.enqueue(encoder.encode(sse({
                type: "status",
                status: "web_search",
                message: `Searching the web...`,
                tool: part.toolName,
              })));
            } else if (part.type === "tool-result") {
              controller.enqueue(encoder.encode(sse({
                type: "status",
                status: "web_search_done",
                message: "Web search complete",
              })));
            }
          }

          const citationResult = processCitations(fullText, sources);
          const guarded = applyHallucinationGuard(citationResult);

          const decisionPath = decisionResult?.path.map((s, i) => ({
            step: i + 1,
            node: s.nodeId,
            label: s.label,
            value: s.answer,
            result: s.action?.recommendation,
          })) || [];

          controller.enqueue(encoder.encode(sse({
            type: "done",
            citations: guarded.citations,
            confidence: guarded.confidence,
            decisionPath,
            pluginVersion: plugin.version,
          })));
        } catch (err) {
          controller.enqueue(encoder.encode(sse({
            type: "error",
            error: err instanceof Error ? err.message : "Stream error",
          })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
