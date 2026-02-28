import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { plugins, decisionTrees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveSources, type RetrievedChunk } from "./retrieval";
import { executeDecisionTree, type DecisionResult } from "./decision-tree";
import { processCitations } from "./citation";
import { applyHallucinationGuard } from "./hallucination-guard";
import type {
  CitationEntry,
  ExpertResponse,
  CollaborationRoundData,
  ConsensusData,
} from "@/lib/db/schema";

const RETRIEVAL_THRESHOLD = 0.4;

export type CollaborationMode = "debate" | "consensus" | "review";

export interface CollaborationConfig {
  expertSlugs: string[];
  query: string;
  mode: CollaborationMode;
  maxRounds: number;
  skipPublishCheck?: boolean;
}

export interface CollaborationResult {
  rounds: CollaborationRoundData[];
  consensus: ConsensusData;
  latencyMs: number;
}

interface ResolvedExpert {
  plugin: typeof plugins.$inferSelect;
  sources: RetrievedChunk[];
  decisionResult: DecisionResult | null;
}

async function resolveExpert(
  slug: string,
  query: string,
  skipPublishCheck?: boolean,
): Promise<ResolvedExpert> {
  const plugin = await db.query.plugins.findFirst({
    where: eq(plugins.slug, slug),
  });
  if (!plugin) throw new Error(`Plugin not found: ${slug}`);
  if (!skipPublishCheck && !plugin.isPublished) {
    throw new Error(`Plugin is not published: ${slug}`);
  }

  const sources = await retrieveSources(query, plugin.id, 6, RETRIEVAL_THRESHOLD);

  let decisionResult: DecisionResult | null = null;
  const activeTrees = await db.query.decisionTrees.findMany({
    where: and(eq(decisionTrees.pluginId, plugin.id), eq(decisionTrees.isActive, true)),
  });
  if (activeTrees.length > 0) {
    const params = extractQueryParams(query);
    decisionResult = executeDecisionTree(activeTrees[0].treeData, params);
  }

  return { plugin, sources, decisionResult };
}

function buildExpertContext(expert: ResolvedExpert): string {
  const sourceContext = expert.sources
    .map((s, i) => `[Source ${i + 1}] (${s.documentName}${s.sectionTitle ? `, ${s.sectionTitle}` : ""})\n${s.content}`)
    .join("\n\n---\n\n");

  const decisionContext = expert.decisionResult
    ? `\nDecision Tree Analysis:\n${expert.decisionResult.path.map((s) => `- ${s.label}: ${s.answer || s.result || (s.action?.recommendation ?? "")}`).join("\n")}`
    : "";

  return `Source Documents:\n${sourceContext || "No relevant sources."}\n${decisionContext}`;
}

async function getExpertResponse(
  expert: ResolvedExpert,
  query: string,
  priorRoundContext: string,
  roundNumber: number,
): Promise<ExpertResponse> {
  const expertContext = buildExpertContext(expert);

  const systemPrompt = `${expert.plugin.systemPrompt}

You are participating in a multi-expert collaboration room as the ${expert.plugin.domain} expert.
Your name/role: ${expert.plugin.name}

RULES:
1. If source documents are provided, PRIORITISE them and cite with [Source N].
2. If no source documents are available, answer using your expert knowledge and web search. Do NOT refuse — you are the domain expert.
3. Be specific and precise — other experts will review your response.
4. If you disagree with another expert's assessment, clearly state why with evidence.
5. If another expert raised a valid point that affects your domain, acknowledge it and revise.
6. NEVER fabricate source citations. Only use [Source N] for actual provided sources.`;

  const userMessage = roundNumber === 1
    ? `${expertContext}\n\nQuestion: ${query}\n\nProvide your domain-specific analysis. Be concise but thorough. Cite sources.`
    : `${expertContext}\n\n${priorRoundContext}\n\nQuestion: ${query}\n\nReview the other experts' responses above. If you need to revise your position, clearly state what changed and why. If another expert's point affects your domain, address it. Cite your sources.`;

  const { text } = await generateText({
    model: openai("gpt-5"),
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: {
      web_search: openai.tools.webSearch({ searchContextSize: "medium" }),
    },
  });

  const citationResult = processCitations(text, expert.sources);

  // In collaboration, experts with no knowledge base should still contribute
  // from their persona + web search. Only apply the hallucination guard when
  // the expert actually had sources to cite.
  const guardedResult = expert.sources.length > 0
    ? applyHallucinationGuard(citationResult)
    : citationResult;

  const finalAnswer = guardedResult.cleanedAnswer;
  const finalCitations = guardedResult.citations;
  const finalConfidence = expert.sources.length > 0
    ? guardedResult.confidence
    : "medium" as const;

  const isRevision = roundNumber > 1 && (
    text.toLowerCase().includes("revising") ||
    text.toLowerCase().includes("updating") ||
    text.toLowerCase().includes("i agree with") ||
    text.toLowerCase().includes("correcting")
  );

  return {
    pluginSlug: expert.plugin.slug,
    pluginName: expert.plugin.name,
    domain: expert.plugin.domain,
    answer: finalAnswer,
    citations: finalCitations,
    confidence: finalConfidence,
    revised: isRevision,
    revisionNote: isRevision ? "Position updated based on other experts' input" : undefined,
  };
}

function formatRoundForContext(round: CollaborationRoundData): string {
  return `--- Round ${round.roundNumber} Responses ---\n` +
    round.responses.map((r) =>
      `[${r.pluginName} (${r.domain})]:\n${r.answer}${r.revised ? "\n(REVISED from previous round)" : ""}`
    ).join("\n\n");
}

async function synthesizeConsensus(
  query: string,
  rounds: CollaborationRoundData[],
  _experts: ResolvedExpert[],
): Promise<ConsensusData> {
  const deliberationTranscript = rounds.map(formatRoundForContext).join("\n\n");

  const allCitations: CitationEntry[] = [];
  for (const round of rounds) {
    for (const resp of round.responses) {
      for (const cit of resp.citations) {
        if (!allCitations.some((c) => c.document === cit.document && c.excerpt === cit.excerpt)) {
          allCitations.push(cit);
        }
      }
    }
  }

  const lastRound = rounds[rounds.length - 1];
  const expertContributions = lastRound.responses.map((r) => ({
    expert: r.pluginName,
    domain: r.domain,
    keyPoints: [] as string[],
  }));

  const { text: consensusText } = await generateText({
    model: openai("gpt-5"),
    system: `You are a synthesis moderator for a multi-expert collaboration. Your job is to:
1. Identify points of agreement and disagreement between experts.
2. Synthesize a final consensus answer that incorporates all expert perspectives.
3. Flag unresolved conflicts clearly.
4. Preserve all citations from the original experts using their [Source N] format.
5. Be thorough but concise.

Respond ONLY with a JSON object in this exact format:
{
  "answer": "The synthesized consensus answer...",
  "confidence": "high" | "medium" | "low",
  "agreementLevel": 0.0-1.0,
  "conflicts": [{"topic": "...", "positions": [{"expert": "...", "stance": "..."}], "resolved": true/false, "resolution": "..."}],
  "expertContributions": [{"expert": "...", "domain": "...", "keyPoints": ["...", "..."]}]
}`,
    messages: [{
      role: "user",
      content: `Original question: ${query}\n\n${deliberationTranscript}\n\nSynthesize the final consensus from these expert deliberations. Return ONLY valid JSON.`,
    }],
  });

  try {
    const jsonMatch = consensusText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      answer: parsed.answer || "Experts could not reach a clear consensus.",
      confidence: isConfidence(parsed.confidence) ? parsed.confidence : "medium",
      agreementLevel: typeof parsed.agreementLevel === "number" ? parsed.agreementLevel : 0.5,
      citations: allCitations,
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
      expertContributions: Array.isArray(parsed.expertContributions) ? parsed.expertContributions : expertContributions,
    };
  } catch {
    return {
      answer: consensusText,
      confidence: "medium",
      agreementLevel: 0.5,
      citations: allCitations,
      conflicts: [],
      expertContributions,
    };
  }
}

function isConfidence(v: unknown): v is "high" | "medium" | "low" {
  return v === "high" || v === "medium" || v === "low";
}

export async function runCollaboration(config: CollaborationConfig): Promise<CollaborationResult> {
  const start = Date.now();
  const { expertSlugs, query, mode, maxRounds, skipPublishCheck } = config;

  if (expertSlugs.length < 2) throw new Error("Collaboration requires at least 2 experts");
  if (expertSlugs.length > 5) throw new Error("Maximum 5 experts per collaboration room");

  const experts = await Promise.all(
    expertSlugs.map((slug) => resolveExpert(slug, query, skipPublishCheck)),
  );

  const rounds: CollaborationRoundData[] = [];
  const effectiveRounds = mode === "consensus" ? 1 : Math.min(maxRounds, 3);

  for (let roundNum = 1; roundNum <= effectiveRounds; roundNum++) {
    const priorContext = rounds.length > 0
      ? rounds.map(formatRoundForContext).join("\n\n")
      : "";

    let responses: ExpertResponse[];

    if (mode === "review" && roundNum === 1) {
      const primaryResponse = await getExpertResponse(experts[0], query, "", roundNum);
      responses = [primaryResponse];

      const reviewContext = formatRoundForContext({
        roundNumber: 1,
        responses: [primaryResponse],
      });

      const reviewResponses = await Promise.all(
        experts.slice(1).map((expert) =>
          getExpertResponse(expert, query, reviewContext, 2),
        ),
      );
      responses.push(...reviewResponses);
    } else {
      responses = await Promise.all(
        experts.map((expert) =>
          getExpertResponse(expert, query, priorContext, roundNum),
        ),
      );
    }

    rounds.push({ roundNumber: roundNum, responses });

    if (mode === "review") break;

    if (roundNum < effectiveRounds) {
      const allAgreed = responses.every((r) => r.confidence === "high");
      if (allAgreed && roundNum >= 2) break;
    }
  }

  const consensus = await synthesizeConsensus(query, rounds, experts);

  return {
    rounds,
    consensus,
    latencyMs: Date.now() - start,
  };
}

export async function streamCollaboration(
  config: CollaborationConfig,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const start = Date.now();

  function sse(data: Record<string, unknown>) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  return new ReadableStream({
    async start(controller) {
      try {
        const { expertSlugs, query, mode, maxRounds, skipPublishCheck } = config;

        if (expertSlugs.length < 2) throw new Error("Collaboration requires at least 2 experts");
        if (expertSlugs.length > 5) throw new Error("Maximum 5 experts per room");

        controller.enqueue(sse({
          type: "status",
          status: "resolving_experts",
          message: `Assembling ${expertSlugs.length} experts...`,
        }));

        const experts = await Promise.all(
          expertSlugs.map((slug) => resolveExpert(slug, query, skipPublishCheck)),
        );

        const expertInfo = experts.map((e) => ({
          slug: e.plugin.slug,
          name: e.plugin.name,
          domain: e.plugin.domain,
          sourceCount: e.sources.length,
          hasDecisionTree: e.decisionResult !== null,
        }));

        controller.enqueue(sse({
          type: "experts_resolved",
          experts: expertInfo,
        }));

        const rounds: CollaborationRoundData[] = [];
        const effectiveRounds = mode === "consensus" ? 1 : Math.min(maxRounds, 3);

        for (let roundNum = 1; roundNum <= effectiveRounds; roundNum++) {
          controller.enqueue(sse({
            type: "round_start",
            round: roundNum,
            totalRounds: effectiveRounds,
          }));

          const priorContext = rounds.length > 0
            ? rounds.map(formatRoundForContext).join("\n\n")
            : "";

          let responses: ExpertResponse[];

          if (mode === "review" && roundNum === 1) {
            controller.enqueue(sse({
              type: "expert_thinking",
              expert: experts[0].plugin.slug,
              expertName: experts[0].plugin.name,
              domain: experts[0].plugin.domain,
              message: `${experts[0].plugin.name} is providing initial analysis...`,
            }));

            const primaryResponse = await getExpertResponse(experts[0], query, "", roundNum);
            responses = [primaryResponse];

            controller.enqueue(sse({
              type: "expert_response",
              round: roundNum,
              expert: primaryResponse.pluginSlug,
              expertName: primaryResponse.pluginName,
              domain: primaryResponse.domain,
              answer: primaryResponse.answer,
              citations: primaryResponse.citations,
              confidence: primaryResponse.confidence,
              revised: false,
            }));

            const reviewContext = formatRoundForContext({ roundNumber: 1, responses: [primaryResponse] });

            for (const expert of experts.slice(1)) {
              controller.enqueue(sse({
                type: "expert_thinking",
                expert: expert.plugin.slug,
                expertName: expert.plugin.name,
                domain: expert.plugin.domain,
                message: `${expert.plugin.name} is reviewing...`,
              }));

              const reviewResp = await getExpertResponse(expert, query, reviewContext, 2);
              responses.push(reviewResp);

              controller.enqueue(sse({
                type: "expert_response",
                round: roundNum,
                expert: reviewResp.pluginSlug,
                expertName: reviewResp.pluginName,
                domain: reviewResp.domain,
                answer: reviewResp.answer,
                citations: reviewResp.citations,
                confidence: reviewResp.confidence,
                revised: reviewResp.revised || false,
              }));
            }
          } else {
            responses = [];
            for (const expert of experts) {
              controller.enqueue(sse({
                type: "expert_thinking",
                expert: expert.plugin.slug,
                expertName: expert.plugin.name,
                domain: expert.plugin.domain,
                message: roundNum === 1
                  ? `${expert.plugin.name} is analyzing...`
                  : `${expert.plugin.name} is reviewing other experts' responses...`,
              }));

              const resp = await getExpertResponse(expert, query, priorContext, roundNum);
              responses.push(resp);

              controller.enqueue(sse({
                type: "expert_response",
                round: roundNum,
                expert: resp.pluginSlug,
                expertName: resp.pluginName,
                domain: resp.domain,
                answer: resp.answer,
                citations: resp.citations,
                confidence: resp.confidence,
                revised: resp.revised || false,
              }));
            }
          }

          rounds.push({ roundNumber: roundNum, responses });

          controller.enqueue(sse({
            type: "round_complete",
            round: roundNum,
          }));

          if (mode === "review") break;

          if (roundNum < effectiveRounds) {
            const allAgreed = responses.every((r) => r.confidence === "high");
            if (allAgreed && roundNum >= 2) {
              controller.enqueue(sse({
                type: "status",
                status: "early_consensus",
                message: "All experts aligned — reaching consensus early",
              }));
              break;
            }
          }
        }

        controller.enqueue(sse({
          type: "status",
          status: "synthesizing",
          message: "Synthesizing consensus from all experts...",
        }));

        const consensus = await synthesizeConsensus(query, rounds, experts);

        controller.enqueue(sse({
          type: "done",
          rounds,
          consensus,
          latencyMs: Date.now() - start,
        }));
      } catch (err) {
        controller.enqueue(sse({
          type: "error",
          error: err instanceof Error ? err.message : "Collaboration error",
        }));
      } finally {
        controller.close();
      }
    },
  });
}

function extractQueryParams(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  const patterns: Record<string, RegExp> = {
    load_type: /(?:dead|live|wind|seismic|impact)\s*load/i,
    member_type: /\b(beam|column|slab|footing|wall|foundation)\b/i,
    exposure: /\b(mild|moderate|severe|very severe|extreme)\b/i,
    grade: /\b[mM]\s*(\d+)\b/,
    diameter: /(\d+)\s*(?:mm|cm|m)\s*(?:diameter|dia)/i,
  };
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = query.match(pattern);
    if (match) params[key] = match[1] || match[0];
  }
  return params;
}
