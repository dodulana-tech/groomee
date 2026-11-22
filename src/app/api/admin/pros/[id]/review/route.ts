import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, hasPermission } from "@/lib/auth";
import { logAdminAction } from "@/lib/admin-audit";
import {
  notifyApplicationApproved,
  notifyApplicationRejected,
} from "@/lib/pro-onboarding";

const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z
      .string()
      .trim()
      .min(10, "Please give the applicant a clear reason (at least 10 characters).")
      .max(500),
  }),
]);

// POST /api/admin/pros/:id/review { action: "approve" } | { action: "reject", reason }
// Only PENDING applications can be reviewed; the status flip is conditional
// so two admins clicking at once can't double-notify the applicant.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "pros.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const parsed = reviewSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0].message },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const pro = await db.pro.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      userId: true,
      user: { select: { email: true } },
      _count: { select: { services: true, zones: true } },
    },
  });
  if (!pro) {
    return NextResponse.json({ success: false, error: "Applicant not found." }, { status: 404 });
  }
  if (pro.status !== "PENDING") {
    return NextResponse.json(
      { success: false, error: `This application was already reviewed (status: ${pro.status}).` },
      { status: 409 },
    );
  }

  const now = new Date();
  const adminId = session!.userId;

  if (input.action === "approve") {
    if (pro._count.services === 0 || pro._count.zones === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "This applicant has no services or zones yet. Add them on the pro's page before approving.",
        },
        { status: 400 },
      );
    }
    const flipped = await db.pro.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "ACTIVE",
        approvedAt: now,
        reviewedById: adminId,
        rejectedAt: null,
        rejectionReason: null,
      },
    });
    if (flipped.count === 0) {
      return NextResponse.json(
        { success: false, error: "Someone else just reviewed this application." },
        { status: 409 },
      );
    }
    if (pro.userId) {
      await db.user
        .update({ where: { id: pro.userId }, data: { role: "PRO" } })
        .catch((err) => console.error("[review] role sync failed", err));
    }
    await logAdminAction({
      adminId,
      action: "pro.application.approve",
      entityType: "Pro",
      entityId: id,
    });
    await notifyApplicationApproved({ pro, email: pro.user?.email ?? null });
    return NextResponse.json({ success: true, data: { id, status: "ACTIVE" } });
  }

  const flipped = await db.pro.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "REMOVED",
      availability: "OFFLINE",
      rejectedAt: now,
      rejectionReason: input.reason,
      reviewedById: adminId,
    },
  });
  if (flipped.count === 0) {
    return NextResponse.json(
      { success: false, error: "Someone else just reviewed this application." },
      { status: 409 },
    );
  }
  await logAdminAction({
    adminId,
    action: "pro.application.reject",
    entityType: "Pro",
    entityId: id,
    metadata: { reason: input.reason },
  });
  await notifyApplicationRejected({
    pro,
    email: pro.user?.email ?? null,
    reason: input.reason,
  });
  return NextResponse.json({ success: true, data: { id, status: "REMOVED" } });
}
