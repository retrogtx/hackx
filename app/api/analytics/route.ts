import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rangeToInterval(range: string): string | null {
  switch (range) {
    case "7d": return "7 days";
    case "30d": return "30 days";
    case "90d": return "90 days";
    case "all": return null;
    default: return "7 days";
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = req.nextUrl;
    const range = searchParams.get("range") || "7d";
    const pluginIdParam = searchParams.get("pluginId") || "all";

    // Get user's plugins
    const userPlugins = await db.query.plugins.findMany({
      where: eq(plugins.creatorId, user.id),
      columns: { id: true, name: true },
    });

    if (userPlugins.length === 0) {
      return NextResponse.json({
        summary: { totalQueries: 0, avgLatencyMs: 0, medianLatencyMs: 0, confidenceBreakdown: { high: 0, medium: 0, low: 0 }, citationRate: 0, avgCitationsPerQuery: 0 },
        queriesOverTime: [],
        topQueries: [],
        topSources: [],
        topDecisionPaths: [],
        plugins: [],
      });
    }

    const pluginIds = userPlugins.map((p) => p.id);

    // Validate pluginId param
    let targetPluginIds: string[];
    if (pluginIdParam === "all") {
      targetPluginIds = pluginIds;
    } else {
      if (!UUID_RE.test(pluginIdParam)) {
        return NextResponse.json({ error: "Invalid plugin ID format" }, { status: 400 });
      }
      if (!pluginIds.includes(pluginIdParam)) {
        return NextResponse.json({ error: "Plugin not found or not owned by you" }, { status: 403 });
      }
      targetPluginIds = [pluginIdParam];
    }

    const interval = rangeToInterval(range);
    const dateFilter = interval
      ? sql`AND ql.created_at >= NOW() - ${interval}::interval`
      : sql``;
    const pluginFilter = sql`ql.plugin_id IN (${sql.join(targetPluginIds.map((id) => sql`${id}`), sql`, `)})`;

    // 7 parallel queries
    const [summaryResult, confidenceResult, overTimeResult, topQueriesResult, topSourcesResult, decisionPathsResult, citationRateResult] = await Promise.all([
      // 1. Summary stats
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total_queries,
          COALESCE(AVG(ql.latency_ms), 0)::float AS avg_latency_ms,
          COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ql.latency_ms), 0)::float AS median_latency_ms
        FROM query_logs ql
        WHERE ${pluginFilter} ${dateFilter}
      `),

      // 2. Confidence breakdown
      db.execute(sql`
        SELECT
          COALESCE(ql.confidence, 'unknown') AS confidence,
          COUNT(*)::int AS count
        FROM query_logs ql
        WHERE ${pluginFilter} ${dateFilter}
        GROUP BY ql.confidence
      `),

      // 3. Queries over time
      db.execute(sql`
        SELECT
          date_trunc('day', ql.created_at)::date::text AS date,
          COUNT(*)::int AS count,
          COALESCE(AVG(ql.latency_ms), 0)::float AS avg_latency_ms
        FROM query_logs ql
        WHERE ${pluginFilter} ${dateFilter}
        GROUP BY date_trunc('day', ql.created_at)
        ORDER BY date_trunc('day', ql.created_at)
      `),

      // 4. Top queries
      db.execute(sql`
        SELECT
          ql.query_text,
          COUNT(*)::int AS count,
          MODE() WITHIN GROUP (ORDER BY COALESCE(ql.confidence, 'unknown')) AS mode_confidence
        FROM query_logs ql
        WHERE ${pluginFilter} ${dateFilter}
        GROUP BY ql.query_text
        ORDER BY count DESC
        LIMIT 10
      `),

      // 5. Top sources from citations JSONB
      db.execute(sql`
        SELECT
          COALESCE(c->>'document', 'Unknown') AS document,
          COUNT(*)::int AS citation_count,
          AVG(CASE WHEN c->>'similarity' ~ '^[0-9]*\.?[0-9]+$' THEN (c->>'similarity')::float ELSE NULL END) AS avg_similarity
        FROM query_logs ql,
          LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(ql.citations) = 'array' AND jsonb_array_length(ql.citations) > 0
              THEN ql.citations ELSE '[]'::jsonb END
          ) AS c
        WHERE ${pluginFilter} ${dateFilter}
          AND c->>'document' IS NOT NULL
        GROUP BY c->>'document'
        ORDER BY citation_count DESC
        LIMIT 10
      `),

      // 6. Decision path usage
      db.execute(sql`
        SELECT
          COALESCE(d->>'label', 'Unnamed') AS label,
          COUNT(*)::int AS count
        FROM query_logs ql,
          LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(ql.decision_path) = 'array' AND jsonb_array_length(ql.decision_path) > 0
              THEN ql.decision_path ELSE '[]'::jsonb END
          ) AS d
        WHERE ${pluginFilter} ${dateFilter}
        GROUP BY COALESCE(d->>'label', 'Unnamed')
        ORDER BY count DESC
        LIMIT 10
      `),

      // 7. Citation rate
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (
            WHERE jsonb_typeof(ql.citations) = 'array' AND jsonb_array_length(ql.citations) > 0
          )::float / GREATEST(COUNT(*), 1)::float * 100 AS citation_rate,
          COALESCE(
            AVG(
              CASE WHEN jsonb_typeof(ql.citations) = 'array'
                THEN jsonb_array_length(ql.citations) ELSE 0 END
            ), 0
          )::float AS avg_citations_per_query
        FROM query_logs ql
        WHERE ${pluginFilter} ${dateFilter}
      `),
    ]);

    // Parse results — db.execute() returns an array of records directly
    const summary = summaryResult[0] as { total_queries: number; avg_latency_ms: number; median_latency_ms: number } | undefined;
    const confidenceRows = confidenceResult as unknown as Array<{ confidence: string; count: number }>;
    const citationRate = citationRateResult[0] as { citation_rate: number; avg_citations_per_query: number } | undefined;

    const confidenceBreakdown = { high: 0, medium: 0, low: 0 };
    for (const row of confidenceRows) {
      const key = row.confidence as keyof typeof confidenceBreakdown;
      if (key in confidenceBreakdown) {
        confidenceBreakdown[key] = row.count;
      }
    }

    return NextResponse.json({
      summary: {
        totalQueries: summary?.total_queries ?? 0,
        avgLatencyMs: Math.round(summary?.avg_latency_ms ?? 0),
        medianLatencyMs: Math.round(summary?.median_latency_ms ?? 0),
        confidenceBreakdown,
        citationRate: Math.round(citationRate?.citation_rate ?? 0),
        avgCitationsPerQuery: Math.round((citationRate?.avg_citations_per_query ?? 0) * 10) / 10,
      },
      queriesOverTime: (overTimeResult as unknown as Array<{ date: string; count: number; avg_latency_ms: number }>).map((r) => ({
        date: r.date,
        count: r.count,
        avgLatencyMs: Math.round(r.avg_latency_ms),
      })),
      topQueries: (topQueriesResult as unknown as Array<{ query_text: string; count: number; mode_confidence: string }>).map((r) => ({
        queryText: r.query_text,
        count: r.count,
        modeConfidence: r.mode_confidence,
      })),
      topSources: (topSourcesResult as unknown as Array<{ document: string; citation_count: number; avg_similarity: number | null }>).map((r) => ({
        document: r.document,
        citationCount: r.citation_count,
        avgSimilarity: r.avg_similarity != null ? Math.round(r.avg_similarity * 100) / 100 : null,
      })),
      topDecisionPaths: (decisionPathsResult as unknown as Array<{ label: string; count: number }>).map((r) => ({
        label: r.label,
        count: r.count,
      })),
      plugins: userPlugins.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[analytics] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
