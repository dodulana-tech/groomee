import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { BookingStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (session.role !== "PRO" && session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const pro = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!pro) return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });

    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") ?? "active";

    const statusFilter: Record<string, BookingStatus[]> = {
      active: ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_SERVICE"],
      upcoming: ["DISPATCHING"],
      completed: ["COMPLETED", "CONFIRMED"],
    };

    const bookings = await db.booking.findMany({
      where: {
        proId: pro.id,
        status: { in: statusFilter[tab] ?? statusFilter.active },
      },
      include: {
        service: { select: { name: true } },
        zone: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      data: bookings.map((b: any) => ({
        id: b.id,
        status: b.status,
        isAsap: b.isAsap,
        serviceName: b.service?.name,
        areaName: b.zone?.name ?? "Lagos",
        customerFirstName: b.customer?.name?.split(" ")[0] ?? "Customer",
        proEarning: b.proEarning,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    console.error("partner bookings error:", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (session.role !== "PRO" && session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const pro = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!pro) return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });

    const { bookingId, status } = await request.json();

    const booking = await db.booking.findFirst({
      where: { id: bookingId, proId: pro.id },
    });
    if (!booking) return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 });

    // State machine: only allow valid status transitions
    const allowedTransitions: Record<string, string> = {
      ACCEPTED: "EN_ROUTE",
      EN_ROUTE: "ARRIVED",
      ARRIVED: "IN_SERVICE",
      IN_SERVICE: "COMPLETED",
    };
    if (allowedTransitions[booking.status] !== status) {
      return NextResponse.json(
        { success: false, error: `Invalid transition from ${booking.status} to ${status}` },
        { status: 400 },
      );
    }

    const now = new Date();
    const updateData: any = { status };
    if (status === "EN_ROUTE") updateData.enRouteAt = now;
    if (status === "ARRIVED") updateData.arrivedAt = now;
    if (status === "COMPLETED") updateData.completedAt = now;

    await db.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("partner booking update error:", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
