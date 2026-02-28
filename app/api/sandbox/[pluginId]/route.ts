import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { streamQueryPipeline } from "@/lib/engine/query-pipeline";

// Sandbox route — uses Clerk auth instead of API key auth
// Allows plugin owners to test their plugins before publishing.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pluginId: string }> },
) {
  try {
    const user = await requireUser();
    const { pluginId } = await params;

    const plugin = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, pluginId), eq(plugins.creatorId, user.id)),
    });

    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    const body = await req.json();
    const { query, history } = body as {
      query?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const stream = await streamQueryPipeline(plugin.slug, query, undefined, {
      skipPublishCheck: true,
      skipAuditLog: true,
    }, history);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
