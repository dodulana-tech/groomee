import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const patchSchema = z
  .object({
    severity: z.enum(["MILD", "MODERATE", "SEVERE"]).optional(),
    notes: z.string().max(1000).nullable().optional(),
    startedAt: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .nullable()
      .optional(),
    resolved: z.boolean().optional(),
  })
  .strict();

// Internal: verify the condition exists and belongs to the caller's profile.
async function loadOwnCondition(userId: string, conditionId: string) {
  const condition = await db.healthCondition.findUnique({
    where: { id: conditionId },
    include: { profile: { select: { userId: true } } },
  });
  if (!condition) return { error: "Condition not found.", status: 404 as const };
  if (condition.profile.userId !== userId) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { condition };
}

// PATCH /api/profile/health/conditions/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const { id } = await params;
  try {
    const auth = await loadOwnCondition(session.userId, id);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }

    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid body" },
        { status: 400 },
      );
    }
    const parsed = patchSchema.safeParse(raw);
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
    const data: Record<string, unknown> = {};
    if (input.severity !== undefined) data.severity = input.severity;
    if (input.notes !== undefined) {
      data.notes = input.notes ? input.notes.trim() : null;
    }
    if (input.startedAt !== undefined) {
      if (input.startedAt === null) {
        data.startedAt = null;
      } else {
        const d = new Date(input.startedAt);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json(
            { success: false, error: "Invalid startedAt date" },
            { status: 400 },
          );
        }
        data.startedAt = d;
      }
    }
    if (input.resolved !== undefined) data.resolved = input.resolved;

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.healthCondition.update({
        where: { id },
        data,
      });
      await tx.healthProfile.update({
        where: { id: u.profileId },
        data: { lastReviewedAt: new Date() },
      });
      return u;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[profile/health/conditions/[id] PATCH] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update condition." },
      { status: 500 },
    );
  }
}

// DELETE /api/profile/health/conditions/[id] — hard delete.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  const { id } = await params;
  try {
    const auth = await loadOwnCondition(session.userId, id);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status },
      );
    }
    await db.$transaction(async (tx) => {
      await tx.healthCondition.delete({ where: { id } });
      await tx.healthProfile.update({
        where: { id: auth.condition.profileId },
        data: { lastReviewedAt: new Date() },
      });
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[profile/health/conditions/[id] DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete condition." },
      { status: 500 },
    );
  }
}
