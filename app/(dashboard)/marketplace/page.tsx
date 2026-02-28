import Link from "next/link";
import { db } from "@/lib/db";
import { plugins, users } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Blocks, ExternalLink, Search, Store } from "lucide-react";

type MarketplaceRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  domain: string;
  isPublished: boolean;
  config: Record<string, unknown> | null;
  creatorName: string | null;
};

function isMarketplaceShared(config: Record<string, unknown> | null): boolean {
  if (!config) return false;
  return config.marketplaceShared === true;
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const rows = await db
    .select({
      id: plugins.id,
      name: plugins.name,
      slug: plugins.slug,
      description: plugins.description,
      domain: plugins.domain,
      isPublished: plugins.isPublished,
      config: plugins.config,
      creatorName: users.displayName,
    })
    .from(plugins)
    .leftJoin(users, eq(plugins.creatorId, users.id))
    .orderBy(desc(plugins.updatedAt));

  const listings: MarketplaceRow[] = rows.filter((row) =>
    isMarketplaceShared(row.config ?? null),
  );
  const resolvedSearchParams = await searchParams;
  const rawQuery = Array.isArray(resolvedSearchParams.q)
    ? resolvedSearchParams.q[0] ?? ""
    : resolvedSearchParams.q ?? "";
  const query = rawQuery.trim().toLowerCase();
  const filteredListings = query
    ? listings.filter((plugin) =>
        [
          plugin.name,
          plugin.slug,
          plugin.domain,
          plugin.description ?? "",
          plugin.creatorName ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : listings;

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-[#262626] bg-[#111111] px-3 py-1.5 text-xs text-[#a1a1a1]">
            <Store className="h-3.5 w-3.5 text-[#00d4aa]" />
            Public Marketplace
          </div>
          <h1 className="text-3xl font-bold text-white">Marketplace</h1>
          <p className="mt-2 text-[#a1a1a1]">
            Plugins that creators explicitly shared from their private dashboard.
          </p>
        </div>

        <form action="/marketplace" method="GET" className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
            <Input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search by plugin, domain, creator, or slug"
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
              <Link href="/marketplace">Clear</Link>
            </Button>
          ) : null}
        </form>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#333] py-24">
            <Blocks className="mb-4 h-12 w-12 text-[#444]" />
            <h2 className="mb-2 text-lg font-semibold text-white">No listings yet</h2>
            <p className="text-center text-sm text-[#a1a1a1]">
              Share a plugin to marketplace from the plugin actions menu.
            </p>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#333] py-24">
            <Search className="mb-4 h-10 w-10 text-[#555]" />
            <h2 className="mb-2 text-lg font-semibold text-white">No matching plugins</h2>
            <p className="text-center text-sm text-[#a1a1a1]">
              Try a different search query.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((plugin) => (
              <Link
                key={plugin.id}
                href={`/marketplace/${plugin.slug}`}
                className="group rounded-md border border-[#262626] bg-[#0a0a0a] p-5 transition-all hover:border-[#333] hover:bg-[#111111]"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="border-[#333] text-[#a1a1a1]">
                    {plugin.domain}
                  </Badge>
                  {plugin.isPublished ? (
                    <Badge className="bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20">
                      Published
                    </Badge>
                  ) : (
                    <Badge className="bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20">
                      Draft Share
                    </Badge>
                  )}
                </div>
                <h2 className="font-bold text-white">{plugin.name}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-[#a1a1a1]">
                  {plugin.description || "No description"}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-[#666]">
                  <span>by {plugin.creatorName ?? "Unknown creator"}</span>
                  <span className="inline-flex items-center gap-1 text-[#888]">
                    Open <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
