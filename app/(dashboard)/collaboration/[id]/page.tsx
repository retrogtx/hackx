"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Send,
  Users,
  Brain,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Swords,
  RefreshCw,
} from "lucide-react";

interface ExpertInfo {
  slug: string;
  name: string;
  domain: string;
  sourceCount?: number;
  hasDecisionTree?: boolean;
}

interface ExpertResponseData {
  pluginSlug: string;
  pluginName: string;
  domain: string;
  answer: string;
  citations: Array<{ id: string; document: string; excerpt: string }>;
  confidence: "high" | "medium" | "low";
  revised: boolean;
}

interface RoundData {
  roundNumber: number;
  responses: ExpertResponseData[];
}

interface Conflict {
  topic: string;
  positions: Array<{ expert: string; stance: string }>;
  resolved: boolean;
  resolution?: string;
}

interface ConsensusData {
  answer: string;
  confidence: "high" | "medium" | "low";
  agreementLevel: number;
  citations: Array<{ id: string; document: string; excerpt: string }>;
  conflicts: Conflict[];
  expertContributions: Array<{ expert: string; domain: string; keyPoints: string[] }>;
}

interface RoomInfo {
  id: string;
  name: string;
  mode: "debate" | "consensus" | "review";
  expertSlugs: string[];
  maxRounds: number;
  expertDetails: ExpertInfo[];
}

type StreamPhase =
  | "idle"
  | "resolving"
  | "deliberating"
  | "synthesizing"
  | "done"
  | "error";

const EXPERT_COLORS = [
  { border: "border-[#f59e0b]", bg: "bg-[#f59e0b]/10", text: "text-[#f59e0b]", dot: "bg-[#f59e0b]" },
  { border: "border-[#818cf8]", bg: "bg-[#818cf8]/10", text: "text-[#818cf8]", dot: "bg-[#818cf8]" },
  { border: "border-[#00d4aa]", bg: "bg-[#00d4aa]/10", text: "text-[#00d4aa]", dot: "bg-[#00d4aa]" },
  { border: "border-[#f472b6]", bg: "bg-[#f472b6]/10", text: "text-[#f472b6]", dot: "bg-[#f472b6]" },
  { border: "border-[#fb923c]", bg: "bg-[#fb923c]/10", text: "text-[#fb923c]", dot: "bg-[#fb923c]" },
];

const CONFIDENCE_STYLES = {
  high: "border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]",
  medium: "border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f59e0b]",
  low: "border-[#ff4444]/30 bg-[#ff4444]/10 text-[#ff4444]",
};

function getExpertColor(index: number) {
  return EXPERT_COLORS[index % EXPERT_COLORS.length];
}

export default function CollaborationRoomPage() {
  const params = useParams();
  const roomId = params.id as string;
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<StreamPhase>("idle");
  const [experts, setExperts] = useState<ExpertInfo[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [thinkingExpert, setThinkingExpert] = useState<string | null>(null);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [consensus, setConsensus] = useState<ConsensusData | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadRoom = useCallback(async () => {
    const res = await fetch(`/api/collaboration-rooms/${roomId}`);
    if (res.ok) {
      const data = await res.json();
      setRoom(data);
      setExperts(data.expertDetails || []);
    }
  }, [roomId]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rounds, consensus, thinkingExpert]);

  function resetState() {
    setPhase("idle");
    setExperts(room?.expertDetails || []);
    setCurrentRound(0);
    setTotalRounds(0);
    setThinkingExpert(null);
    setRounds([]);
    setConsensus(null);
    setStatusMessage("");
    setErrorMessage("");
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || phase === "deliberating" || phase === "synthesizing" || !room) return;

    const query = input.trim();
    setInput("");
    resetState();
    setPhase("resolving");
    setStatusMessage("Assembling expert panel...");

    try {
      const res = await fetch("/api/collaboration-rooms/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, query }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPhase("error");
        setErrorMessage(data.error || "Failed to start collaboration");
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
            handleStreamEvent(event);
          } catch { /* skip */ }
        }
      }
    } catch {
      setPhase("error");
      setErrorMessage("Connection lost");
    }
  }

  function handleStreamEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    if (type === "status") {
      setStatusMessage(event.message as string);
      if (event.status === "synthesizing") setPhase("synthesizing");
    } else if (type === "experts_resolved") {
      const resolvedExperts = event.experts as ExpertInfo[];
      setExperts(resolvedExperts);
      setPhase("deliberating");
    } else if (type === "round_start") {
      setCurrentRound(event.round as number);
      setTotalRounds(event.totalRounds as number);
    } else if (type === "expert_thinking") {
      setThinkingExpert(event.expert as string);
      setStatusMessage(event.message as string);
    } else if (type === "expert_response") {
      setThinkingExpert(null);
      const resp: ExpertResponseData & { round: number } = {
        round: event.round as number,
        pluginSlug: (event.expert as string) || (event.pluginSlug as string) || "",
        pluginName: (event.expertName as string) || (event.pluginName as string) || "",
        domain: event.domain as string,
        answer: event.answer as string,
        citations: (event.citations as ExpertResponseData["citations"]) || [],
        confidence: (event.confidence as ExpertResponseData["confidence"]) || "low",
        revised: (event.revised as boolean) || false,
      };
      setRounds((prev) => {
        const updated = [...prev];
        const roundIdx = updated.findIndex((r) => r.roundNumber === resp.round);
        if (roundIdx >= 0) {
          updated[roundIdx] = {
            ...updated[roundIdx],
            responses: [...updated[roundIdx].responses, resp],
          };
        } else {
          updated.push({ roundNumber: resp.round, responses: [resp] });
        }
        return updated;
      });
    } else if (type === "round_complete") {
      setThinkingExpert(null);
    } else if (type === "done") {
      setConsensus(event.consensus as ConsensusData);
      setPhase("done");
      setThinkingExpert(null);
    } else if (type === "error") {
      setPhase("error");
      setErrorMessage(event.error as string);
    }
  }

  function expertIndex(slug: string): number {
    return experts.findIndex((e) => e.slug === slug);
  }

  const isActive = phase === "deliberating" || phase === "synthesizing" || phase === "resolving";

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <Link
          href="/collaboration"
          className="mb-2 inline-flex items-center text-sm text-[#666] hover:text-white"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to rooms
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{room?.name || "Loading..."}</h1>
          {room && (
            <Badge className={
              room.mode === "debate" ? "border-[#f59e0b]/20 bg-[#f59e0b]/10 text-[#f59e0b]" :
              room.mode === "consensus" ? "border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#00d4aa]" :
              "border-[#818cf8]/20 bg-[#818cf8]/10 text-[#818cf8]"
            }>
              {room.mode}
            </Badge>
          )}
        </div>
        {experts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {experts.map((exp, i) => {
              const color = getExpertColor(i);
              return (
                <Badge key={exp.slug} className={`${color.border} ${color.bg} ${color.text}`}>
                  {exp.name}
                  {exp.sourceCount !== undefined && (
                    <span className="ml-1 opacity-60">({exp.sourceCount} sources)</span>
                  )}
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[#262626] bg-[#0a0a0a]">
        <div className="flex-1 overflow-y-auto p-4">
          {phase === "idle" && rounds.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <Users className="mx-auto mb-3 h-12 w-12 text-[#333]" />
                <p className="text-[#a1a1a1]">
                  Ask a cross-domain question to start the expert deliberation
                </p>
                <p className="mt-1 text-xs text-[#666]">
                  {room?.mode === "debate" && "Experts will debate across multiple rounds, then reach consensus."}
                  {room?.mode === "consensus" && "All experts answer independently, then a consensus is synthesized."}
                  {room?.mode === "review" && "One expert answers first, then others critique and refine."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status bar */}
              {isActive && (
                <div className="flex items-center gap-2 rounded-md border border-[#262626] bg-[#111] px-3 py-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-[#888]" />
                  <span className="text-[#a1a1a1]">{statusMessage}</span>
                  {currentRound > 0 && totalRounds > 0 && (
                    <Badge variant="outline" className="ml-auto border-[#333] text-[#666]">
                      Round {currentRound}/{totalRounds}
                    </Badge>
                  )}
                </div>
              )}

              {/* Rounds */}
              {rounds.map((round) => (
                <div key={round.roundNumber} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-[#262626]" />
                    <span className="text-xs font-semibold text-[#555]">
                      Round {round.roundNumber}
                    </span>
                    <div className="h-px flex-1 bg-[#262626]" />
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {round.responses.map((resp, respIdx) => {
                      const idx = expertIndex(resp.pluginSlug);
                      const color = getExpertColor(idx >= 0 ? idx : respIdx);
                      return (
                        <div
                          key={`${round.roundNumber}-${respIdx}-${resp.pluginSlug}`}
                          className={`rounded-lg border ${color.border} bg-[#111] p-4`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
                              <span className={`font-semibold ${color.text}`}>
                                {resp.pluginName}
                              </span>
                              <Badge variant="outline" className="border-[#333] text-[#666] text-[10px]">
                                {resp.domain}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {resp.revised && (
                                <Badge className="border-[#818cf8]/20 bg-[#818cf8]/10 text-[#818cf8] text-[10px]">
                                  <RefreshCw className="mr-1 h-2.5 w-2.5" /> revised
                                </Badge>
                              )}
                              <Badge className={`text-[10px] ${CONFIDENCE_STYLES[resp.confidence]}`}>
                                {resp.confidence}
                              </Badge>
                            </div>
                          </div>

                          <p className="whitespace-pre-wrap text-sm text-[#d4d4d4]">
                            {resp.answer}
                          </p>

                          {resp.citations.length > 0 && (
                            <div className="mt-2 space-y-1 border-t border-[#1f1f1f] pt-2">
                              {resp.citations.slice(0, 3).map((c) => (
                                <div key={c.id} className="text-xs text-[#666]">
                                  <span className="font-medium text-[#888]">{c.document}</span>
                                  {" — "}
                                  {c.excerpt.slice(0, 100)}...
                                </div>
                              ))}
                              {resp.citations.length > 3 && (
                                <p className="text-xs text-[#555]">
                                  +{resp.citations.length - 3} more citations
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Thinking indicator */}
                  {thinkingExpert && currentRound === round.roundNumber && (
                    <div className="flex items-center gap-2 rounded-md border border-[#262626] bg-[#111] px-3 py-2 text-sm">
                      <Brain className="h-4 w-4 animate-pulse text-[#888]" />
                      <span className="text-[#888]">
                        {experts.find((e) => e.slug === thinkingExpert)?.name || thinkingExpert} is analyzing...
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Synthesizing indicator */}
              {phase === "synthesizing" && (
                <div className="flex items-center gap-2 rounded-md border border-[#262626] bg-[#111] px-3 py-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-[#00d4aa]" />
                  <span className="text-[#00d4aa]">Synthesizing consensus from all experts...</span>
                </div>
              )}

              {/* Consensus Panel */}
              {consensus && (
                <div className="rounded-lg border-2 border-[#00d4aa]/30 bg-[#0a0a0a] p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-[#00d4aa]" />
                      <h3 className="font-bold text-white">Consensus</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={CONFIDENCE_STYLES[consensus.confidence]}>
                        {consensus.confidence} confidence
                      </Badge>
                      <Badge className="border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#00d4aa]">
                        {Math.round(consensus.agreementLevel * 100)}% agreement
                      </Badge>
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap text-sm text-[#ededed]">
                    {consensus.answer}
                  </p>

                  {/* Expert Contributions */}
                  {consensus.expertContributions.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-[#262626] pt-3">
                      <p className="text-xs font-semibold text-[#666]">Expert Contributions</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {consensus.expertContributions.map((contrib, i) => {
                          const idx = experts.findIndex((e) => e.name === contrib.expert);
                          const color = getExpertColor(idx >= 0 ? idx : i);
                          return (
                            <div
                              key={i}
                              className={`rounded-md border ${color.border} p-2.5`}
                            >
                              <div className="flex items-center gap-1.5">
                                <div className={`h-2 w-2 rounded-full ${color.dot}`} />
                                <span className={`text-xs font-semibold ${color.text}`}>
                                  {contrib.expert}
                                </span>
                                <span className="text-[10px] text-[#666]">({contrib.domain})</span>
                              </div>
                              {contrib.keyPoints.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {contrib.keyPoints.map((point, pi) => (
                                    <li key={pi} className="text-xs text-[#888]">
                                      • {point}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Conflicts */}
                  {consensus.conflicts.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-[#262626] pt-3">
                      <p className="text-xs font-semibold text-[#666]">
                        <Swords className="mr-1 inline h-3 w-3" />
                        Conflicts Identified
                      </p>
                      {consensus.conflicts.map((conflict, i) => (
                        <div
                          key={i}
                          className={`rounded-md border p-2.5 ${
                            conflict.resolved
                              ? "border-[#00d4aa]/20 bg-[#00d4aa]/5"
                              : "border-[#ff4444]/20 bg-[#ff4444]/5"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            {conflict.resolved ? (
                              <CheckCircle2 className="h-3 w-3 text-[#00d4aa]" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 text-[#ff4444]" />
                            )}
                            <span className="text-xs font-semibold text-[#ededed]">
                              {conflict.topic}
                            </span>
                            <Badge className={`text-[10px] ${
                              conflict.resolved
                                ? "border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#00d4aa]"
                                : "border-[#ff4444]/20 bg-[#ff4444]/10 text-[#ff4444]"
                            }`}>
                              {conflict.resolved ? "resolved" : "unresolved"}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {conflict.positions.map((pos, pi) => (
                              <p key={pi} className="text-xs text-[#888]">
                                <span className="font-medium text-[#aaa]">{pos.expert}:</span>{" "}
                                {pos.stance}
                              </p>
                            ))}
                          </div>
                          {conflict.resolution && (
                            <p className="mt-1 text-xs text-[#00d4aa]/80">
                              Resolution: {conflict.resolution}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Citations */}
                  {consensus.citations.length > 0 && (
                    <div className="mt-4 space-y-1 border-t border-[#262626] pt-3">
                      <p className="text-xs font-semibold text-[#666]">
                        Combined Citations ({consensus.citations.length})
                      </p>
                      {consensus.citations.slice(0, 5).map((c) => (
                        <div key={c.id} className="text-xs text-[#666]">
                          <span className="font-medium text-[#888]">{c.document}</span>
                          {" — "}{c.excerpt.slice(0, 120)}...
                        </div>
                      ))}
                      {consensus.citations.length > 5 && (
                        <p className="text-xs text-[#555]">
                          +{consensus.citations.length - 5} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {phase === "error" && (
                <div className="rounded-md border border-[#ff4444]/30 bg-[#ff4444]/5 p-4 text-sm text-[#ff4444]">
                  <AlertTriangle className="mb-1 inline h-4 w-4" /> {errorMessage}
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          )}
        </div>

        <div className="border-t border-[#262626] p-4">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a cross-domain question..."
              disabled={isActive}
              className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
            />
            <Button
              type="submit"
              disabled={isActive || !input.trim()}
              className="bg-white text-black hover:bg-[#ccc]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
