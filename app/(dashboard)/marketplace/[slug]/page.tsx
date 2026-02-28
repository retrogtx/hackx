import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { plugins, knowledgeDocuments, queryLogs } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, MessageSquare, Terminal } from "lucide-react";
import { MarketplaceActions } from "./marketplace-actions";

function isMarketplaceShared(config: Record<string, unknown> | null): boolean {
  if (!config) return false;
  return config.marketplaceShared === true;
}

export default async function MarketplacePluginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId } = await auth();

  const plugin = await db.query.plugins.findFirst({
    where: eq(plugins.slug, slug),
    with: { creator: true },
  });

  if (!plugin || !isMarketplaceShared(plugin.config ?? null)) notFound();

  const [docCount] = await db
    .select({ count: count() })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.pluginId, plugin.id));

  const [queryCount] = await db
    .select({ count: count() })
    .from(queryLogs)
    .where(eq(queryLogs.pluginId, plugin.id));

  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const endpoint = host ? `${protocol}://${host}/api/v1/query` : "/api/v1/query";

  const sampleCurl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer lx_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "plugin": "${plugin.slug}",
    "query": "Your question here"
  }'`;

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center text-sm text-[#666] transition-colors hover:text-white"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Home
        </Link>

        <MarketplaceActions slug={plugin.slug} isSignedIn={Boolean(userId)} />

        <div className="rounded-md border border-[#262626] bg-[#0a0a0a]">
          <div className="border-b border-[#262626] px-6 py-5">
            <div className="mb-3 flex items-center gap-2">
              {plugin.isPublished ? (
                <Badge className="bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20">
                  Published Plugin
                </Badge>
              ) : (
                <Badge className="bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20">
                  Shared Draft
                </Badge>
              )}
              <Badge variant="outline" className="border-[#333] text-[#a1a1a1]">
                {plugin.domain}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-white">{plugin.name}</h1>
            {plugin.description && (
              <p className="mt-2 text-[#a1a1a1]">{plugin.description}</p>
            )}
            <p className="mt-3 text-xs text-[#666]">
              Created by {plugin.creator.displayName}
            </p>
          </div>

          <div className="grid gap-4 border-b border-[#262626] px-6 py-5 sm:grid-cols-2">
            <div className="rounded-md border border-[#262626] bg-[#111111] p-4">
              <FileText className="mb-2 h-5 w-5 text-[#3b82f6]" />
              <p className="text-sm text-[#a1a1a1]">Knowledge documents</p>
              <p className="text-xl font-semibold text-white">{docCount.count}</p>
            </div>
            <div className="rounded-md border border-[#262626] bg-[#111111] p-4">
              <MessageSquare className="mb-2 h-5 w-5 text-[#f59e0b]" />
              <p className="text-sm text-[#a1a1a1]">Total API queries</p>
              <p className="text-xl font-semibold text-white">{queryCount.count}</p>
            </div>
          </div>

          {plugin.isPublished ? (
            <div className="space-y-3 px-6 py-5">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#a1a1a1]" />
                <h2 className="font-bold text-white">Use this plugin via API</h2>
              </div>
              <p className="text-sm text-[#a1a1a1]">
                Use your API key and this slug:{" "}
                <span className="rounded bg-[#111111] px-1.5 py-0.5 text-[#ededed]">
                  {plugin.slug}
                </span>
              </p>
              <pre className="overflow-x-auto rounded-md border border-[#262626] bg-[#111111] p-4 text-xs text-[#ededed]">
                {sampleCurl}
              </pre>
            </div>
          ) : (
            <div className="space-y-2 px-6 py-5">
              <h2 className="font-bold text-white">API access not enabled</h2>
              <p className="text-sm text-[#a1a1a1]">
                This plugin is shared in the marketplace, but it is still private for API usage
                until the owner publishes it.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
