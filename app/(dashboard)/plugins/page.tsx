import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Blocks, Search } from "lucide-react";
import { PluginsGrid } from "./plugins-grid";

export default async function PluginsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const user = await requireUser();

  const userPlugins = await db
    .select()
    .from(plugins)
    .where(eq(plugins.creatorId, user.id))
    .orderBy(desc(plugins.createdAt));

  const pluginCards = userPlugins.map((plugin) => ({
    id: plugin.id,
    name: plugin.name,
    slug: plugin.slug,
    description: plugin.description,
    domain: plugin.domain,
    isPublished: plugin.isPublished,
    config: plugin.config ?? {},
  }));
  const resolvedSearchParams = await searchParams;
  const rawQuery = Array.isArray(resolvedSearchParams.q)
    ? resolvedSearchParams.q[0] ?? ""
    : resolvedSearchParams.q ?? "";
  const query = rawQuery.trim().toLowerCase();
  const filteredPluginCards = query
    ? pluginCards.filter((plugin) =>
        [plugin.name, plugin.slug, plugin.domain, plugin.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : pluginCards;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Plugins</h1>
          <p className="text-[#a1a1a1]">
            Create and manage your expert plugins
          </p>
        </div>
        <Button className="bg-white text-black hover:bg-[#ccc] font-semibold" asChild>
          <Link href="/plugins/new">
            <Plus className="mr-2 h-4 w-4" />
            New Plugin
          </Link>
        </Button>
      </div>

      {userPlugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#333] py-20">
          <Blocks className="mb-4 h-12 w-12 text-[#444]" />
          <h3 className="mb-2 text-lg font-semibold text-white">No plugins yet</h3>
          <p className="mb-6 text-center text-sm text-[#a1a1a1]">
            Create your first plugin to turn a generalist AI into a domain expert.
          </p>
          <Button className="bg-white text-black hover:bg-[#ccc] font-semibold" asChild>
            <Link href="/plugins/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Plugin
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <form action="/plugins" method="GET" className="mb-6 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
              <Input
                type="text"
                name="q"
                defaultValue={rawQuery}
                placeholder="Search by plugin, domain, or slug"
                className="border-[#262626] bg-[#111111] pl-9 text-white placeholder:text-[#666] focus:border-[#444] focus:ring-0"
              />
            </div>
            <Button type="submit" className="bg-white text-black hover:bg-[#ccc] font-semibold">
              Search
            </Button>
            {query ? (
              <Button
                asChild
                type="button"
                variant="outline"
                className="border-[#333] text-[#a1a1a1] hover:bg-[#1a1a1a] hover:text-white"
              >
                <Link href="/plugins">Clear</Link>
              </Button>
            ) : null}
          </form>

          {filteredPluginCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#333] py-24">
              <Search className="mb-4 h-10 w-10 text-[#555]" />
              <h2 className="mb-2 text-lg font-semibold text-white">No matching plugins</h2>
              <p className="text-center text-sm text-[#a1a1a1]">
                Try a different search query.
              </p>
            </div>
          ) : (
            <PluginsGrid initialPlugins={filteredPluginCards} />
          )}
        </>
      )}
    </div>
  );
}
