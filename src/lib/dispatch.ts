import { db } from "./db";
import { sendGroomerJobOffer } from "./whatsapp";
import { format } from "date-fns";
import type { DispatchAttempt } from "@/types";

const DISPATCH_TIMEOUT =
  parseInt(process.env.DISPATCH_TIMEOUT_SECONDS ?? "180") * 1000;

// ─── FIND AVAILABLE GROOMERS ─────────────────────────────────────────────────

export async function findAvailableGroomers(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, zone: true, customer: true },
  });

  if (!booking) throw new Error("Booking not found");

  // Check if customer has a squad — squad members get priority
  const squad = await db.favouriteGroomer.findMany({
    where: { userId: booking.customerId },
    include: { groomer: true },
    orderBy: { priority: "asc" },
  });

  const dispatchLog: DispatchAttempt[] = [];
  const triedIds = dispatchLog.map((d) => d.groomerId);

  // Squad groomers who are online, offer correct service, and haven't been tried
  const eligibleSquad = squad
    .filter((f: any) => !triedIds.includes(f.groomerId))
    .filter(
      (f: any) =>
        f.groomer.status === "ACTIVE" && f.groomer.availability === "ONLINE",
    );

  if (eligibleSquad.length > 0) {
    // Verify squad groomers actually offer this service in this zone
    const squadIds = eligibleSquad.map((f: any) => f.groomerId);
    const qualifiedSquad = await db.groomer.findMany({
      where: {
        id: { in: squadIds },
        services: { some: { serviceId: booking.serviceId } },
        zones: booking.zoneId
          ? { some: { zoneId: booking.zoneId } }
          : undefined,
      },
    });

    if (qualifiedSquad.length > 0) {
      // Return squad first, then fill with wider pool
      const widerPool = await getWiderPool(
        booking,
        triedIds.concat(qualifiedSquad.map((g) => g.id)),
      );
      return [...qualifiedSquad, ...widerPool];
    }
  }

  return getWiderPool(booking, triedIds);
}

async function getWiderPool(
  booking: { serviceId: string; zoneId: string | null },
  excludeIds: string[],
) {
  return db.groomer.findMany({
    where: {
      status: "ACTIVE",
      availability: "ONLINE",
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      services: { some: { serviceId: booking.serviceId } },
      zones: booking.zoneId ? { some: { zoneId: booking.zoneId } } : undefined,
    },
    orderBy: [{ avgRating: "desc" }, { totalJobs: "desc" }],
  });
}

// ─── OFFER JOB TO GROOMER ─────────────────────────────────────────────────────

export async function offerJobToGroomer(bookingId: string, groomerId: string) {
  const [booking, groomer] = await Promise.all([
    db.booking.findUnique({
      where: { id: bookingId },
      include: { service: true, zone: true, customer: true },
    }),
    db.groomer.findUnique({ where: { id: groomerId } }),
  ]);

  if (!booking || !groomer) throw new Error("Not found");

  const serviceTime = booking.scheduledFor
    ? format(booking.scheduledFor, "EEE do MMM, h:mmaaa")
    : "As soon as possible";

  const area =
    booking.zone?.name ?? booking.address.split(",").slice(-2).join(",").trim();

  // Fetch beauty profile for context brief
  const beautyProfile = await db.beautyProfile.findUnique({
    where: { userId: booking.customerId },
  });

  let profileBrief = "";
  if (beautyProfile) {
    const parts: string[] = [];
    if (beautyProfile.hairType) parts.push(`${beautyProfile.hairType} hair`);
    if (beautyProfile.hairLength) parts.push(beautyProfile.hairLength);
    if (beautyProfile.colourTreated) parts.push("colour-treated");
    if (
      beautyProfile.scalpCondition &&
      beautyProfile.scalpCondition !== "normal"
    )
      parts.push(`${beautyProfile.scalpCondition} scalp`);
    if (beautyProfile.allergies?.length)
      parts.push(`allergies: ${beautyProfile.allergies.join(", ")}`);
    if (beautyProfile.styleNotes)
      parts.push(beautyProfile.styleNotes.slice(0, 80));
    if (parts.length > 0)
      profileBrief = `\n📋 *Customer profile:* ${parts.join(" · ")}`;
  }

  // Check if this is a squad booking
  const isSquadMember = await db.favouriteGroomer.findFirst({
    where: { userId: booking.customerId, groomerId },
  });
  const squadNote = isSquadMember
    ? "\n⭐ *This customer has you in their Groomer Squad!*"
    : "";

  await sendGroomerJobOffer({
    phone: groomer.phone,
    groomerName: groomer.name.split(" ")[0],
    customerArea: area,
    serviceName: booking.service.name,
    bookingTime: serviceTime,
    fee: booking.groomerEarning,
    profileBrief: profileBrief + squadNote,
  });

  // Log offer in dispatch log
  const dispatchLog: DispatchAttempt[] = [];
  const attempt: DispatchAttempt = {
    groomerId: groomer.id,
    groomerName: groomer.name,
    offeredAt: new Date().toISOString(),
    response: null,
  };

  // Schedule timeout — in production this would use a queue (e.g. BullMQ)
  // For MVP, we use a setTimeout-based approach
  scheduleDispatchTimeout(bookingId, groomerId, DISPATCH_TIMEOUT);
}

// ─── HANDLE GROOMER RESPONSE ─────────────────────────────────────────────────

export async function handleGroomerResponse(
  groomerId: string,
  response: "YES" | "NO",
  bookingId?: string,
) {
  // Find the active booking for this groomer (most recent unresolved offer)
  let booking;
  if (bookingId) {
    booking = await db.booking.findUnique({ where: { id: bookingId } });
  } else {
    booking = await db.booking.findFirst({
      where: {
        status: "DISPATCHING",
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!booking) return { found: false };

  // Update dispatch log
  const dispatchLog: DispatchAttempt[] = [];
  const updatedLog = dispatchLog.map((a) =>
    a.groomerId === groomerId && a.response === null
      ? ({
          ...a,
          response: response === "YES" ? "accepted" : "declined",
          respondedAt: new Date().toISOString(),
        } as DispatchAttempt)
      : a,
  );

  if (response === "YES") {
    await db.booking.update({
      where: { id: booking.id },
      data: {
        groomerId,
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    // Mark groomer as busy
    await db.groomer.update({
      where: { id: groomerId },
      data: { availability: "BUSY", currentBookingId: booking.id },
    });

    return { found: true, accepted: true, bookingId: booking.id };
  } else {
    // Declined — try next groomer
    await tryNextGroomer(booking.id);
    return { found: true, accepted: false, bookingId: booking.id };
  }
}

// ─── TRY NEXT GROOMER ─────────────────────────────────────────────────────────

export async function tryNextGroomer(bookingId: string) {
  const settings = await db.setting.findMany({
    where: { key: { in: ["DISPATCH_MAX_ATTEMPTS"] } },
  });
  const maxAttempts = parseInt(
    settings.find((s) => s.key === "DISPATCH_MAX_ATTEMPTS")?.value ?? "5",
  );

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;

  const dispatchCount = (booking as any).dispatchCount ?? 0;
  if (dispatchCount >= maxAttempts) {
    // Give up — mark as no groomer
    await db.booking.update({
      where: { id: bookingId },
      data: { status: "NO_GROOMER" },
    });
    return { noGroomer: true };
  }

  const available = await findAvailableGroomers(bookingId);
  if (available.length === 0) {
    await db.booking.update({
      where: { id: bookingId },
      data: { status: "NO_GROOMER" },
    });
    return { noGroomer: true };
  }

  await offerJobToGroomer(bookingId, available[0].id);
  return { dispatched: true, groomerId: available[0].id };
}

// ─── DISPATCH TIMEOUT ─────────────────────────────────────────────────────────

function scheduleDispatchTimeout(
  bookingId: string,
  groomerId: string,
  delay: number,
) {
  setTimeout(async () => {
    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status !== "DISPATCHING") return; // Already resolved
    await tryNextGroomer(bookingId);
  }, delay);
}

// ─── STRIKES ─────────────────────────────────────────────────────────────────

export async function issueStrike(
  groomerId: string,
  bookingId: string,
  reason:
    | "NO_RESPONSE"
    | "CANCELLED_BEFORE"
    | "CANCELLED_ENROUTE"
    | "NO_SHOW"
    | "MISCONDUCT",
  notes?: string,
) {
  const { sendGroomerStrikeNotice } = await import("./whatsapp");

  await db.strike.create({
    data: { groomerId, bookingId, reason, notes },
  });

  const groomer = await db.groomer.update({
    where: { id: groomerId },
    data: { strikes: { increment: 1 } as any },
  });

  await sendGroomerStrikeNotice(
    groomer.phone,
    (groomer as any).strikes ?? 0,
    reason.replace(/_/g, " "),
  );

  // Auto-suspend at 3 strikes
  if (((groomer as any).strikes ?? 0) >= 3) {
    await db.groomer.update({
      where: { id: groomerId },
      data: { status: "SUSPENDED", availability: "OFFLINE" },
    });
  }

  return (groomer as any).strikes ?? 0;
}
