import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Internal helper: fetch the caller's profile, creating an empty row on first
// touch. Defaults match the schema (visibility=ALWAYS_SHARE, no notes).
async function getOrCreateProfile(userId: string) {
  const existing = await db.healthProfile.findUnique({
    where: { userId },
    include: { conditions: { orderBy: { createdAt: "asc" } } },
  });
  if (existing) return existing;
  await db.healthProfile.create({ data: { userId } });
  return db.healthProfile.findUnique({
    where: { userId },
    include: { conditions: { orderBy: { createdAt: "asc" } } },
  });
}

// GET /api/profile/health — read own profile (lazy-init).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  try {
    const profile = await getOrCreateProfile(session.userId);
    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    console.error("[profile/health GET] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load profile." },
      { status: 500 },
    );
  }
}

const putSchema = z
  .object({
    notes: z.string().max(2000).nullable().optional(),
    visibility: z
      .enum(["ALWAYS_SHARE", "ASK_PER_BOOKING", "PRIVATE"])
      .optional(),
  })
  .strict();

// PUT /api/profile/health — upsert notes/visibility. Auto-creates row.
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  try {
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid body" },
        { status: 400 },
      );
    }
    const parsed = putSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }
    const input = parsed.data;
    const data: Record<string, unknown> = { lastReviewedAt: new Date() };
    if (input.notes !== undefined) {
      data.notes = input.notes ? input.notes.trim() : null;
    }
    if (input.visibility !== undefined) data.visibility = input.visibility;

    const profile = await db.healthProfile.upsert({
      where: { userId: session.userId },
      update: data,
      create: {
        userId: session.userId,
        notes: typeof data.notes === "string" ? (data.notes as string) : null,
        ...(input.visibility ? { visibility: input.visibility } : {}),
        lastReviewedAt: new Date(),
      },
      include: { conditions: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    console.error("[profile/health PUT] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save profile." },
      { status: 500 },
    );
  }
}
