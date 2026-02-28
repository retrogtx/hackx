"use client";

import { useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Upload,
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  FileText,
  BookPlus,
} from "lucide-react";

interface Citation {
  id: string;
  document: string;
  page?: number;
  section?: string;
  excerpt: string;
}

interface ReviewAnnotation {
  id: string;
  segmentIndex: number;
  startLine: number;
  endLine: number;
  originalText: string;
  severity: "error" | "warning" | "info" | "pass";
  category: string;
  issue: string;
  suggestedFix: string | null;
  citations: Citation[];
  confidence: "high" | "medium" | "low";
}

interface ReviewSummary {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  passCount: number;
  overallCompliance: "compliant" | "partially-compliant" | "non-compliant";
  topIssues: string[];
}

type ReviewState = "upload" | "reviewing" | "complete";

const SEVERITY_CONFIG = {
  error: { icon: AlertCircle, color: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", gutter: "bg-[#ef4444]", label: "Error" },
  warning: { icon: AlertTriangle, color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/20", gutter: "bg-[#f59e0b]", label: "Warning" },
  info: { icon: Info, color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10", border: "border-[#3b82f6]/20", gutter: "bg-[#3b82f6]", label: "Info" },
  pass: { icon: CheckCircle2, color: "text-[#00d4aa]", bg: "bg-[#00d4aa]/10", border: "border-[#00d4aa]/20", gutter: "bg-[#00d4aa]", label: "Pass" },
};

const COMPLIANCE_CONFIG = {
  "compliant": { color: "text-[#00d4aa]", bg: "bg-[#00d4aa]/10", border: "border-[#00d4aa]/20" },
  "partially-compliant": { color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/20" },
  "non-compliant": { color: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20" },
};

export default function ReviewPage() {
  const params = useParams();
  const pluginId = params.id as string;
  const [state, setState] = useState<ReviewState>("upload");
  const [documentText, setDocumentText] = useState("");
  const [title, setTitle] = useState("");
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [confidence, setConfidence] = useState<string>("");
  const [progress, setProgress] = useState("");
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);
  const slowHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const annotationPanelRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTitle(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDocumentText((ev.target?.result as string) || "");
    };
    reader.readAsText(file);
  }, []);

  async function handleApproveToKnowledge() {
    setApproving(true);
    try {
      const form = new FormData();
      form.append("text", documentText);
      form.append("fileName", title || "Reviewed Document");
      form.append("fileType", "markdown");

      const res = await fetch(`/api/plugins/${pluginId}/documents`, {
        method: "POST",
        body: form,
      });

      if (res.ok) {
        setApproved(true);
      } else {
        const data = await res.json();
        alert(`Failed to add: ${data.error || "Unknown error"}`);
      }
    } catch {
      alert("Failed to add document to knowledge base");
    } finally {
      setApproving(false);
    }
  }

  async function handleStartReview(e: React.FormEvent) {
    e.preventDefault();
    if (!documentText.trim()) return;

    setState("reviewing");
    setAnnotations([]);
    setSummary(null);
    setConfidence("");
    setProgress("Starting review...");
    setShowSlowHint(false);
    slowHintTimer.current = setTimeout(() => setShowSlowHint(true), 5000);

    try {
      const res = await fetch(`/api/plugins/${pluginId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: documentText,
          title: title || "Untitled Document",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setProgress(`Error: ${data.error}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

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
            const event = JSON.parse(line.slice(6));

            if (event.type === "status") {
              setProgress(event.message);
            } else if (event.type === "annotation") {
              setAnnotations((prev) => [...prev, event.annotation]);
            } else if (event.type === "batch_complete") {
              setProgress(event.message || `Completed batch ${event.batchIndex + 1} of ${event.totalBatches}`);
            } else if (event.type === "done") {
              if (slowHintTimer.current) clearTimeout(slowHintTimer.current);
              setAnnotations(event.annotations);
              setSummary(event.summary);
              setConfidence(event.confidence);
              setLatencyMs(event.latencyMs);
              setState("complete");
            } else if (event.type === "error") {
              setProgress(`Error: ${event.error}`);
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch {
      if (slowHintTimer.current) clearTimeout(slowHintTimer.current);
      setProgress("Failed to complete review");
    }
  }

  function scrollToAnnotation(annId: string) {
    setSelectedAnnotation(annId);
    const el = document.getElementById(`ann-detail-${annId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const documentLines = documentText.split("\n");

  // Build a map of line → annotations for gutter markers
  const lineAnnotationMap = new Map<number, ReviewAnnotation>();
  for (const ann of annotations) {
    if (ann.severity === "pass") continue;
    for (let l = ann.startLine; l <= ann.endLine; l++) {
      const existing = lineAnnotationMap.get(l);
      if (!existing || severityRank(ann.severity) > severityRank(existing.severity)) {
        lineAnnotationMap.set(l, ann);
      }
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="mb-4">
        <Link
          href={`/plugins/${pluginId}`}
          className="mb-2 inline-flex items-center text-sm text-[#666] transition-colors hover:text-white"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to plugin
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Expert Review</h1>
        </div>
        <p className="text-[#a1a1a1]">
          Upload a document to review it for compliance, errors, and best practices.
        </p>
      </div>

      {/* Upload State */}
      {state === "upload" && (
        <div className="flex-1">
          <form onSubmit={handleStartReview} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[#a1a1a1]">Document Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. API Specification v2.1"
                className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#a1a1a1]">Document Content</label>
              <textarea
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                placeholder="Paste your document here..."
                rows={12}
                className="w-full rounded-md border border-[#262626] bg-[#111111] px-3 py-2 font-mono text-sm text-white placeholder:text-[#555] focus:border-[#444] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-[#333] bg-[#111] text-[#a1a1a1] hover:border-[#444] hover:bg-[#1a1a1a] hover:text-white"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              <Button
                type="submit"
                disabled={!documentText.trim()}
                className="bg-white text-black hover:bg-[#ccc]"
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Start Review
              </Button>
            </div>

            {documentText && (
              <p className="text-xs text-[#666]">
                {documentText.length.toLocaleString()} characters, {documentText.split("\n").length} lines
              </p>
            )}
          </form>
        </div>
      )}

      {/* Reviewing State */}
      {state === "reviewing" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#a1a1a1]" />
          <p className="max-w-md truncate text-center text-[#a1a1a1]">{progress}</p>
          {annotations.length > 0 && (
            <p className="text-sm text-[#666]">
              {annotations.length} annotation{annotations.length !== 1 ? "s" : ""} found so far
            </p>
          )}
          {showSlowHint && (
            <p className="text-xs text-[#555]">
              This may take 5–10 minutes for a deep-researched result.
            </p>
          )}
        </div>
      )}

      {/* Complete State */}
      {state === "complete" && summary && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Summary Bar */}
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-[#262626] bg-[#0a0a0a] px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#666]" />
              <span className="text-sm font-medium text-white">{title || "Document"}</span>
            </div>
            <div className="flex items-center gap-2">
              {summary.errorCount > 0 && (
                <Badge className={`${SEVERITY_CONFIG.error.bg} ${SEVERITY_CONFIG.error.border} ${SEVERITY_CONFIG.error.color}`}>
                  {summary.errorCount} Error{summary.errorCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {summary.warningCount > 0 && (
                <Badge className={`${SEVERITY_CONFIG.warning.bg} ${SEVERITY_CONFIG.warning.border} ${SEVERITY_CONFIG.warning.color}`}>
                  {summary.warningCount} Warning{summary.warningCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {summary.infoCount > 0 && (
                <Badge className={`${SEVERITY_CONFIG.info.bg} ${SEVERITY_CONFIG.info.border} ${SEVERITY_CONFIG.info.color}`}>
                  {summary.infoCount} Info
                </Badge>
              )}
              {summary.passCount > 0 && (
                <Badge className={`${SEVERITY_CONFIG.pass.bg} ${SEVERITY_CONFIG.pass.border} ${SEVERITY_CONFIG.pass.color}`}>
                  {summary.passCount} Pass
                </Badge>
              )}
            </div>
            <Badge className={`${COMPLIANCE_CONFIG[summary.overallCompliance].bg} ${COMPLIANCE_CONFIG[summary.overallCompliance].border} ${COMPLIANCE_CONFIG[summary.overallCompliance].color}`}>
              {summary.overallCompliance}
            </Badge>
            {confidence && (
              <Badge className={`${confidence === "high" ? "border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#00d4aa]" : confidence === "medium" ? "border-[#f59e0b]/20 bg-[#f59e0b]/10 text-[#f59e0b]" : "border-[#ef4444]/20 bg-[#ef4444]/10 text-[#ef4444]"}`}>
                Confidence: {confidence}
              </Badge>
            )}
            <span className="ml-auto text-xs text-[#666]">{(latencyMs / 1000).toFixed(1)}s</span>
            {approved ? (
              <Button size="sm" disabled className="border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]">
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Added to Knowledge Base
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleApproveToKnowledge}
                disabled={approving}
                className="bg-white text-black hover:bg-[#ccc]"
              >
                {approving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BookPlus className="mr-1.5 h-3.5 w-3.5" />}
                {approving ? "Adding..." : "Approve & Add to Knowledge Base"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setState("upload"); setAnnotations([]); setSummary(null); setApproved(false); }}
              className="border-[#333] bg-[#111] text-[#a1a1a1] hover:border-[#444] hover:bg-[#1a1a1a] hover:text-white"
            >
              New Review
            </Button>
          </div>

          {/* Split Pane */}
          <div className="flex flex-1 gap-3 overflow-hidden">
            {/* Left: Document with line numbers and gutter */}
            <div className="flex w-[60%] flex-col overflow-hidden rounded-md border border-[#262626] bg-[#0a0a0a]">
              <div className="border-b border-[#262626] px-4 py-2">
                <p className="text-xs font-semibold text-[#666]">Document</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full border-collapse font-mono text-xs">
                  <tbody>
                    {documentLines.map((line, i) => {
                      const lineNum = i + 1;
                      const ann = lineAnnotationMap.get(lineNum);
                      const isHighlighted = ann && selectedAnnotation === ann.id;

                      return (
                        <tr
                          key={lineNum}
                          id={`line-${lineNum}`}
                          className={`group ${isHighlighted ? "bg-[#1a1a1a]" : "hover:bg-[#0f0f0f]"}`}
                          onClick={() => ann && scrollToAnnotation(ann.id)}
                          style={{ cursor: ann ? "pointer" : "default" }}
                        >
                          {/* Gutter marker */}
                          <td className="w-1 select-none px-0">
                            {ann && lineNum === ann.startLine && (
                              <div className={`h-full w-1 ${SEVERITY_CONFIG[ann.severity].gutter}`} />
                            )}
                            {ann && lineNum !== ann.startLine && (
                              <div className={`h-full w-1 ${SEVERITY_CONFIG[ann.severity].gutter} opacity-30`} />
                            )}
                          </td>
                          {/* Line number */}
                          <td className="w-10 select-none pr-3 text-right text-[#444]">{lineNum}</td>
                          {/* Content */}
                          <td className="whitespace-pre-wrap break-all py-0.5 pl-3 text-[#ccc]">{line || " "}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Annotation Panel */}
            <div
              ref={annotationPanelRef}
              className="flex w-[40%] flex-col overflow-y-auto rounded-md border border-[#262626] bg-[#0a0a0a]"
            >
              <div className="border-b border-[#262626] px-4 py-2">
                <p className="text-xs font-semibold text-[#666]">
                  Annotations ({annotations.filter((a) => a.severity !== "pass").length})
                </p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {annotations
                  .filter((a) => a.severity !== "pass")
                  .map((ann) => {
                    const cfg = SEVERITY_CONFIG[ann.severity];
                    const SevIcon = cfg.icon;
                    const isSelected = selectedAnnotation === ann.id;

                    return (
                      <div
                        key={ann.id}
                        id={`ann-detail-${ann.id}`}
                        className={`rounded-md border p-3 transition-colors ${isSelected ? `${cfg.border} ${cfg.bg}` : "border-[#262626] bg-[#111111] hover:border-[#333]"}`}
                        onClick={() => {
                          setSelectedAnnotation(ann.id);
                          const lineEl = document.getElementById(`line-${ann.startLine}`);
                          lineEl?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <SevIcon className={`h-4 w-4 ${cfg.color}`} />
                          <Badge className={`${cfg.bg} ${cfg.border} ${cfg.color} text-[10px]`}>
                            {cfg.label}
                          </Badge>
                          <span className="text-[10px] text-[#666]">
                            Lines {ann.startLine}–{ann.endLine}
                          </span>
                          <Badge className="ml-auto border-[#333] bg-[#111] text-[10px] text-[#888]">
                            {ann.category}
                          </Badge>
                        </div>
                        <p className="mb-1 text-sm text-[#ededed]">{ann.issue}</p>
                        {ann.originalText && (
                          <p className="mb-2 rounded bg-[#0a0a0a] px-2 py-1 font-mono text-xs text-[#888]">
                            {ann.originalText.slice(0, 120)}{ann.originalText.length > 120 ? "..." : ""}
                          </p>
                        )}
                        {ann.suggestedFix && (
                          <div className="mb-2">
                            <p className="text-[10px] font-semibold text-[#666]">Suggested Fix:</p>
                            <p className="text-xs text-[#00d4aa]">{ann.suggestedFix}</p>
                          </div>
                        )}
                        {ann.citations.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-[#666]">Sources:</p>
                            {ann.citations.map((c) => (
                              <div key={c.id} className="rounded bg-[#0a0a0a] p-1.5 text-[10px]">
                                <span className="font-semibold text-[#ccc]">{c.document}</span>
                                {c.section && <span className="text-[#666]"> — {c.section}</span>}
                                <p className="mt-0.5 text-[#777]">{c.excerpt}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {annotations.filter((a) => a.severity !== "pass").length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="mb-2 h-8 w-8 text-[#00d4aa]" />
                    <p className="text-sm text-[#a1a1a1]">No issues found!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function severityRank(s: string): number {
  switch (s) {
    case "error": return 3;
    case "warning": return 2;
    case "info": return 1;
    default: return 0;
  }
}
