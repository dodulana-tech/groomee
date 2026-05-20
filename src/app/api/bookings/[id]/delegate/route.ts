import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logAdminAction } from "@/lib/admin-audit";
import {
  notifyApprenticeBookingDeployed,
  notifyCustomerBookingDeployed,
} from "@/lib/whatsapp";
import {
  emailApprenticeBookingDeployed,
  emailCustomerBookingDeployed,
} from "@/lib/email-notify";
import {
  formatNaira,
  generateMapsLinkFromAddress,
  maskPhone,
} from "@/lib/utils";

/**
 * Master deploys an accepted booking to one of their dependents (apprentice
 * or staff). This is a direct hand-off — the dispatch lottery is bypassed.
 *
 *   booking.proId             →  apprentice.id
 *   master.availability       →  ONLINE, currentBookingId cleared
 *   apprentice.availability   →  BUSY, currentBookingId set
 *
 * Booking status stays ACCEPTED. Earnings split (slice 3) handles the master
 * commission automatically when the booking eventually confirms.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const apprenticeId: string | undefined = body?.apprenticeId;
    if (!apprenticeId || typeof apprenticeId !== "string") {
      return NextResponse.json(
        { success: false, error: "apprenticeId required" },
        { status: 400 },
      );
    }

    const master = await db.pro.findFirst({
      where: { userId: session.userId },
    });
    if (!master) {
      return NextResponse.json(
        { success: false, error: "Pro not found" },
        { status: 404 },
      );
    }

    const [booking, apprentice] = await Promise.all([
      db.booking.findUnique({
        where: { id },
        include: {
          customer: true,
          service: { select: { id: true, name: true } },
          zone: { select: { id: true, name: true } },
        },
      }),
      db.pro.findUnique({
        where: { id: apprenticeId },
        include: {
          services: { select: { serviceId: true } },
          zones: { select: { zoneId: true } },
          user: { select: { email: true } },
        },
      }),
    ]);

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 },
      );
    }
    if (!apprentice) {
      return NextResponse.json(
        { success: false, error: "Dependent not found" },
        { status: 404 },
      );
    }

    // 1. Caller must be the booking's current pro.
    if (booking.proId !== master.id) {
      return NextResponse.json(
        { success: false, error: "You can only deploy your own bookings." },
        { status: 403 },
      );
    }

    // 2. Booking status === ACCEPTED.
    if (booking.status !== "ACCEPTED") {
      return NextResponse.json(
        {
          success: false,
          error: `This booking is already ${booking.status.toLowerCase().replace(/_/g, " ")} — too late to deploy.`,
        },
        { status: 422 },
      );
    }

    // 3. Dependent must be one of the master's dependents.
    if (apprentice.parentProId !== master.id) {
      return NextResponse.json(
        {
          success: false,
          error: "That pro is not on your team.",
        },
        { status: 403 },
      );
    }
    if (
      apprentice.relationship !== "APPRENTICE" &&
      apprentice.relationship !== "STAFF"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "That pro is no longer your apprentice or staff.",
        },
        { status: 403 },
      );
    }

    // 4. Dependent must be ACTIVE.
    if (apprentice.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: `${apprentice.name} is not active and cannot take bookings.`,
        },
        { status: 422 },
      );
    }

    // 5. Dependent must not be BUSY in another job.
    if (apprentice.availability === "BUSY") {
      return NextResponse.json(
        {
          success: false,
          error: `${apprentice.name} is currently busy on another booking.`,
        },
        { status: 422 },
      );
    }

    // 6. Dependent must serve the booking's service AND zone.
    const servicesIds = apprentice.services.map((s) => s.serviceId);
    if (!servicesIds.includes(booking.serviceId)) {
      return NextResponse.json(
        {
          success: false,
          error: `${apprentice.name} doesn't offer ${booking.service.name}.`,
        },
        { status: 422 },
      );
    }
    if (booking.zoneId) {
      const zoneIds = apprentice.zones.map((z) => z.zoneId);
      if (!zoneIds.includes(booking.zoneId)) {
        return NextResponse.json(
          {
            success: false,
            error: `${apprentice.name} doesn't cover ${booking.zone?.name ?? "this zone"}.`,
          },
          { status: 422 },
        );
      }
    }

    // Snapshot the apprenticeship id so the earnings split at confirm time
    // remains correct even if the apprenticeship transitions to FREED or
    // TERMINATED before the booking is confirmed. STAFF (no apprenticeship
    // row) gets null here and falls back to a single SERVICE earning.
    const activeApprenticeship = await db.apprenticeship.findFirst({
      where: {
        apprenticeId: apprentice.id,
        masterId: master.id,
        status: { in: ["IN_TRAINING", "READY_FOR_FREEDOM"] },
      },
      select: { id: true },
      orderBy: { acceptedAt: "desc" },
    });

    // ─── Atomic re-assign ────────────────────────────────────────────────────
    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          proId: apprentice.id,
          delegatedApprenticeshipId: activeApprenticeship?.id ?? null,
        },
      });
      // Only flip the master back to ONLINE if they were tied to *this*
      // booking. Defensive: if dispatcher ever assigns concurrent work,
      // we don't lose track of their other in-flight job.
      if (master.currentBookingId === booking.id) {
        await tx.pro.update({
          where: { id: master.id },
          data: { availability: "ONLINE", currentBookingId: null },
        });
      }
      await tx.pro.update({
        where: { id: apprentice.id },
        data: { availability: "BUSY", currentBookingId: booking.id },
      });
    });

    // ─── Audit trail ─────────────────────────────────────────────────────────
    // logAdminAction writes to ActivityLog. Reused here for pro-initiated
    // booking events so we have a single audit timeline. Action prefix
    // `booking.*` separates these from `team.*` and other admin actions.
    await logAdminAction({
      adminId: session.userId,
      action: "booking.delegate",
      entityType: "booking",
      entityId: booking.id,
      metadata: {
        fromProId: master.id,
        toProId: apprentice.id,
        apprenticeName: apprentice.name,
        delegatedApprenticeshipId: activeApprenticeship?.id ?? null,
      },
    });

    // ─── Notifications ───────────────────────────────────────────────────────
    const mapsLink =
      booking.latitude && booking.longitude
        ? `https://maps.google.com?q=${booking.latitude},${booking.longitude}`
        : generateMapsLinkFromAddress(booking.address);
    const customerName = booking.customer.name ?? "Customer";
    const maskedCustomerPhone = booking.customer.phone
      ? maskPhone(booking.customer.phone)
      : "Customer will be in touch";

    // Apprentice WhatsApp
    if (apprentice.phone) {
      notifyApprenticeBookingDeployed({
        apprenticePhone: apprentice.phone,
        masterName: master.name,
        customerName,
        address: booking.address,
        mapsLink,
        maskedCustomerPhone,
      }).catch((err) =>
        console.error("[delegate] apprentice WA failed:", err),
      );
    }

    // Apprentice email
    if (apprentice.user?.email) {
      emailApprenticeBookingDeployed({
        to: apprentice.user.email,
        apprenticeName: apprentice.name,
        masterName: master.name,
        customerName,
        serviceName: booking.service.name,
        address: booking.address,
        mapsLink,
        maskedCustomerPhone,
        fee: formatNaira(booking.proEarning),
      }).catch((err) =>
        console.error("[delegate] apprentice email failed:", err),
      );
    }

    // Customer WhatsApp
    if (booking.customer.phone) {
      notifyCustomerBookingDeployed({
        customerPhone: booking.customer.phone,
        masterName: master.name,
        apprenticeName: apprentice.name,
      }).catch((err) =>
        console.error("[delegate] customer WA failed:", err),
      );
    }

    // Customer email
    if (booking.customer.email) {
      emailCustomerBookingDeployed({
        to: booking.customer.email,
        customerName: customerName,
        masterName: master.name,
        apprenticeName: apprentice.name,
        serviceName: booking.service.name,
      }).catch((err) =>
        console.error("[delegate] customer email failed:", err),
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        apprenticeId: apprentice.id,
        apprenticeName: apprentice.name,
      },
    });
  } catch (err) {
    console.error("[bookings/[id]/delegate] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to deploy booking" },
      { status: 500 },
    );
  }
}
