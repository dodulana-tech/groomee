/**
 * Scheduler — single source of truth for "is this pro free at this time?"
 *
 * Used by:
 *   - POST /api/bookings  (customer creates a scheduled booking on a pro)
 *   - PATCH /api/admin/bookings/[id]/assign  (admin assigns a pro)
 *   - /api/admin/pros/[id]/calendar  (admin day view)
 *   - /api/partner/calendar  (pro day view)
 *   - /api/pros/[id]/availability  (customer slot picker)
 *
 * Travel time between zones comes from the admin-tuned ZoneTravel matrix;
 * missing pairs fall back to DEFAULT_CROSS_ZONE_MINS. Pros' working hours
 * live in ProSchedule (weekly recurring, interpreted in Africa/Lagos / WAT).
 */
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

// Africa/Lagos has no DST and is fixed at UTC+1.
const WAT_OFFSET = "+01:00";
export const DEFAULT_CROSS_ZONE_MINS = 30;
export const SAME_ZONE_MINS = 0;
export const SLOT_STEP_MINS = 30;
// Booking statuses that occupy a pro's calendar. CANCELLED, NO_GROOMER,
// and DISPUTED are released.
const ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.DISPATCHING,
  BookingStatus.ACCEPTED,
  BookingStatus.EN_ROUTE,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
  BookingStatus.COMPLETED,
  BookingStatus.CONFIRMED,
];

export type SchedulingBooking = {
  id: string;
  reference: string;
  proId: string | null;
  zoneId: string | null;
  scheduledFor: Date | null;
  durationMins: number;
  isAsap: boolean;
  status: string;
  service: { name: string; durationMins: number };
  customer: { id: string; name: string | null } | null;
  zone: { id: string; name: string; slug: string } | null;
};

/* ─────────────────────────────────────────────────────────────
 * Duration + window helpers
 * ───────────────────────────────────────────────────────────── */

export function effectiveDurationMins(b: {
  durationMins?: number | null;
  service?: { durationMins?: number | null } | null;
}): number {
  if (b.durationMins && b.durationMins > 0) return b.durationMins;
  return b.service?.durationMins ?? 60;
}

export function bookingWindow(b: {
  scheduledFor: Date | null;
  durationMins?: number | null;
  service?: { durationMins?: number | null } | null;
}): { start: Date; end: Date } | null {
  if (!b.scheduledFor) return null;
  const start = new Date(b.scheduledFor);
  const end = new Date(start.getTime() + effectiveDurationMins(b) * 60_000);
  return { start, end };
}

/* ─────────────────────────────────────────────────────────────
 * Travel time
 * ───────────────────────────────────────────────────────────── */

export async function travelMinsBetween(
  fromZoneId: string | null | undefined,
  toZoneId: string | null | undefined,
): Promise<number> {
  if (!fromZoneId || !toZoneId) return DEFAULT_CROSS_ZONE_MINS;
  if (fromZoneId === toZoneId) return SAME_ZONE_MINS;
  const row = await db.zoneTravel.findUnique({
    where: { fromZoneId_toZoneId: { fromZoneId, toZoneId } },
  });
  if (row && row.isActive) return row.travelMins;
  return DEFAULT_CROSS_ZONE_MINS;
}

/* ─────────────────────────────────────────────────────────────
 * Working hours (Africa/Lagos)
 * ───────────────────────────────────────────────────────────── */

function watDayKey(d: Date): string {
  // Calendar date in WAT, "YYYY-MM-DD"
  const tz = new Date(d.getTime() + 60 * 60_000); // shift to WAT
  return tz.toISOString().slice(0, 10);
}

function watDayOfWeek(d: Date): number {
  const tz = new Date(d.getTime() + 60 * 60_000);
  return tz.getUTCDay();
}

function watInstant(dayKey: string, hhmm: string): Date {
  // Build a UTC Date representing the given "HH:MM" on the WAT calendar day.
  return new Date(`${dayKey}T${hhmm}:00${WAT_OFFSET}`);
}

export type WorkingWindow = { start: Date; end: Date } | null;

export async function getWorkingWindow(
  proId: string,
  anchor: Date,
): Promise<WorkingWindow> {
  const dow = watDayOfWeek(anchor);
  const sched = await db.proSchedule.findUnique({
    where: { proId_dayOfWeek: { proId, dayOfWeek: dow } },
  });
  if (!sched || !sched.isActive) return null;
  const day = watDayKey(anchor);
  return {
    start: watInstant(day, sched.startTime),
    end: watInstant(day, sched.endTime),
  };
}

export async function inWorkingHours(opts: {
  proId: string;
  start: Date;
  end: Date;
}): Promise<boolean> {
  const w = await getWorkingWindow(opts.proId, opts.start);
  if (!w) return false;
  return opts.start >= w.start && opts.end <= w.end;
}

/* ─────────────────────────────────────────────────────────────
 * Busy fetch
 * ───────────────────────────────────────────────────────────── */

export async function getProBookingsInRange(
  proId: string,
  rangeStart: Date,
  rangeEnd: Date,
  excludeBookingId?: string,
): Promise<SchedulingBooking[]> {
  const rows = await db.booking.findMany({
    where: {
      proId,
      status: { in: ACTIVE_STATUSES },
      scheduledFor: { gte: addMins(rangeStart, -24 * 60), lte: addMins(rangeEnd, 24 * 60) },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    include: {
      service: { select: { name: true, durationMins: true } },
      customer: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { scheduledFor: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    proId: r.proId,
    zoneId: r.zoneId,
    scheduledFor: r.scheduledFor,
    durationMins: r.durationMins,
    isAsap: r.isAsap,
    status: r.status,
    service: { name: r.service.name, durationMins: r.service.durationMins },
    customer: r.customer ? { id: r.customer.id, name: r.customer.name } : null,
    zone: r.zone ? { id: r.zone.id, name: r.zone.name, slug: r.zone.slug } : null,
  }));
}

/* ─────────────────────────────────────────────────────────────
 * Conflict detection
 *
 * Returns the FIRST conflicting booking with a human reason. Two windows
 * collide when:
 *
 *   newStart  <  existing.end + travel(existing.zone → newZone)
 *   AND
 *   newEnd    >  existing.start - travel(newZone → existing.zone)
 *
 * i.e. the proposed block, padded by transit, would overlap an existing
 * padded block.
 * ───────────────────────────────────────────────────────────── */

export type ConflictHit = {
  conflict: true;
  reason: string;
  withBookingId: string;
  withReference: string;
  needsTravelMins: number;
};
export type ConflictMiss = { conflict: false };

export async function findConflict(opts: {
  proId: string;
  start: Date;
  end: Date;
  zoneId: string | null | undefined;
  excludeBookingId?: string;
}): Promise<ConflictHit | ConflictMiss> {
  const { proId, start, end, zoneId, excludeBookingId } = opts;
  // Look 24h before/after for adjacency.
  const rangeStart = addMins(start, -24 * 60);
  const rangeEnd = addMins(end, 24 * 60);
  const existing = await getProBookingsInRange(
    proId,
    rangeStart,
    rangeEnd,
    excludeBookingId,
  );

  for (const ex of existing) {
    const w = bookingWindow(ex);
    if (!w) continue;
    const travelFromEx = await travelMinsBetween(ex.zoneId, zoneId);
    const travelToEx = await travelMinsBetween(zoneId, ex.zoneId);
    const paddedExEnd = addMins(w.end, travelFromEx);
    const paddedExStart = addMins(w.start, -travelToEx);
    const overlaps = start < paddedExEnd && end > paddedExStart;
    if (overlaps) {
      const needsTravel = Math.max(travelFromEx, travelToEx);
      const who = ex.customer?.name ?? "another customer";
      const zoneNote =
        ex.zone && zoneId && ex.zoneId !== zoneId
          ? ` (needs ${needsTravel} min travel from ${ex.zone.name})`
          : "";
      return {
        conflict: true,
        reason: `Conflicts with booking ${ex.reference} for ${who}${zoneNote}.`,
        withBookingId: ex.id,
        withReference: ex.reference,
        needsTravelMins: needsTravel,
      };
    }
  }
  return { conflict: false };
}

/* ─────────────────────────────────────────────────────────────
 * Available slots for a customer-facing picker.
 *
 * Walks the pro's working window for the given day in SLOT_STEP_MINS
 * increments and returns starts where a booking of `durationMins` would
 * fit (working hours + no conflict). Slots in the past are filtered out.
 * ───────────────────────────────────────────────────────────── */

export async function getAvailableSlots(opts: {
  proId: string;
  date: Date;
  durationMins: number;
  zoneId: string | null | undefined;
  minLeadMins?: number;
  step?: number;
}): Promise<Date[]> {
  const step = opts.step ?? SLOT_STEP_MINS;
  const minLead = opts.minLeadMins ?? 60;
  const work = await getWorkingWindow(opts.proId, opts.date);
  if (!work) return [];

  const slots: Date[] = [];
  const earliestStart = new Date(Date.now() + minLead * 60_000);
  let cursor = new Date(work.start);
  while (addMins(cursor, opts.durationMins) <= work.end) {
    if (cursor >= earliestStart) {
      const start = new Date(cursor);
      const end = addMins(start, opts.durationMins);
      const hit = await findConflict({
        proId: opts.proId,
        start,
        end,
        zoneId: opts.zoneId,
      });
      if (!hit.conflict) slots.push(start);
    }
    cursor = addMins(cursor, step);
  }
  return slots;
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function addMins(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

export function formatWatTime(d: Date): string {
  // Returns "h:mm AM/PM" in Africa/Lagos.
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(d);
}

export function watDayBounds(anchor: Date): { dayStart: Date; dayEnd: Date } {
  const day = watDayKey(anchor);
  return {
    dayStart: watInstant(day, "00:00"),
    dayEnd: watInstant(day, "23:59"),
  };
}
