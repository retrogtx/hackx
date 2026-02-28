import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Plus, Blocks } from "lucide-react";
import { PluginsGrid } from "./plugins-grid";

export default async function PluginsPage() {
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
        <PluginsGrid initialPlugins={pluginCards} />
      )}
    </div>
  );
}
