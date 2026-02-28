import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins, knowledgeDocuments, decisionTrees, queryLogs } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { ArrowLeft, Upload, GitBranch, MessageSquare, Globe } from "lucide-react";
import { PublishButton } from "./publish-button";
import { ShareQrButton } from "./share-qr-button";
import { PluginSettings } from "./plugin-settings";

function isMarketplaceShared(config: Record<string, unknown> | null): boolean {
  if (!config) return false;
  return config.marketplaceShared === true;
}

export default async function PluginDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const plugin = await db.query.plugins.findFirst({
    where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
  });

  if (!plugin) notFound();

  const [docCount] = await db
    .select({ count: count() })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.pluginId, id));

  const [treeCount] = await db
    .select({ count: count() })
    .from(decisionTrees)
    .where(eq(decisionTrees.pluginId, id));

  const [queryCount] = await db
    .select({ count: count() })
    .from(queryLogs)
    .where(eq(queryLogs.pluginId, id));

  const marketplaceShared = isMarketplaceShared(plugin.config ?? null);

  return (
    <div>
      <Link
        href="/plugins"
        className="mb-4 inline-flex items-center text-sm text-[#666] transition-colors hover:text-white"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to plugins
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{plugin.name}</h1>
            <PublishButton pluginId={plugin.id} isPublished={plugin.isPublished} />
            <ShareQrButton slug={plugin.slug} isMarketplaceShared={marketplaceShared} />
          </div>
          {plugin.description && (
            <p className="mt-2 text-[#a1a1a1]">{plugin.description}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/plugins/${id}/knowledge`}>
          <div className="group rounded-md border border-[#262626] bg-[#0a0a0a] p-5 transition-all hover:border-[#333] hover:bg-[#111111]">
            <Upload className="mb-3 h-8 w-8 text-[#3b82f6]" />
            <h3 className="font-bold text-white">Knowledge Base</h3>
            <p className="mt-1 text-sm text-[#a1a1a1]">
              {docCount.count} document{docCount.count !== 1 ? "s" : ""} uploaded
            </p>
          </div>
        </Link>

        <Link href={`/plugins/${id}/trees`}>
          <div className="group rounded-md border border-[#262626] bg-[#0a0a0a] p-5 transition-all hover:border-[#333] hover:bg-[#111111]">
            <GitBranch className="mb-3 h-8 w-8 text-[#00d4aa]" />
            <h3 className="font-bold text-white">Decision Trees</h3>
            <p className="mt-1 text-sm text-[#a1a1a1]">
              {treeCount.count} tree{treeCount.count !== 1 ? "s" : ""}
            </p>
          </div>
        </Link>

        <Link href={`/plugins/${id}/sandbox`}>
          <div className="group rounded-md border border-[#262626] bg-[#0a0a0a] p-5 transition-all hover:border-[#333] hover:bg-[#111111]">
            <MessageSquare className="mb-3 h-8 w-8 text-[#a855f7]" />
            <h3 className="font-bold text-white">Test Sandbox</h3>
            <p className="mt-1 text-sm text-[#a1a1a1]">Chat with your plugin</p>
          </div>
        </Link>

        <div className="rounded-md border border-[#262626] bg-[#0a0a0a] p-5">
          <Globe className="mb-3 h-8 w-8 text-[#f59e0b]" />
          <h3 className="font-bold text-white">Queries</h3>
          <p className="mt-1 text-sm text-[#a1a1a1]">
            {queryCount.count} total quer{queryCount.count !== 1 ? "ies" : "y"}
          </p>
        </div>
      </div>

      <PluginSettings
        pluginId={plugin.id}
        initialName={plugin.name}
        initialDescription={plugin.description ?? ""}
        initialDomain={plugin.domain}
        initialSystemPrompt={plugin.systemPrompt}
        initialCitationMode={plugin.citationMode}
        slug={plugin.slug}
        isPublished={plugin.isPublished}
      />
    </div>
  );
}
