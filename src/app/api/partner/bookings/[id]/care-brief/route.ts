import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  checkContraindications,
  writeAccessLog,
  findConditionDef,
} from "@/lib/health";

/**
 * GET the pre-arrival care brief for a booking.
 *
 * Auth: the pro currently holding the booking, OR an admin.
 *
 * Behaviour:
 *  - If a HealthAcknowledgment already exists for this booking, return the
 *    frozen snapshot exactly as captured. This is the contract — once the
 *    pro has acknowledged, the view they're shown is the view they agreed
 *    to, even if the customer subsequently edits the profile.
 *  - Otherwise compose a live brief: customer's active conditions + the
 *    contraindications that apply to the service(s) on this booking.
 *  - Return 404 when no profile, profile is PRIVATE, or visibility is
 *    ASK_PER_BOOKING (until customer-side opt-in lands in a follow-up
 *    slice — see TODO below).
 *
 * Every successful brief fetch writes a HealthAccessLog row — PHI access
 * trail. We do this BEFORE returning the response.
 */
export async function GET(
  _req: NextRequest,
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

    // ─── Authorisation: must be the pro holding the booking, or admin. ──────
    let accessorRole: "PRO" | "ADMIN" = "ADMIN";
    let accessorId: string | null = null;
    if (session.role === "PRO") {
      const pro = await db.pro.findFirst({
        where: { userId: session.userId },
      });
      if (!pro || booking.proId !== pro.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 },
        );
      }
      accessorRole = "PRO";
      accessorId = pro.id;
    } else {
      accessorId = session.userId;
    }

    // ─── Profile lookup ─────────────────────────────────────────────────────
    const profile = await db.healthProfile.findUnique({
      where: { userId: booking.customerId },
      include: { conditions: { where: { resolved: false } } },
    });

    // No profile at all → nothing to show. No access-log row (nothing was read).
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "No care notes" },
        { status: 404 },
      );
    }

    // PRIVATE → never share. No access log; nothing was disclosed.
    if (profile.visibility === "PRIVATE") {
      return NextResponse.json(
        { success: false, error: "No care notes" },
        { status: 404 },
      );
    }

    // ASK_PER_BOOKING → requires per-booking consent. TODO: customer opt-in
    // UI is a follow-up slice; until then we treat as no-share.
    if (profile.visibility === "ASK_PER_BOOKING") {
      return NextResponse.json(
        { success: false, error: "No care notes" },
        { status: 404 },
      );
    }

    // Empty active condition set on a brand-new profile → nothing useful to
    // brief the pro on. Don't log access for a no-op fetch.
    if (profile.conditions.length === 0 && !profile.notes) {
      return NextResponse.json(
        { success: false, error: "No care notes" },
        { status: 404 },
      );
    }

    // ─── If already acknowledged, serve the frozen snapshot ─────────────────
    if (booking.healthAck) {
      await writeAccessLog(
        profile.id,
        accessorRole,
        accessorId,
        `care-brief.read.acknowledged booking=${booking.id}`,
      );
      return NextResponse.json({
        success: true,
        data: {
          frozen: true,
          acknowledgedAt: booking.healthAck.acknowledgedAt,
          snapshot: booking.healthAck.snapshot,
        },
      });
    }

    // ─── Live brief — conditions + contraindications ────────────────────────
    const serviceIds: string[] = [
      booking.serviceId,
      ...booking.items.map((i) => i.serviceId),
    ];
    const hits = await checkContraindications(booking.customerId, serviceIds);

    const conditions = profile.conditions.map((c) => {
      const def = findConditionDef(c.code);
      return {
        code: c.code,
        label: c.label,
        category: c.category,
        severity: c.severity,
        notes: c.notes,
        hint: def?.hint ?? null,
      };
    });

    await writeAccessLog(
      profile.id,
      accessorRole,
      accessorId,
      `care-brief.read.live booking=${booking.id}`,
    );

    return NextResponse.json({
      success: true,
      data: {
        frozen: false,
        acknowledgedAt: null,
        snapshot: {
          profileId: profile.id,
          visibility: profile.visibility,
          notes: profile.notes,
          conditions,
          contraindications: hits,
        },
      },
    });
  } catch (err) {
    console.error("[care-brief GET] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load care brief" },
      { status: 500 },
    );
  }
}
