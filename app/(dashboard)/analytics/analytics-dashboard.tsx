"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AnalyticsData {
  summary: {
    totalQueries: number;
    avgLatencyMs: number;
    medianLatencyMs: number;
    confidenceBreakdown: { high: number; medium: number; low: number };
    citationRate: number;
    avgCitationsPerQuery: number;
  };
  queriesOverTime: Array<{ date: string; count: number; avgLatencyMs: number }>;
  topQueries: Array<{ queryText: string; count: number; modeConfidence: string }>;
  topSources: Array<{ document: string; citationCount: number; avgSimilarity: number | null }>;
  topDecisionPaths: Array<{ label: string; count: number }>;
  plugins: Array<{ id: string; name: string }>;
}

const TIME_RANGES = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
] as const;

function confidenceBadge(confidence: string) {
  const colors: Record<string, string> = {
    high: "border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    low: "border-red-500/30 bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[confidence] || "border-[#333] bg-[#1a1a1a] text-[#a1a1a1]"}`}
    >
      {confidence}
    </span>
  );
}

export function AnalyticsDashboard({
  plugins,
}: {
  plugins: Array<{ id: string; name: string }>;
}) {
  const [range, setRange] = useState("7d");
  const [pluginId, setPluginId] = useState("all");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/analytics?range=${range}&pluginId=${pluginId}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Failed to load analytics");
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [range, pluginId]);

  const isEmpty = !loading && data && data.summary.totalQueries === 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-[#a1a1a1]">
            See how your plugins are performing
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time range pills */}
          <div className="flex items-center gap-1 rounded-md border border-[#262626] bg-[#111111] p-0.5">
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  range === r.value
                    ? "border border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa]"
                    : "text-[#666] hover:text-[#a1a1a1]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Plugin filter */}
          {plugins.length > 1 && (
            <Select value={pluginId} onValueChange={setPluginId}>
              <SelectTrigger className="h-8 w-[160px] border-[#262626] bg-[#111111] text-sm text-[#ededed]">
                <SelectValue placeholder="All plugins" />
              </SelectTrigger>
              <SelectContent className="border-[#262626] bg-[#111111]">
                <SelectItem value="all">All plugins</SelectItem>
                {plugins.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-[#ff4444]/30 bg-[#ff4444]/5 p-4">
          <p className="text-sm text-[#ff4444]">{error}</p>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : isEmpty ? (
        <EmptyState />
      ) : data ? (
        <>
          {/* Metric cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Total Queries"
              value={data.summary.totalQueries.toLocaleString()}
            />
            <MetricCard
              label="Avg Latency"
              value={`${data.summary.avgLatencyMs.toLocaleString()}ms`}
              sub={`Median: ${data.summary.medianLatencyMs.toLocaleString()}ms`}
            />
            <MetricCard
              label="Citation Rate"
              value={`${data.summary.citationRate}%`}
              sub={`${data.summary.avgCitationsPerQuery} avg/query`}
            />
            <MetricCard
              label="Confidence"
              value={null}
            >
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="text-[#00d4aa]">
                  H:{data.summary.confidenceBreakdown.high}
                </span>
                <span className="text-amber-400">
                  M:{data.summary.confidenceBreakdown.medium}
                </span>
                <span className="text-red-400">
                  L:{data.summary.confidenceBreakdown.low}
                </span>
              </div>
            </MetricCard>
          </div>

          {/* Chart */}
          {data.queriesOverTime.length > 0 && (
            <div className="mb-6 rounded-md border border-[#262626] bg-[#0a0a0a] p-4">
              <h2 className="mb-4 text-sm font-medium text-[#a1a1a1]">
                Queries Over Time
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.queriesOverTime}>
                  <defs>
                    <linearGradient id="queryFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#262626"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#666", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "#262626" }}
                    tickFormatter={(v: string) => {
                      const [, m, d] = v.split("-");
                      return `${Number(m)}/${Number(d)}`;
                    }}
                  />
                  <YAxis
                    tick={{ fill: "#666", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111111",
                      border: "1px solid #262626",
                      borderRadius: "6px",
                      color: "#ededed",
                      fontSize: "13px",
                    }}
                    labelFormatter={(v) => {
                      const [y, m, d] = String(v).split("-");
                      const date = new Date(Number(y), Number(m) - 1, Number(d));
                      return date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                    formatter={(value, name) => {
                      if (name === "count") return [value, "Queries"];
                      if (name === "avgLatencyMs")
                        return [`${value}ms`, "Avg Latency"];
                      return [value, String(name)];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#queryFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabbed tables */}
          <div className="rounded-md border border-[#262626] bg-[#0a0a0a]">
            <Tabs defaultValue="queries">
              <div className="border-b border-[#262626] px-4 pt-2">
                <TabsList className="bg-transparent">
                  <TabsTrigger value="queries">Top Queries</TabsTrigger>
                  <TabsTrigger value="sources">Top Sources</TabsTrigger>
                  <TabsTrigger value="paths">Decision Paths</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="queries" className="p-0">
                {data.topQueries.length === 0 ? (
                  <TableEmpty />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#262626] text-left text-[#666]">
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Query</th>
                        <th className="px-4 py-3 font-medium text-right">Count</th>
                        <th className="px-4 py-3 font-medium text-right">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topQueries.map((q, i) => (
                        <tr
                          key={i}
                          className="border-b border-[#1a1a1a] transition-colors hover:bg-[#111111]"
                        >
                          <td className="px-4 py-3 text-[#666]">{i + 1}</td>
                          <td className="max-w-[300px] truncate px-4 py-3 text-[#ededed]">
                            {q.queryText}
                          </td>
                          <td className="px-4 py-3 text-right text-[#ededed]">
                            {q.count}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {confidenceBadge(q.modeConfidence)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </TabsContent>

              <TabsContent value="sources" className="p-0">
                {data.topSources.length === 0 ? (
                  <TableEmpty />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#262626] text-left text-[#666]">
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Document</th>
                        <th className="px-4 py-3 font-medium text-right">Citations</th>
                        <th className="px-4 py-3 font-medium text-right">Avg Similarity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topSources.map((s, i) => (
                        <tr
                          key={i}
                          className="border-b border-[#1a1a1a] transition-colors hover:bg-[#111111]"
                        >
                          <td className="px-4 py-3 text-[#666]">{i + 1}</td>
                          <td className="max-w-[300px] truncate px-4 py-3 text-[#ededed]">
                            {s.document}
                          </td>
                          <td className="px-4 py-3 text-right text-[#ededed]">
                            {s.citationCount}
                          </td>
                          <td className="px-4 py-3 text-right text-[#a1a1a1]">
                            {s.avgSimilarity != null
                              ? `${(s.avgSimilarity * 100).toFixed(0)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </TabsContent>

              <TabsContent value="paths" className="p-0">
                {data.topDecisionPaths.length === 0 ? (
                  <TableEmpty />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#262626] text-left text-[#666]">
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Decision Node</th>
                        <th className="px-4 py-3 font-medium text-right">Traversals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topDecisionPaths.map((d, i) => (
                        <tr
                          key={i}
                          className="border-b border-[#1a1a1a] transition-colors hover:bg-[#111111]"
                        >
                          <td className="px-4 py-3 text-[#666]">{i + 1}</td>
                          <td className="max-w-[300px] truncate px-4 py-3 text-[#ededed]">
                            {d.label}
                          </td>
                          <td className="px-4 py-3 text-right text-[#ededed]">
                            {d.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value: string | null;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#262626] bg-[#0a0a0a] p-4">
      <p className="text-xs font-medium text-[#a1a1a1]">{label}</p>
      {value !== null && (
        <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      )}
      {sub && <p className="mt-0.5 text-xs text-[#666]">{sub}</p>}
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-[#333] py-16">
      <BarChart3 className="mb-3 h-10 w-10 text-[#333]" />
      <p className="mb-1 text-sm font-medium text-[#a1a1a1]">
        No analytics yet
      </p>
      <p className="text-xs text-[#666]">
        Query your plugins through the sandbox or API to see data here
      </p>
    </div>
  );
}

function TableEmpty() {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-[#666]">
      No data for this time range
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-md border border-[#262626] bg-[#0a0a0a] p-4"
          >
            <div className="mb-2 h-3 w-16 animate-pulse rounded bg-[#1a1a1a]" />
            <div className="h-7 w-24 animate-pulse rounded bg-[#1a1a1a]" />
          </div>
        ))}
      </div>
      <div className="h-[280px] animate-pulse rounded-md border border-[#262626] bg-[#0a0a0a]" />
      <div className="h-[300px] animate-pulse rounded-md border border-[#262626] bg-[#0a0a0a]" />
    </div>
  );
}
