import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const take = parseInt(searchParams.get("take") ?? "50");
    const skip = parseInt(searchParams.get("skip") ?? "0");

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where: status ? { status: status as never } : undefined,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          groomer: true,
          service: true,
          zone: true,
          payment: true,
          dispute: true,
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      db.booking.count({
        where: status ? { status: status as never } : undefined,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: bookings,
      meta: { total, take, skip },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}
