"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Bot, User, Search, Globe, Brain, Database, CheckCircle2, Loader2 } from "lucide-react";

interface Citation {
  id: string;
  document: string;
  page?: number;
  section?: string;
  excerpt: string;
}

interface StatusStep {
  status: string;
  message: string;
  done?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: string;
  decisionPath?: Array<{
    step: number;
    label: string;
    value?: string;
    result?: string;
  }>;
  streaming?: boolean;
  statusSteps?: StatusStep[];
}

interface PluginInfo {
  name: string;
  slug: string;
  isPublished: boolean;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  searching_kb: <Database className="h-3 w-3" />,
  kb_results: <CheckCircle2 className="h-3 w-3" />,
  decision_tree: <Brain className="h-3 w-3" />,
  generating: <Brain className="h-3 w-3" />,
  web_search: <Globe className="h-3 w-3" />,
  web_search_done: <CheckCircle2 className="h-3 w-3" />,
};

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

    const userMsg: Message = { role: "user", content: query };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true, statusSteps: [] };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    const assistantIdx = messages.length + 1;

    try {
      const res = await fetch(`/api/sandbox/${pluginId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = { role: "assistant", content: `Error: ${data.error}`, streaming: false };
          return updated;
        });
        setLoading(false);
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
              setMessages((prev) => {
                const updated = [...prev];
                const msg = { ...updated[assistantIdx] };
                const steps = [...(msg.statusSteps || [])];

                // Mark previous step of same category as done
                if (event.status === "kb_results") {
                  const idx = steps.findIndex((s) => s.status === "searching_kb");
                  if (idx >= 0) steps[idx] = { ...steps[idx], done: true };
                }
                if (event.status === "web_search_done") {
                  const idx = steps.findIndex((s) => s.status === "web_search" && !s.done);
                  if (idx >= 0) steps[idx] = { ...steps[idx], done: true };
                }

                steps.push({ status: event.status, message: event.message });
                msg.statusSteps = steps;
                updated[assistantIdx] = msg;
                return updated;
              });
            } else if (event.type === "delta") {
              setMessages((prev) => {
                const updated = [...prev];
                const msg = { ...updated[assistantIdx] };
                msg.content += event.text;
                updated[assistantIdx] = msg;
                return updated;
              });
            } else if (event.type === "done") {
              setMessages((prev) => {
                const updated = [...prev];
                const msg = { ...updated[assistantIdx] };
                msg.citations = event.citations;
                msg.confidence = event.confidence;
                msg.decisionPath = event.decisionPath;
                msg.streaming = false;
                updated[assistantIdx] = msg;
                return updated;
              });
            } else if (event.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[assistantIdx] = { role: "assistant", content: `Error: ${event.error}`, streaming: false };
                return updated;
              });
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      // Ensure streaming flag is cleared
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[assistantIdx]?.streaming) {
          updated[assistantIdx] = { ...updated[assistantIdx], streaming: false };
        }
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[assistantIdx]) {
          updated[assistantIdx] = {
            role: "assistant",
            content: updated[assistantIdx].content || "Failed to get response",
            streaming: false,
          };
        }
        return updated;
      });
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
                    {/* Status steps (thinking/searching) */}
                    {msg.role === "assistant" && msg.statusSteps && msg.statusSteps.length > 0 && (
                      <div className="mb-3 space-y-1.5">
                        {msg.statusSteps.map((step, si) => (
                          <div key={si} className="flex items-center gap-2 text-xs">
                            <span className={step.done ? "text-[#00d4aa]" : "text-[#666]"}>
                              {step.done ? (
                                STATUS_ICONS[step.status] || <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                !msg.content && si === msg.statusSteps!.length - 1 ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  STATUS_ICONS[step.status] || <Search className="h-3 w-3" />
                                )
                              )}
                            </span>
                            <span className={step.done ? "text-[#555] line-through" : "text-[#888]"}>
                              {step.message}
                            </span>
                          </div>
                        ))}
                        {msg.content && (
                          <div className="border-b border-[#1f1f1f] mt-2 mb-1" />
                        )}
                      </div>
                    )}

                    {/* Message content */}
                    {msg.content ? (
                      <p className="whitespace-pre-wrap text-sm">
                        {msg.content}
                        {msg.streaming && (
                          <span className="inline-block ml-0.5 w-1.5 h-4 bg-[#a1a1a1] animate-pulse rounded-sm" />
                        )}
                      </p>
                    ) : msg.streaming ? null : (
                      <p className="text-sm text-[#666] italic">No response generated</p>
                    )}

                    {/* Confidence badge */}
                    {msg.confidence && !msg.streaming && (
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

                    {/* Citations */}
                    {msg.citations && msg.citations.length > 0 && !msg.streaming && (
                      <div className="mt-3 space-y-2 border-t border-[#262626] pt-2">
                        <p className="text-xs font-semibold text-[#666]">Sources:</p>
                        {msg.citations.map((c) => (
                          <div key={c.id} className="rounded-lg bg-[#1a1a1a] p-2 text-xs">
                            <span className="font-semibold text-[#ededed]">{c.document}</span>
                            {c.section && (
                              <span className="text-[#666]"> — {c.section}</span>
                            )}
                            <p className="mt-1 text-[#888]">{c.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Decision path */}
                    {msg.decisionPath && msg.decisionPath.length > 0 && !msg.streaming && (
                      <div className="mt-3 space-y-1 border-t border-[#262626] pt-2">
                        <p className="text-xs font-semibold text-[#666]">Decision Path:</p>
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
