import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins, knowledgeDocuments, decisionTrees } from "@/lib/db/schema";

function isMarketplaceShared(config: Record<string, unknown> | null): boolean {
  if (!config) return false;
  return config.marketplaceShared === true;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function normalizeConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }
  return { ...(config as Record<string, unknown>) };
}

async function getUniqueSlug(baseName: string): Promise<string> {
  const baseSlug = slugify(baseName);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.query.plugins.findFirst({
      where: eq(plugins.slug, slug),
    });
    if (!existing) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await requireUser();
    const { slug } = await params;

    const source = await db.query.plugins.findFirst({
      where: eq(plugins.slug, slug),
      with: { documents: true, decisionTrees: true },
    });

    if (!source || !isMarketplaceShared(source.config ?? null)) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    if (source.creatorId === user.id) {
      return NextResponse.json(
        { error: "You are already the original author of this plugin." },
        { status: 400 },
      );
    }

    const uniqueSlug = await getUniqueSlug(`${source.name} downloaded`);
    const baseConfig = normalizeConfig(source.config);
    const [installed] = await db
      .insert(plugins)
      .values({
        creatorId: user.id,
        name: source.name,
        slug: uniqueSlug,
        description: source.description,
        domain: source.domain,
        systemPrompt: source.systemPrompt,
        citationMode: source.citationMode,
        version: source.version,
        isPublished: false,
        config: {
          ...baseConfig,
          marketplaceShared: false,
          downloadedFromMarketplace: true,
          sourcePluginId: source.id,
          sourcePluginSlug: source.slug,
          sourceCreatorId: source.creatorId,
          downloadedAt: new Date().toISOString(),
        },
      })
      .returning();

    if (source.documents.length > 0) {
      await db.insert(knowledgeDocuments).values(
        source.documents.map((doc) => ({
          pluginId: installed.id,
          fileName: doc.fileName,
          fileType: doc.fileType,
          storagePath: doc.storagePath,
          rawText: doc.rawText,
          metadata: doc.metadata ?? {},
        })),
      );
    }

    if (source.decisionTrees.length > 0) {
      await db.insert(decisionTrees).values(
        source.decisionTrees.map((tree) => ({
          pluginId: installed.id,
          name: tree.name,
          description: tree.description,
          treeData: tree.treeData,
          isActive: tree.isActive,
        })),
      );
    }

    return NextResponse.json({ success: true, plugin: installed }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to install plugin";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
