import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  buildAckSnapshot,
  checkContraindications,
  writeAccessLog,
} from "@/lib/health";

const BodySchema = z.object({}).strict();

/**
 * POST — pro acknowledges the care brief for a booking.
 *
 * Idempotent: upsert keyed on bookingId (the unique constraint on
 * HealthAcknowledgment). A second POST returns the existing row unchanged.
 *
 * The pro recorded on the ack row is THE PRO CURRENTLY HOLDING THE BOOKING —
 * for apprentice deployments this is the apprentice, not the master, even
 * though the master may have delegated the booking.
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
    if (session.role !== "PRO") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // Validate (empty) body — strict so any junk in the payload is rejected.
    try {
      const raw = await req.json().catch(() => ({}));
      BodySchema.parse(raw ?? {});
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid body" },
        { status: 400 },
      );
    }

    const pro = await db.pro.findFirst({
      where: { userId: session.userId },
    });
    if (!pro) {
      return NextResponse.json(
        { success: false, error: "Pro not found" },
        { status: 404 },
      );
    }

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        items: { select: { serviceId: true } },
        healthAck: true,
      },
    });
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 },
      );
    }
    if (booking.proId !== pro.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // ─── Idempotency: re-ack returns the existing row ───────────────────────
    if (booking.healthAck) {
      return NextResponse.json({
        success: true,
        data: {
          id: booking.healthAck.id,
          bookingId: booking.healthAck.bookingId,
          acknowledgedAt: booking.healthAck.acknowledgedAt,
          snapshot: booking.healthAck.snapshot,
          alreadyAcknowledged: true,
        },
      });
    }

    // ─── Profile + visibility checks ────────────────────────────────────────
    const profile = await db.healthProfile.findUnique({
      where: { userId: booking.customerId },
      include: { conditions: { where: { resolved: false } } },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "No profile to acknowledge" },
        { status: 404 },
      );
    }
    if (profile.visibility === "PRIVATE") {
      return NextResponse.json(
        { success: false, error: "Profile is private" },
        { status: 403 },
      );
    }
    if (profile.visibility === "ASK_PER_BOOKING") {
      // TODO: customer per-booking opt-in is a follow-up slice. Until then,
      // treat this branch the same as no-share — nothing to acknowledge.
      return NextResponse.json(
        { success: false, error: "Profile requires customer consent" },
        { status: 403 },
      );
    }

    // Build a snapshot that includes the contraindication picture the pro
    // actually saw — conditions + per-service warnings — so the frozen view
    // is a faithful record of what was briefed.
    const base = await buildAckSnapshot(profile.id);
    if (!base) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    const serviceIds: string[] = [
      booking.serviceId,
      ...booking.items.map((i) => i.serviceId),
    ];
    const contraindications = await checkContraindications(
      booking.customerId,
      serviceIds,
    );
    const snapshot = {
      ...base,
      contraindications,
    };

    // Upsert (key: bookingId). Concurrent double-POSTs collapse onto one row.
    // Prisma's Json scalar expects a plain object; the cast is safe because
    // `snapshot` is JSON-serialisable.
    const ack = await db.healthAcknowledgment.upsert({
      where: { bookingId: booking.id },
      update: {},
      create: {
        bookingId: booking.id,
        profileId: profile.id,
        proId: pro.id,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    await writeAccessLog(
      profile.id,
      "PRO",
      pro.id,
      `care-brief.acknowledged booking=${booking.id}`,
    );

    return NextResponse.json({
      success: true,
      data: {
        id: ack.id,
        bookingId: ack.bookingId,
        acknowledgedAt: ack.acknowledgedAt,
        snapshot: ack.snapshot,
        alreadyAcknowledged: false,
      },
    });
  } catch (err) {
    console.error("[care-brief POST acknowledge] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to acknowledge" },
      { status: 500 },
    );
  }
}
