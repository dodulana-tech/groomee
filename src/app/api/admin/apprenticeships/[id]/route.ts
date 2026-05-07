import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPRENTICESHIP_PERMISSIONS } from "@/lib/apprenticeships";
import { logAdminAction } from "@/lib/admin-audit";
import { z } from "zod";

const patchSchema = z.object({
  masterCommission: z.number().min(0).max(0.6).optional(),
  masterApprovedIndependence: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, APPRENTICESHIP_PERMISSIONS.view)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const apprenticeship = await db.apprenticeship.findUnique({
      where: { id },
      include: {
        apprentice: {
          select: {
            id: true,
            name: true,
            phone: true,
            photo: true,
            bio: true,
            status: true,
            availability: true,
            totalJobs: true,
            avgRating: true,
            reviewCount: true,
            relationship: true,
            parentProId: true,
            freedUnderProId: true,
            freedAt: true,
            freedomCertCode: true,
          },
        },
        master: {
          select: {
            id: true,
            name: true,
            phone: true,
            photo: true,
            bio: true,
            status: true,
            avgRating: true,
            totalJobs: true,
          },
        },
        modules: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!apprenticeship) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    // Earnings the master has earned from this apprenticeship
    const earningsAgg = await db.earning.aggregate({
      where: { apprenticeshipId: id, type: "APPRENTICE_COMMISSION" },
      _sum: { amount: true },
      _count: { id: true },
    });

    const recentEarnings = await db.earning.findMany({
      where: { apprenticeshipId: id, type: "APPRENTICE_COMMISSION" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        sourcePro: { select: { id: true, name: true } },
      },
    });

    const recentBookings = await db.booking.findMany({
      where: { proId: apprenticeship.apprenticeId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        service: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...apprenticeship,
        masterEarningsTotal: earningsAgg._sum.amount ?? 0,
        masterEarningsCount: earningsAgg._count.id,
        recentEarnings,
        recentBookings,
      },
    });
  } catch (err) {
    console.error("[admin/apprenticeships GET id] error", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, APPRENTICESHIP_PERMISSIONS.manage)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const input = patchSchema.parse(body);

    const existing = await db.apprenticeship.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    const data: {
      masterCommission?: number;
      masterApprovedIndependence?: Date | null;
    } = {};

    if (input.masterCommission !== undefined) {
      data.masterCommission = input.masterCommission;
    }
    if (input.masterApprovedIndependence !== undefined) {
      data.masterApprovedIndependence = input.masterApprovedIndependence
        ? new Date()
        : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: "No changes provided" },
        { status: 400 },
      );
    }

    const updated = await db.apprenticeship.update({
      where: { id },
      data,
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "apprenticeship.update",
      entityType: "apprenticeship",
      entityId: id,
      metadata: {
        before: {
          masterCommission: existing.masterCommission,
          masterApprovedIndependence: existing.masterApprovedIndependence,
        },
        after: {
          masterCommission: updated.masterCommission,
          masterApprovedIndependence: updated.masterApprovedIndependence,
        },
        changed: Object.keys(input),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("[admin/apprenticeships PATCH] error", err);
    return NextResponse.json(
      { success: false, error: "Failed to update" },
      { status: 500 },
    );
  }
}
