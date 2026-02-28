import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

type SearchResult = {
  id: string;
  username: string;
  name: string;
  email: string;
};

type MetadataRecord = Record<string, unknown>;

function getMetadata(value: unknown): MetadataRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as MetadataRecord;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) {
      return NextResponse.json([]);
    }

    const client = await clerkClient();
    const userList = await client.users.getUserList({ limit: 100 });
    const normalizedQuery = query.toLowerCase();

    const results: SearchResult[] = userList.data
      .filter((user) => user.id !== userId)
      .map((user) => {
        const metadata = getMetadata(user.unsafeMetadata);
        const usernameFromMetadata =
          typeof metadata.username === "string" ? metadata.username.trim() : "";
        const username =
          (typeof user.username === "string" && user.username.trim().length > 0
            ? user.username.trim()
            : usernameFromMetadata) || "";
        const nameFromMetadata = typeof metadata.name === "string" ? metadata.name.trim() : "";
        const fallbackName =
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.emailAddresses[0]?.emailAddress ||
          "User";
        const name = nameFromMetadata || fallbackName;
        const email = user.emailAddresses[0]?.emailAddress || "";
        return {
          id: user.id,
          username,
          name,
          email,
        };
      })
      .filter((user) => user.username.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
