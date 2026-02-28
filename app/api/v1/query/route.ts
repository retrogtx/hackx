import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys, plugins } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { hashApiKey } from "@/lib/utils/api-key";
import { runQueryPipeline, streamQueryPipeline } from "@/lib/engine/query-pipeline";

const MAX_QUERY_LENGTH = 4000;

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate via API key
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const key = authHeader.slice(7);
    const keyHash = hashApiKey(key);

    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });

    if (!apiKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Update last used
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id));

    // 2. Parse body
    const body = await req.json();
    const { plugin: pluginSlug, query } = body;

    if (!pluginSlug || !query) {
      return NextResponse.json(
        { error: "Missing required fields: plugin, query" },
        { status: 400 },
      );
    }

    if (typeof query !== "string" || query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Query must be a string under ${MAX_QUERY_LENGTH} characters` },
        { status: 400 },
      );
    }

    // 3. Verify the API key owner has access to this plugin
    //    Allowed if: plugin is published OR the key owner is the plugin creator
    const plugin = await db.query.plugins.findFirst({
      where: and(
        eq(plugins.slug, pluginSlug),
        or(
          eq(plugins.isPublished, true),
          eq(plugins.creatorId, apiKey.userId),
        ),
      ),
    });

    if (!plugin) {
      return NextResponse.json(
        { error: "Plugin not found or access denied" },
        { status: 404 },
      );
    }

    // 4. Run pipeline — check if client wants streaming
    const wantsStream = body.stream === true || req.headers.get("accept")?.includes("text/event-stream");

    if (wantsStream) {
      const stream = await streamQueryPipeline(pluginSlug, query, apiKey.id, { skipPublishCheck: true });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const result = await runQueryPipeline(pluginSlug, query, apiKey.id, { skipPublishCheck: true });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("not published")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error("[QueryAPI] Unhandled error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
