import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { findConditionDef } from "@/lib/health";

const postSchema = z
  .object({
    code: z.string().min(1),
    severity: z.enum(["MILD", "MODERATE", "SEVERE"]).optional(),
    notes: z.string().max(1000).nullable().optional(),
    startedAt: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .nullable()
      .optional(),
  })
  .strict();

// POST /api/profile/health/conditions — add a condition to the caller's
// profile. Auto-creates the parent profile if missing.
export async function POST(req: NextRequest) {
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
    const parsed = postSchema.safeParse(raw);
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

    const def = findConditionDef(input.code);
    if (!def) {
      return NextResponse.json(
        { success: false, error: `Unknown condition code: ${input.code}` },
        { status: 400 },
      );
    }

    // Lazy-init the parent profile.
    const profile = await db.healthProfile.upsert({
      where: { userId: session.userId },
      update: { lastReviewedAt: new Date() },
      create: { userId: session.userId, lastReviewedAt: new Date() },
    });

    let startedAt: Date | null = null;
    if (input.startedAt) {
      const d = new Date(input.startedAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid startedAt date" },
          { status: 400 },
        );
      }
      startedAt = d;
    }

    const condition = await db.healthCondition.create({
      data: {
        profileId: profile.id,
        code: def.code,
        label: def.label,
        category: def.category,
        severity: input.severity ?? "MODERATE",
        notes: input.notes ? input.notes.trim() : null,
        startedAt,
      },
    });

    return NextResponse.json(
      { success: true, data: condition },
      { status: 201 },
    );
  } catch (err) {
    console.error("[profile/health/conditions POST] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to add condition." },
      { status: 500 },
    );
  }
}
