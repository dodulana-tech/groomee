import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const master = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!master) {
      return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });
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
            status: true,
            availability: true,
            avgRating: true,
            reviewCount: true,
            totalJobs: true,
            relationship: true,
          },
        },
        master: { select: { id: true, name: true, phone: true } },
        modules: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!apprenticeship) {
      return NextResponse.json({ success: false, error: "Apprenticeship not found." }, { status: 404 });
    }
    if (apprenticeship.masterId !== master.id) {
      return NextResponse.json(
        { success: false, error: "Not your apprentice." },
        { status: 403 },
      );
    }

    const earningsAgg = await db.earning.aggregate({
      where: { apprenticeshipId: id, type: "APPRENTICE_COMMISSION" },
      _sum: { amount: true },
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: apprenticeship.id,
        status: apprenticeship.status,
        masterCommission: apprenticeship.masterCommission,
        masterApprovedIndependence: apprenticeship.masterApprovedIndependence,
        invitedAt: apprenticeship.invitedAt,
        acceptedAt: apprenticeship.acceptedAt,
        readyForFreedomAt: apprenticeship.readyForFreedomAt,
        freedomDate: apprenticeship.freedomDate,
        terminatedAt: apprenticeship.terminatedAt,
        apprentice: apprenticeship.apprentice,
        modules: apprenticeship.modules,
        masterEarningsTotal: earningsAgg._sum.amount ?? 0,
        masterEarningsCount: earningsAgg._count.id,
      },
    });
  } catch (err) {
    console.error("[partner/apprentices/[id] GET] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load apprenticeship." },
      { status: 500 },
    );
  }
}
