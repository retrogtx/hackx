import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";

type MetadataRecord = Record<string, unknown>;

function getUnsafeMetadata(user: Awaited<ReturnType<typeof currentUser>>): MetadataRecord {
  if (!user) return {};
  const value = user.unsafeMetadata;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as MetadataRecord) };
}

function isValidUsername(value: string): boolean {
  return /^[a-zA-Z0-9_]{3,24}$/.test(value);
}

function isValidName(value: string): boolean {
  return value.length >= 2 && value.length <= 60;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metadata = getUnsafeMetadata(user);
    const email = user.emailAddresses[0]?.emailAddress ?? "";
    const fallbackName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || email || "User";
    const username =
      (typeof user.username === "string" && user.username.trim().length > 0
        ? user.username
        : null) ||
      (typeof metadata.username === "string" && metadata.username.trim().length > 0
        ? metadata.username
        : "user");
    const name =
      typeof metadata.name === "string" && metadata.name.trim().length > 0
        ? metadata.name
        : fallbackName;

    return NextResponse.json({
      name,
      username,
      email,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!isValidName(name)) {
      return NextResponse.json(
        { error: "Name must be between 2 and 60 characters" },
        { status: 400 },
      );
    }
    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: "Username must be 3-24 chars and can include letters, numbers, and _ only" },
        { status: 400 },
      );
    }

    const client = await clerkClient();
    const existingWithUsername = await client.users.getUserList({
      username: [username],
      limit: 1,
    });
    if (existingWithUsername.data[0] && existingWithUsername.data[0].id !== userId) {
      return NextResponse.json(
        { error: "This username is already taken. Please choose another one." },
        { status: 409 },
      );
    }

    const appUser = await requireUser();
    const signedInUser = await currentUser();
    if (!signedInUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentMetadata = getUnsafeMetadata(signedInUser);
    await client.users.updateUser(userId, {
      username,
      unsafeMetadata: {
        ...currentMetadata,
        name,
        username,
      },
    });

    await db
      .update(users)
      .set({ displayName: name })
      .where(eq(users.id, appUser.id));

    return NextResponse.json({ success: true, name, username });
  } catch (error) {
    const maybeClerkError = error as {
      errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
    };
    const clerkUsernameConflict = maybeClerkError.errors?.some((entry) =>
      (entry.code || "").toLowerCase().includes("username") ||
      (entry.message || "").toLowerCase().includes("username already")
    );
    if (clerkUsernameConflict) {
      return NextResponse.json(
        { error: "This username is already taken. Please choose another one." },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
