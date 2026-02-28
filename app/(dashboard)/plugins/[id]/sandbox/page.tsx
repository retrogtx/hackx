"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Loader2, Bot, User, ShieldCheck } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{
    id: string;
    document: string;
    page?: number;
    section?: string;
    excerpt: string;
  }>;
  confidence?: string;
  decisionPath?: Array<{
    step: number;
    label: string;
    value?: string;
    result?: string;
  }>;
  sources?: Array<{
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
  }>;
  trust?: {
    sourceOfTruth: "plugin_knowledge_base";
    retrievalThreshold: number;
    retrievedSourceCount: number;
    citedSourceCount: number;
    sourceCoverage: number;
    unresolvedCitationRefs: number[];
    trustedSourceCount: number;
    trustLevel: "high" | "medium" | "low";
    notes: string[];
  };
}

interface PluginInfo {
  name: string;
  slug: string;
  isPublished: boolean;
}

export default function SandboxPage() {
  const params = useParams();
  const pluginId = params.id as string;
  const [plugin, setPlugin] = useState<PluginInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadPlugin = useCallback(async () => {
    const res = await fetch(`/api/plugins/${pluginId}`);
    if (res.ok) setPlugin(await res.json());
  }, [pluginId]);

  useEffect(() => {
    loadPlugin();
  }, [loadPlugin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || !plugin) return;

    const query = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/sandbox/${pluginId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer,
            citations: data.citations,
            confidence: data.confidence,
            decisionPath: data.decisionPath,
            sources: data.sources,
            trust: data.trust,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to get response" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <Link
          href={`/plugins/${pluginId}`}
          className="mb-2 inline-flex items-center text-sm text-[#666] transition-colors hover:text-white"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to plugin
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Test Sandbox</h1>
          {plugin && (
            <Badge variant="outline" className="border-[#333] text-[#888]">{plugin.name}</Badge>
          )}
        </div>
        <p className="text-[#a1a1a1]">
          Chat with your plugin to test responses, citations, and decision tree behavior
        </p>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-[#262626] bg-[#0a0a0a]">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <Bot className="mx-auto mb-3 h-12 w-12 text-[#333]" />
                <p className="text-[#a1a1a1]">
                  Ask a question to test your plugin
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] border border-[#262626]">
                      <Bot className="h-4 w-4 text-[#a1a1a1]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-md px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-white text-black"
                        : "border border-[#262626] bg-[#111111]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>

                    {msg.confidence && (
                      <Badge
                        className={`mt-2 ${
                          msg.confidence === "high"
                            ? "bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20"
                            : msg.confidence === "medium"
                              ? "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20"
                              : "bg-[#ff4444]/10 text-[#ff4444] border-[#ff4444]/20"
                        }`}
                      >
                        Confidence: {msg.confidence}
                      </Badge>
                    )}

                    {msg.trust && (
                      <div className="mt-3 space-y-2 rounded-md border border-[#262626] bg-[#0a0a0a] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-[#00d4aa]" />
                            <p className="text-xs font-semibold text-[#ededed]">Trust Panel</p>
                          </div>
                          <Badge
                            className={`text-[10px] ${
                              msg.trust.trustLevel === "high"
                                ? "bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20"
                                : msg.trust.trustLevel === "medium"
                                  ? "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20"
                                  : "bg-[#ff4444]/10 text-[#ff4444] border-[#ff4444]/20"
                            }`}
                          >
                            {msg.trust.trustLevel.toUpperCase()} TRUST
                          </Badge>
                        </div>
                        <div className="grid gap-2 text-xs text-[#888] sm:grid-cols-3">
                          <div>Retrieved: <span className="text-[#ededed]">{msg.trust.retrievedSourceCount}</span></div>
                          <div>Cited: <span className="text-[#ededed]">{msg.trust.citedSourceCount}</span></div>
                          <div>Coverage: <span className="text-[#ededed]">{Math.round(msg.trust.sourceCoverage * 100)}%</span></div>
                        </div>
                        <div className="space-y-1">
                          {msg.trust.notes.map((note, noteIdx) => (
                            <p key={noteIdx} className="text-xs text-[#777]">{note}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-[#262626] pt-2">
                        <p className="text-xs font-semibold text-[#666]">Source Evidence</p>
                        <div className="space-y-2">
                          {msg.sources.map((source) => (
                            <div
                              key={source.id}
                              className="rounded-lg border border-[#262626] bg-[#1a1a1a] p-2.5 text-xs"
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Badge className="border-[#333] bg-[#111] text-[#aaa]">
                                    {source.citationRef}
                                  </Badge>
                                  <span className="font-semibold text-[#ededed]">{source.document}</span>
                                  <span className="text-[#666]">({source.fileType})</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge className="border-[#333] bg-[#111] text-[#999]">
                                    sim {Math.round(source.similarity * 100)}%
                                  </Badge>
                                  {source.cited && (
                                    <Badge className="border-[#00d4aa]/20 bg-[#00d4aa]/10 text-[#00d4aa]">
                                      used
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {(source.section || source.page) && (
                                <p className="mb-1 text-[#777]">
                                  {source.section ? `Section: ${source.section}` : ""}
                                  {source.section && source.page ? " • " : ""}
                                  {source.page ? `Page: ${source.page}` : ""}
                                </p>
                              )}
                              <p className="text-[#888]">{source.excerpt}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-[#262626] pt-2">
                        <p className="text-xs font-semibold text-[#666]">Sources:</p>
                        {msg.citations.map((c) => (
                          <div
                            key={c.id}
                            className="rounded-lg bg-[#1a1a1a] p-2 text-xs"
                          >
                            <span className="font-semibold text-[#ededed]">{c.document}</span>
                            {c.section && (
                              <span className="text-[#666]"> — {c.section}</span>
                            )}
                            <p className="mt-1 text-[#888]">{c.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.decisionPath && msg.decisionPath.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-[#262626] pt-2">
                        <p className="text-xs font-semibold text-[#666]">
                          Decision Path:
                        </p>
                        {msg.decisionPath.map((step) => (
                          <div key={step.step} className="text-xs text-[#888]">
                            {step.step}. {step.label}
                            {step.value && ` → ${step.value}`}
                            {step.result && ` → ${step.result}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] border border-[#262626]">
                      <User className="h-4 w-4 text-[#a1a1a1]" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] border border-[#262626]">
                    <Bot className="h-4 w-4 text-[#a1a1a1]" />
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-[#262626] bg-[#111111] px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-[#a1a1a1]" />
                    <span className="text-sm text-[#a1a1a1]">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-[#262626] p-4">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading}
              className="border-[#262626] bg-[#111111] text-white placeholder:text-[#555] focus:border-[#444] focus:ring-0"
            />
            <Button type="submit" disabled={loading || !input.trim()} className="bg-white text-black hover:bg-[#ccc]">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
