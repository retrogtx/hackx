import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { plugins } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { streamReviewPipeline } from "@/lib/engine/review";

const MAX_DOCUMENT_LENGTH = 100_000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const plugin = await db.query.plugins.findFirst({
      where: and(eq(plugins.id, id), eq(plugins.creatorId, user.id)),
    });

    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    let document: string;
    let title: string;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      title = (formData.get("title") as string) || "Untitled Review";

      if (file) {
        document = await file.text();
      } else {
        document = (formData.get("document") as string) || "";
      }
    } else {
      const body = await req.json();
      document = body.document || "";
      title = body.title || "Untitled Review";
    }

    if (!document) {
      return NextResponse.json({ error: "Missing document" }, { status: 400 });
    }

    if (document.length > MAX_DOCUMENT_LENGTH) {
      return NextResponse.json(
        { error: `Document must be under ${MAX_DOCUMENT_LENGTH} characters` },
        { status: 400 },
      );
    }

    const stream = await streamReviewPipeline(plugin.slug, document, title, undefined, {
      skipPublishCheck: true,
      skipAuditLog: true,
    });

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
