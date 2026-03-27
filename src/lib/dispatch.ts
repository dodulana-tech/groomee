import { db } from "./db";
import { sendProJobOffer } from "./whatsapp";
import { format } from "date-fns";

const DISPATCH_TIMEOUT =
  parseInt(process.env.DISPATCH_TIMEOUT_SECONDS ?? "180") * 1000;

// ─── FIND AVAILABLE PROS ─────────────────────────────────────────────────────

export async function findAvailablePros(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, zone: true, customer: true },
  });

  if (!booking) throw new Error("Booking not found");

  // Get IDs of pros already tried (from persisted DispatchLog)
  const priorAttempts = await db.dispatchLog.findMany({
    where: { bookingId },
    select: { proId: true },
  });
  const triedIds = priorAttempts.map((d) => d.proId);

  // Check if customer has a squad - squad members get priority
  const squad = await db.favouritePro.findMany({
    where: { userId: booking.customerId },
    include: { pro: true },
    orderBy: { priority: "asc" },
  });

  const eligibleSquad = squad
    .filter((f: any) => !triedIds.includes(f.proId))
    .filter(
      (f: any) =>
        f.pro.status === "ACTIVE" && f.pro.availability === "ONLINE",
    );

  if (eligibleSquad.length > 0) {
    const squadIds = eligibleSquad.map((f: any) => f.proId);
    const qualifiedSquad = await db.pro.findMany({
      where: {
        id: { in: squadIds },
        services: { some: { serviceId: booking.serviceId } },
        zones: booking.zoneId
          ? { some: { zoneId: booking.zoneId } }
          : undefined,
      },
    });

    if (qualifiedSquad.length > 0) {
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
  return db.pro.findMany({
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

// ─── OFFER JOB TO PRO ────────────────────────────────────────────────────────

export async function offerJobToPro(bookingId: string, proId: string) {
  const [booking, pro] = await Promise.all([
    db.booking.findUnique({
      where: { id: bookingId },
      include: { service: true, zone: true, customer: true },
    }),
    db.pro.findUnique({ where: { id: proId } }),
  ]);

  if (!booking || !pro) throw new Error("Not found");

  const serviceTime = booking.scheduledFor
    ? format(booking.scheduledFor, "EEE do MMM, h:mmaaa")
    : "As soon as possible";

  const area =
    booking.zone?.name ?? booking.address.split(",").slice(-2).join(",").trim();

  // Fetch beauty profile + squad status in parallel
  const [beautyProfile, isSquadMember] = await Promise.all([
    db.beautyProfile.findUnique({ where: { userId: booking.customerId } }),
    db.favouritePro.findFirst({ where: { userId: booking.customerId, proId } }),
  ]);

  let profileBrief = "";
  if (beautyProfile) {
    const parts: string[] = [];
    if (beautyProfile.hairType) parts.push(`${beautyProfile.hairType} hair`);
    if (beautyProfile.hairLength) parts.push(beautyProfile.hairLength);
    if (beautyProfile.colourTreated) parts.push("colour-treated");
    if (beautyProfile.scalpCondition && beautyProfile.scalpCondition !== "normal")
      parts.push(`${beautyProfile.scalpCondition} scalp`);
    if (beautyProfile.allergies?.length)
      parts.push(`allergies: ${beautyProfile.allergies.join(", ")}`);
    if (beautyProfile.styleNotes)
      parts.push(beautyProfile.styleNotes.slice(0, 80));
    if (parts.length > 0)
      profileBrief = `\n📋 *Customer profile:* ${parts.join(" · ")}`;
  }

  const squadNote = isSquadMember
    ? "\n⭐ *This customer has you in their Favourite Pros!*"
    : "";

  // Persist dispatch attempt to DB + increment counter
  await db.$transaction([
    db.dispatchLog.create({
      data: {
        bookingId,
        proId,
        proName: pro.name,
        offeredAt: new Date(),
      },
    }),
    db.booking.update({
      where: { id: bookingId },
      data: { dispatchAttempts: { increment: 1 } },
    }),
  ]);

  await sendProJobOffer({
    phone: pro.phone,
    proName: pro.name.split(" ")[0],
    customerArea: area,
    serviceName: booking.service.name,
    bookingTime: serviceTime,
    fee: booking.proEarning,
    profileBrief: profileBrief + squadNote,
  });

  // Schedule timeout (in production, use a job queue like BullMQ/Inngest)
  scheduleDispatchTimeout(bookingId, proId, DISPATCH_TIMEOUT);
}

// ─── HANDLE PRO RESPONSE ─────────────────────────────────────────────────────

export async function handleProResponse(
  proId: string,
  response: "YES" | "NO",
  bookingId?: string,
) {
  // Find the booking — prefer explicit bookingId, fall back to most recent offer to THIS pro
  let booking;
  if (bookingId) {
    booking = await db.booking.findUnique({ where: { id: bookingId } });
  } else {
    // Look up from dispatch log — find the most recent offer to this specific pro
    const latestOffer = await db.dispatchLog.findFirst({
      where: { proId, response: null },
      orderBy: { offeredAt: "desc" },
      include: { booking: true },
    });
    booking = latestOffer?.booking ?? null;
  }

  if (!booking || booking.status !== "DISPATCHING") return { found: false };

  // Update dispatch log entry
  await db.dispatchLog.updateMany({
    where: { bookingId: booking.id, proId, response: null },
    data: {
      response: response === "YES" ? "accepted" : "declined",
      respondAt: new Date(),
    },
  });

  if (response === "YES") {
    // Transactional accept — atomic booking + pro update
    await db.$transaction([
      db.booking.update({
        where: { id: booking.id },
        data: {
          proId,
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      }),
      // Only mark pro BUSY if they're still ONLINE (prevents double-booking)
      db.pro.update({
        where: { id: proId },
        data: { availability: "BUSY", currentBookingId: booking.id },
      }),
    ]);

    return { found: true, accepted: true, bookingId: booking.id };
  } else {
    // Declined - try next pro
    await tryNextPro(booking.id);
    return { found: true, accepted: false, bookingId: booking.id };
  }
}

// ─── TRY NEXT PRO ────────────────────────────────────────────────────────────

export async function tryNextPro(bookingId: string) {
  const settings = await db.setting.findMany({
    where: { key: { in: ["DISPATCH_MAX_ATTEMPTS"] } },
  });
  const maxAttempts = parseInt(
    settings.find((s) => s.key === "DISPATCH_MAX_ATTEMPTS")?.value ?? "5",
  );

  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status !== "DISPATCHING") return;

  if ((booking.dispatchAttempts ?? 0) >= maxAttempts) {
    await db.booking.update({
      where: { id: bookingId },
      data: { status: "NO_GROOMER" },
    });
    return { noPro: true };
  }

  const available = await findAvailablePros(bookingId);
  if (available.length === 0) {
    await db.booking.update({
      where: { id: bookingId },
      data: { status: "NO_GROOMER" },
    });
    return { noPro: true };
  }

  await offerJobToPro(bookingId, available[0].id);
  return { dispatched: true, proId: available[0].id };
}

// ─── DISPATCH TIMEOUT ─────────────────────────────────────────────────────────

function scheduleDispatchTimeout(
  bookingId: string,
  proId: string,
  delay: number,
) {
  setTimeout(async () => {
    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status !== "DISPATCHING") return;
    // Mark this offer as timed out
    await db.dispatchLog.updateMany({
      where: { bookingId, proId, response: null },
      data: { response: "timeout", respondAt: new Date() },
    });
    await tryNextPro(bookingId);
  }, delay);
}

// ─── STRIKES ─────────────────────────────────────────────────────────────────

export async function issueStrike(
  proId: string,
  bookingId: string,
  reason:
    | "NO_RESPONSE"
    | "CANCELLED_BEFORE"
    | "CANCELLED_ENROUTE"
    | "NO_SHOW"
    | "MISCONDUCT",
  notes?: string,
) {
  const { sendProStrikeNotice } = await import("./whatsapp");

  await db.strike.create({
    data: { proId, bookingId, reason, notes },
  });

  const pro = await db.pro.update({
    where: { id: proId },
    data: { strikeCount: { increment: 1 } },
  });

  await sendProStrikeNotice(
    pro.phone,
    pro.strikeCount,
    reason.replace(/_/g, " "),
  );

  if (pro.strikeCount >= 3) {
    await db.pro.update({
      where: { id: proId },
      data: { status: "SUSPENDED", availability: "OFFLINE" },
    });
  }

  return pro.strikeCount;
}
