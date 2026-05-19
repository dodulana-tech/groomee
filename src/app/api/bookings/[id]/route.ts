import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        pro: true,
        service: true,
        items: {
          include: { service: { select: { id: true, name: true, durationMins: true } } },
          orderBy: { sortOrder: "asc" },
        },
        zone: true,
        payment: true,
        dispute: true,
        review: true,
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found." },
        { status: 404 },
      );
    }

    // ─────────────────────────────────────────
    // AUTHORIZATION
    // ─────────────────────────────────────────
    const isOwner = session?.userId === booking.customerId;
    const isAdmin = session?.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("booking fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}
