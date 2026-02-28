import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys, plugins } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";
import { hashApiKey } from "@/lib/utils/api-key";
import { runCollaboration, streamCollaboration } from "@/lib/engine/collaboration";
import type { CollaborationMode } from "@/lib/engine/collaboration";

const MAX_QUERY_LENGTH = 4000;
const VALID_MODES: CollaborationMode[] = ["debate", "consensus", "review"];

export async function POST(req: NextRequest) {
  try {
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

    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKey.id));

    const body = await req.json();
    const { experts, query, mode = "debate", maxRounds = 3 } = body;

    if (!Array.isArray(experts) || experts.length < 2) {
      return NextResponse.json(
        { error: "Must provide at least 2 expert plugin slugs" },
        { status: 400 },
      );
    }
    if (experts.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 experts per collaboration" },
        { status: 400 },
      );
    }
    if (!query || typeof query !== "string" || query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Query must be a string under ${MAX_QUERY_LENGTH} characters` },
        { status: 400 },
      );
    }
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json(
        { error: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` },
        { status: 400 },
      );
    }

    for (const slug of experts) {
      const plugin = await db.query.plugins.findFirst({
        where: and(
          eq(plugins.slug, slug),
          or(eq(plugins.isPublished, true), eq(plugins.creatorId, apiKey.userId)),
        ),
      });
      if (!plugin) {
        return NextResponse.json(
          { error: `Plugin not found or access denied: ${slug}` },
          { status: 404 },
        );
      }
    }

    const wantsStream = body.stream === true || req.headers.get("accept")?.includes("text/event-stream");

    const config = {
      expertSlugs: experts as string[],
      query: query as string,
      mode: mode as CollaborationMode,
      maxRounds: Math.min(Number(maxRounds) || 3, 3),
      skipPublishCheck: true,
    };

    if (wantsStream) {
      const stream = await streamCollaboration(config);
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const result = await runCollaboration(config);
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
    console.error("[CollaborateAPI] Unhandled error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
