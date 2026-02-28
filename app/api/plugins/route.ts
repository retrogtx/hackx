import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function GET() {
  try {
    const user = await requireUser();
    const userPlugins = await db
      .select()
      .from(plugins)
      .where(eq(plugins.creatorId, user.id))
      .orderBy(desc(plugins.createdAt));
    return NextResponse.json(userPlugins);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { name, domain, description, systemPrompt, citationMode } = body;

    if (!name || !domain || !systemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (true) {
      const existing = await db.query.plugins.findFirst({
        where: eq(plugins.slug, slug),
      });
      if (!existing) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const [plugin] = await db
      .insert(plugins)
      .values({
        creatorId: user.id,
        name,
        slug,
        domain,
        description: description || null,
        systemPrompt,
        citationMode: citationMode || "mandatory",
      })
      .returning();

    return NextResponse.json(plugin, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
