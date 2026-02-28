import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { plugins, decisionTrees, reviewLogs } from "@/lib/db/schema";
import type { ReviewAnnotationData, ReviewSummaryData, CitationEntry } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { retrieveSourcesByEmbedding, type RetrievedChunk } from "./retrieval";
import { embedTexts } from "./embedding";
import { executeDecisionTree, type DecisionResult } from "./decision-tree";
import { processCitations } from "./citation";
import { applyHallucinationGuard } from "./hallucination-guard";

const RETRIEVAL_THRESHOLD = 0.4;
const MAX_SEGMENT_CHARS = 2000;
const BATCH_SIZE = 4;
const BATCH_CONCURRENCY = 3;

// ─── Types ──────────────────────────────────────────────────────────

export interface ReviewSegment {
  index: number;
  startLine: number;
  endLine: number;
  content: string;
  sectionTitle?: string;
}

export interface ReviewAnnotation {
  id: string;
  segmentIndex: number;
  startLine: number;
  endLine: number;
  originalText: string;
  severity: "error" | "warning" | "info" | "pass";
  category: string;
  issue: string;
  suggestedFix: string | null;
  citations: CitationEntry[];
  confidence: "high" | "medium" | "low";
}

export interface ReviewResult {
  documentTitle: string;
  totalSegments: number;
  annotations: ReviewAnnotation[];
  summary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    passCount: number;
    overallCompliance: "compliant" | "partially-compliant" | "non-compliant";
    topIssues: string[];
  };
  confidence: "high" | "medium" | "low";
  pluginVersion: string;
  latencyMs: number;
}

interface ReviewPipelineOptions {
  skipPublishCheck?: boolean;
  skipAuditLog?: boolean;
}

// ─── Segmentation ───────────────────────────────────────────────────

export function segmentDocument(text: string): ReviewSegment[] {
  const lines = text.split("\n");
  const segments: ReviewSegment[] = [];
  let currentContent = "";
  let currentStartLine = 1;
  let segmentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Start a new segment on double-newline boundary when current segment is non-trivial
    const isDoubleNewline = line.trim() === "" && currentContent.trim() !== "";
    const wouldExceedMax = (currentContent + "\n" + line).length > MAX_SEGMENT_CHARS && currentContent.trim() !== "";

    if (isDoubleNewline || wouldExceedMax) {
      if (currentContent.trim()) {
        segments.push({
          index: segmentIndex++,
          startLine: currentStartLine,
          endLine: lineNum - 1,
          content: currentContent.trim(),
          sectionTitle: extractSectionTitle(currentContent),
        });
      }
      currentContent = isDoubleNewline ? "" : line;
      currentStartLine = isDoubleNewline ? lineNum + 1 : lineNum;
    } else {
      if (!currentContent) currentStartLine = lineNum;
      currentContent += (currentContent ? "\n" : "") + line;
    }
  }

  // Final segment
  if (currentContent.trim()) {
    segments.push({
      index: segmentIndex,
      startLine: currentStartLine,
      endLine: lines.length,
      content: currentContent.trim(),
      sectionTitle: extractSectionTitle(currentContent),
    });
  }

  return segments;
}

function extractSectionTitle(content: string): string | undefined {
  const firstLine = content.split("\n")[0].trim();
  // Markdown headers or ALL CAPS lines as section titles
  if (firstLine.startsWith("#")) return firstLine.replace(/^#+\s*/, "");
  if (firstLine.length < 80 && firstLine === firstLine.toUpperCase() && /[A-Z]/.test(firstLine)) return firstLine;
  return undefined;
}

// ─── Review Prompt ──────────────────────────────────────────────────

function buildReviewPrompt(segments: ReviewSegment[], sourceContext: string, decisionContext: string): string {
  const segmentBlock = segments
    .map((s) => `--- Segment ${s.index} (lines ${s.startLine}-${s.endLine}) ---\n${s.content}`)
    .join("\n\n");

  return `You are performing a document review. Analyze each segment against the source documents (knowledge base) and flag errors, omissions, non-compliance, and best-practice issues.

Source Documents:
${sourceContext || "No relevant sources found."}
${decisionContext}

Document Segments to Review:
${segmentBlock}

For each issue found, produce a JSON annotation. Return a JSON array (no markdown fences, just the raw JSON array).

Each annotation must have:
- "segmentIndex": number (which segment)
- "originalText": string (the problematic text, up to 200 chars)
- "severity": "error" | "warning" | "info" | "pass"
- "category": "non-compliance" | "omission" | "best-practice" | "factual-error" | "ambiguity"
- "issue": string (clear description of the problem)
- "suggestedFix": string | null (how to fix it)
- "citations": array of citation refs in format "[Source N]" that support your finding

If a segment is correct/compliant, include one annotation with severity "pass" and issue "No issues found".

Cite source documents with [Source N] when your finding is backed by a source. NEVER fabricate citations.

Return ONLY the JSON array, e.g.:
[{"segmentIndex":0,"originalText":"...","severity":"warning","category":"omission","issue":"...","suggestedFix":"...","citations":["[Source 1]"]}]`;
}

// ─── Core Pipeline ──────────────────────────────────────────────────

export async function runReviewPipeline(
  pluginSlug: string,
  documentText: string,
  documentTitle: string,
  apiKeyId?: string,
  options?: ReviewPipelineOptions,
): Promise<ReviewResult> {
  const start = Date.now();

  // 1. Resolve plugin
  const plugin = await db.query.plugins.findFirst({
    where: eq(plugins.slug, pluginSlug),
  });
  if (!plugin) throw new Error(`Plugin not found: ${pluginSlug}`);
  if (!options?.skipPublishCheck && !plugin.isPublished) {
    throw new Error(`Plugin is not published: ${pluginSlug}`);
  }
  const pluginId = plugin.id;
  const systemPrompt = plugin.systemPrompt;
  const pluginVersion = plugin.version;

  // 2. Segment document
  const segments = segmentDocument(documentText);
  const allAnnotations: ReviewAnnotation[] = [];

  // 3. Get decision tree
  let decisionResult: DecisionResult | null = null;
  const activeTrees = await db.query.decisionTrees.findMany({
    where: and(eq(decisionTrees.pluginId, pluginId), eq(decisionTrees.isActive, true)),
  });
  if (activeTrees.length > 0) {
    decisionResult = executeDecisionTree(activeTrees[0].treeData, {});
  }

  const decisionContext = decisionResult
    ? `\nDecision Tree Guidelines:\n${decisionResult.path.map((s) => `- ${s.label}: ${s.answer || s.result || (s.action?.recommendation ?? "")}`).join("\n")}`
    : "";

  // 4. Process in batches
  const batches: ReviewSegment[][] = [];
  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    batches.push(segments.slice(i, i + BATCH_SIZE));
  }

  // Process batches with limited concurrency
  let annotationCounter = 0;

  async function processBatch(batch: ReviewSegment[]) {
    const segmentTexts = batch.map((s) => s.content);
    const segmentEmbeddings = await embedTexts(segmentTexts);

    const perSegmentSources = await Promise.all(
      segmentEmbeddings.map((emb) =>
        retrieveSourcesByEmbedding(emb, pluginId, 8, RETRIEVAL_THRESHOLD),
      ),
    );

    const sources = deduplicateSources(perSegmentSources.flat());

    const sourceContext = sources
      .map((s, i) => `[Source ${i + 1}] (${s.documentName}${s.sectionTitle ? `, ${s.sectionTitle}` : ""})\n${s.content}`)
      .join("\n\n---\n\n");

    const reviewPrompt = buildReviewPrompt(batch, sourceContext, decisionContext);

    const { text } = await generateText({
      model: openai("gpt-5"),
      system: systemPrompt + "\n\nYou are reviewing a document for compliance and quality. Be thorough but fair.",
      messages: [{ role: "user", content: reviewPrompt }],
    });

    const rawAnnotations = parseAnnotationsFromLLM(text);
    const batchAnnotations: ReviewAnnotation[] = [];

    for (const raw of rawAnnotations) {
      const segment = batch.find((s) => s.index === raw.segmentIndex) || batch[0];

      const citationText = (raw.citations || []).join(" ") + " " + raw.issue;
      const citationResult = processCitations(citationText, sources);
      const guardedResult = applyHallucinationGuard(citationResult);

      batchAnnotations.push({
        id: `ann_${annotationCounter++}`,
        segmentIndex: segment.index,
        startLine: segment.startLine,
        endLine: segment.endLine,
        originalText: (raw.originalText || segment.content).slice(0, 200),
        severity: isValidSeverity(raw.severity) ? raw.severity : "info",
        category: raw.category || "best-practice",
        issue: raw.issue || "No details provided",
        suggestedFix: raw.suggestedFix || null,
        citations: guardedResult.citations.length > 0 ? guardedResult.citations : [],
        confidence: guardedResult.confidence,
      });
    }

    return batchAnnotations;
  }

  await runWithConcurrency(batches, async (batch) => {
    const batchAnnotations = await processBatch(batch);
    allAnnotations.push(...batchAnnotations);
  }, BATCH_CONCURRENCY);

  // 5. Compute summary
  const summary = computeSummary(allAnnotations);
  const overallConfidence = computeOverallConfidence(allAnnotations);
  const latencyMs = Date.now() - start;

  // 6. Audit log
  if (!options?.skipAuditLog) {
    await db.insert(reviewLogs).values({
      pluginId,
      apiKeyId: apiKeyId || null,
      documentTitle,
      documentText,
      totalSegments: segments.length,
      annotations: allAnnotations as ReviewAnnotationData[],
      summary,
      confidence: overallConfidence,
      latencyMs,
    });
  }

  return {
    documentTitle,
    totalSegments: segments.length,
    annotations: allAnnotations,
    summary,
    confidence: overallConfidence,
    pluginVersion,
    latencyMs,
  };
}

// ─── Streaming Pipeline ─────────────────────────────────────────────

export async function streamReviewPipeline(
  pluginSlug: string,
  documentText: string,
  documentTitle: string,
  apiKeyId?: string,
  options?: ReviewPipelineOptions,
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
  const pluginId = plugin.id;
  const systemPrompt = plugin.systemPrompt;
  const pluginVersion = plugin.version;

  function sse(data: Record<string, unknown>) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sse({ type: "status", status: "segmenting", message: "Segmenting document..." }));

        const segments = segmentDocument(documentText);
        const allAnnotations: ReviewAnnotation[] = [];

        controller.enqueue(sse({ type: "status", status: "segmented", message: `Split into ${segments.length} segments` }));

        // Decision tree
        let decisionResult: DecisionResult | null = null;
        const activeTrees = await db.query.decisionTrees.findMany({
          where: and(eq(decisionTrees.pluginId, pluginId), eq(decisionTrees.isActive, true)),
        });
        if (activeTrees.length > 0) {
          decisionResult = executeDecisionTree(activeTrees[0].treeData, {});
          controller.enqueue(sse({ type: "status", status: "decision_tree", message: `Evaluated decision tree (${decisionResult.path.length} steps)` }));
        }

        const decisionContext = decisionResult
          ? `\nDecision Tree Guidelines:\n${decisionResult.path.map((s) => `- ${s.label}: ${s.answer || s.result || (s.action?.recommendation ?? "")}`).join("\n")}`
          : "";

        // Batches
        const batches: ReviewSegment[][] = [];
        for (let i = 0; i < segments.length; i += BATCH_SIZE) {
          batches.push(segments.slice(i, i + BATCH_SIZE));
        }

        let annotationCounter = 0;
        let batchesCompleted = 0;

        controller.enqueue(sse({
          type: "status",
          status: "reviewing",
          message: `Reviewing ${batches.length} batches (${BATCH_CONCURRENCY} in parallel)...`,
        }));

        await runWithConcurrency(batches, async (batch, batchIdx) => {
          controller.enqueue(sse({
            type: "status",
            status: "reviewing_batch",
            message: `Starting batch ${batchIdx + 1} of ${batches.length}...`,
          }));

          try {
            const segmentTexts = batch.map((s) => s.content);
            const segmentEmbeddings = await embedTexts(segmentTexts);

            const perSegmentSources = await Promise.all(
              segmentEmbeddings.map((emb) =>
                retrieveSourcesByEmbedding(emb, pluginId, 8, RETRIEVAL_THRESHOLD),
              ),
            );

            const sources = deduplicateSources(perSegmentSources.flat());

            const sourceContext = sources
              .map((s, i) => `[Source ${i + 1}] (${s.documentName}${s.sectionTitle ? `, ${s.sectionTitle}` : ""})\n${s.content}`)
              .join("\n\n---\n\n");

            const reviewPrompt = buildReviewPrompt(batch, sourceContext, decisionContext);

            const { text } = await generateText({
              model: openai("gpt-5"),
              system: systemPrompt + "\n\nYou are reviewing a document for compliance and quality. Be thorough but fair.",
              messages: [{ role: "user", content: reviewPrompt }],
            });

            const rawAnnotations = parseAnnotationsFromLLM(text);

            for (const raw of rawAnnotations) {
              const segment = batch.find((s) => s.index === raw.segmentIndex) || batch[0];

              const citationText = (raw.citations || []).join(" ") + " " + raw.issue;
              const citationResult = processCitations(citationText, sources);
              const guardedResult = applyHallucinationGuard(citationResult);

              const annotation: ReviewAnnotation = {
                id: `ann_${annotationCounter++}`,
                segmentIndex: segment.index,
                startLine: segment.startLine,
                endLine: segment.endLine,
                originalText: (raw.originalText || segment.content).slice(0, 200),
                severity: isValidSeverity(raw.severity) ? raw.severity : "info",
                category: raw.category || "best-practice",
                issue: raw.issue || "No details provided",
                suggestedFix: raw.suggestedFix || null,
                citations: guardedResult.citations.length > 0 ? guardedResult.citations : [],
                confidence: guardedResult.confidence,
              };

              allAnnotations.push(annotation);
              controller.enqueue(sse({ type: "annotation", annotation }));
            }
          } catch (batchErr) {
            const rawMsg = batchErr instanceof Error ? batchErr.message : "Batch processing error";
            const safeMsg = rawMsg.length > 200 ? rawMsg.slice(0, 200) + "..." : rawMsg;
            controller.enqueue(sse({
              type: "status",
              status: "batch_error",
              message: `Batch ${batchIdx + 1} failed: ${safeMsg}`,
            }));
          }

          batchesCompleted++;
          controller.enqueue(sse({
            type: "batch_complete",
            batchIndex: batchIdx,
            totalBatches: batches.length,
            message: `Completed ${batchesCompleted} of ${batches.length} batches`,
          }));
        }, BATCH_CONCURRENCY);

        const summary = computeSummary(allAnnotations);
        const overallConfidence = computeOverallConfidence(allAnnotations);
        const latencyMs = Date.now() - start;

        if (!options?.skipAuditLog) {
          await db.insert(reviewLogs).values({
            pluginId,
            apiKeyId: apiKeyId || null,
            documentTitle,
            documentText,
            totalSegments: segments.length,
            annotations: allAnnotations as ReviewAnnotationData[],
            summary,
            confidence: overallConfidence,
            latencyMs,
          });
        }

        controller.enqueue(sse({
          type: "done",
          documentTitle,
          totalSegments: segments.length,
          annotations: allAnnotations,
          summary,
          confidence: overallConfidence,
          pluginVersion: pluginVersion,
          latencyMs,
        }));
      } catch (err) {
        // Sanitize error — pgvector/embedding errors can contain raw vector data
        const rawMsg = err instanceof Error ? err.message : "Review stream error";
        const safeMsg = rawMsg.length > 200 ? rawMsg.slice(0, 200) + "..." : rawMsg;
        controller.enqueue(sse({
          type: "error",
          error: safeMsg,
        }));
      } finally {
        controller.close();
      }
    },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

interface RawAnnotation {
  segmentIndex: number;
  originalText?: string;
  severity?: string;
  category?: string;
  issue?: string;
  suggestedFix?: string | null;
  citations?: string[];
}

function parseAnnotationsFromLLM(text: string): RawAnnotation[] {
  try {
    // Try to extract JSON array from LLM response (may be wrapped in markdown fences)
    let jsonStr = text.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    // Find array boundaries
    const startIdx = jsonStr.indexOf("[");
    const endIdx = jsonStr.lastIndexOf("]");
    if (startIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.slice(startIdx, endIdx + 1);
    }

    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed as RawAnnotation[];
    return [];
  } catch {
    return [];
  }
}

/** Deduplicate sources by chunk ID, keeping highest similarity. */
function deduplicateSources(sources: RetrievedChunk[]): RetrievedChunk[] {
  const map = new Map<string, RetrievedChunk>();
  for (const s of sources) {
    const existing = map.get(s.id);
    if (!existing || s.similarity > existing.similarity) {
      map.set(s.id, s);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.similarity - a.similarity);
}

function isValidSeverity(s: unknown): s is "error" | "warning" | "info" | "pass" {
  return s === "error" || s === "warning" || s === "info" || s === "pass";
}

function computeSummary(annotations: ReviewAnnotation[]): ReviewSummaryData {
  const errorCount = annotations.filter((a) => a.severity === "error").length;
  const warningCount = annotations.filter((a) => a.severity === "warning").length;
  const infoCount = annotations.filter((a) => a.severity === "info").length;
  const passCount = annotations.filter((a) => a.severity === "pass").length;

  let overallCompliance: "compliant" | "partially-compliant" | "non-compliant";
  if (errorCount === 0 && warningCount === 0) {
    overallCompliance = "compliant";
  } else if (errorCount === 0) {
    overallCompliance = "partially-compliant";
  } else {
    overallCompliance = "non-compliant";
  }

  // Top issues: unique issue descriptions from errors and warnings
  const topIssues = annotations
    .filter((a) => a.severity === "error" || a.severity === "warning")
    .map((a) => a.issue)
    .slice(0, 5);

  return { errorCount, warningCount, infoCount, passCount, overallCompliance, topIssues };
}

function computeOverallConfidence(annotations: ReviewAnnotation[]): "high" | "medium" | "low" {
  if (annotations.length === 0) return "low";
  const withCitations = annotations.filter((a) => a.citations.length > 0).length;
  const ratio = withCitations / annotations.length;
  if (ratio >= 0.6) return "high";
  if (ratio >= 0.3) return "medium";
  return "low";
}

/** Run async tasks with limited concurrency. */
async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let nextIdx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}
