/**
 * Health-aware notifications. Called from the booking-assignment paths
 * (auto-dispatch + admin assign) to nudge the pro to read the care brief
 * before the appointment.
 *
 * No-op when:
 *   - the customer has no profile, no active conditions, no notes
 *   - the profile is PRIVATE or ASK_PER_BOOKING (until per-booking consent
 *     UI lands — same gate as the care-brief endpoint)
 *   - the chosen pro has no contactable email
 *   - none of the booking's services would actually trigger a hit
 */
import { db } from "@/lib/db";
import { checkContraindications } from "@/lib/health";
import { emailProCareNotes } from "@/lib/email-notify";

export async function notifyProCareNotes(bookingId: string): Promise<void> {
  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: { select: { serviceId: true } },
        pro: {
          select: {
            id: true,
            name: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!booking || !booking.proId || !booking.pro) return;

    // Pull the customer's profile if we'd be allowed to share it.
    const profile = await db.healthProfile.findUnique({
      where: { userId: booking.customerId },
      include: { conditions: { where: { resolved: false }, take: 1 } },
    });
    if (!profile) return;
    if (profile.visibility !== "ALWAYS_SHARE") return;
    if (profile.conditions.length === 0 && !profile.notes) return;

    // Only fire when there's actually something actionable on this service set.
    const serviceIds = [
      booking.serviceId,
      ...booking.items.map((it) => it.serviceId),
    ];
    const hits = await checkContraindications(booking.customerId, serviceIds);
    if (hits.length === 0) return;

    const email = booking.pro.user?.email;
    if (!email) return;

    await emailProCareNotes({
      to: email,
      proName: booking.pro.name,
      bookingRef: booking.reference,
    });
  } catch (err) {
    // Best-effort — never block assignment on a notification failure.
    console.error("[notifyProCareNotes] failed", err);
  }
}
