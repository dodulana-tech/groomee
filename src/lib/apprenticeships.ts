import { db } from "./db";
import type { Apprenticeship, CurriculumModule, Pro } from "@prisma/client";

// ─── DEFAULT CURRICULUM ──────────────────────────────────────────────────────
//
// Copied into a new Apprenticeship's CurriculumModule rows when a master
// invites an apprentice. Masters can edit per-apprentice afterward. The
// `gatesIndependence` flag identifies modules that must be completed AND
// signed off before the apprentice can take their own customer bookings.

export interface ModuleTemplate {
  title: string;
  description: string;
  required: boolean;
  gatesIndependence: boolean;
}

export const DEFAULT_CURRICULUM: ModuleTemplate[] = [
  {
    title: "Hygiene, sanitation & sterilisation",
    description:
      "Tool sterilisation, hand hygiene between clients, single-use items where required, NAFDAC-aligned hygiene basics.",
    required: true,
    gatesIndependence: true,
  },
  {
    title: "Client communication & consultation",
    description:
      "Pre-service consultation, reading care notes, asking the right questions, managing expectations and difficult conversations.",
    required: true,
    gatesIndependence: true,
  },
  {
    title: "Core technique fundamentals",
    description:
      "Foundational skills for the master's primary specialty — completed under direct supervision until master sign-off.",
    required: true,
    gatesIndependence: true,
  },
  {
    title: "Punctuality, scheduling & ETA discipline",
    description:
      "Reading the dispatch flow, accepting/declining offers professionally, ETA management, customer notifications.",
    required: true,
    gatesIndependence: true,
  },
  {
    title: "Money, savings & business basics",
    description:
      "How earnings flow on Groomee, payouts, building savings habits, separating service costs from take-home.",
    required: true,
    gatesIndependence: false,
  },
  {
    title: "Advanced technique — speciality 1",
    description:
      "First advanced skill set unique to the master's practice. Required for Freedom; not required for independence.",
    required: true,
    gatesIndependence: false,
  },
  {
    title: "Advanced technique — speciality 2",
    description:
      "Second advanced skill set. Required for Freedom; not required for independence.",
    required: true,
    gatesIndependence: false,
  },
];

// ─── COMMISSION & DEFAULTS ───────────────────────────────────────────────────

export const DEFAULT_MASTER_COMMISSION = 0.30;
export const FREEDOM_MIN_COMPLETED_JOBS = 60;
export const FREEDOM_MIN_AVG_RATING = 4.5;

// Permissions added to seed roles in this slice — reused by the admin pages.
export const APPRENTICESHIP_PERMISSIONS = {
  view: "apprenticeships.view",
  manage: "apprenticeships.manage",
} as const;

// ─── INDEPENDENCE GATING ─────────────────────────────────────────────────────

/**
 * An apprentice can take independent customer bookings only when:
 *   1. They have an active apprenticeship in IN_TRAINING (or beyond), AND
 *   2. The master has flipped masterApprovedIndependence, AND
 *   3. Every gating module is completed AND has a master sign-off.
 *
 * Pros who are INDEPENDENT or FREED are always allowed (the apprenticeship
 * relationship has either ended or never existed).
 */
export async function canTakeIndependentBookings(
  proId: string,
): Promise<boolean> {
  const pro = await db.pro.findUnique({
    where: { id: proId },
    select: { id: true, relationship: true, status: true },
  });
  if (!pro || pro.status !== "ACTIVE") return false;
  if (pro.relationship !== "APPRENTICE") return true;

  const apprenticeship = await db.apprenticeship.findFirst({
    where: { apprenticeId: proId, status: { in: ["IN_TRAINING", "READY_FOR_FREEDOM"] } },
    include: {
      modules: {
        where: { gatesIndependence: true, required: true },
        select: { completedAt: true, masterSignoffAt: true },
      },
    },
  });
  if (!apprenticeship) return false;
  if (apprenticeship.masterApprovedIndependence === null) return false;
  if (apprenticeship.modules.length === 0) return false;
  return apprenticeship.modules.every(
    (m) => m.completedAt !== null && m.masterSignoffAt !== null,
  );
}

/**
 * Find the active apprenticeship for a pro (apprentice side). Returns null if
 * the pro is not currently apprenticed. Useful for earnings split logic.
 */
export async function getActiveApprenticeshipForApprentice(
  apprenticeId: string,
): Promise<(Apprenticeship & { master: Pro }) | null> {
  return db.apprenticeship.findFirst({
    where: {
      apprenticeId,
      status: { in: ["IN_TRAINING", "READY_FOR_FREEDOM"] },
    },
    include: { master: true },
    orderBy: { acceptedAt: "desc" },
  });
}

/**
 * True when every required-and-gating module is complete and signed off AND
 * the apprentice clears the freedom job/rating thresholds. Used to flip status
 * to READY_FOR_FREEDOM.
 */
export async function isFreedomReady(
  apprenticeshipId: string,
): Promise<boolean> {
  const apprenticeship = await db.apprenticeship.findUnique({
    where: { id: apprenticeshipId },
    include: {
      modules: { where: { required: true } },
      apprentice: { select: { totalJobs: true, avgRating: true } },
    },
  });
  if (!apprenticeship) return false;
  if (apprenticeship.status !== "IN_TRAINING") return false;
  const allModulesDone = apprenticeship.modules.every(
    (m) => m.completedAt !== null && m.masterSignoffAt !== null,
  );
  if (!allModulesDone) return false;
  if (apprenticeship.apprentice.totalJobs < FREEDOM_MIN_COMPLETED_JOBS) return false;
  if (apprenticeship.apprentice.avgRating < FREEDOM_MIN_AVG_RATING) return false;
  return true;
}

/**
 * Generate a public verification code for a Freedom certificate. 12 chars,
 * uppercase + digits, dashed for legibility on a printable cert.
 */
export function generateFreedomCertCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit ambiguous I/O/0/1
  const part = (len: number) =>
    Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `${part(4)}-${part(4)}-${part(4)}`;
}

// ─── EARNINGS SPLIT (Slice 3 will use this) ──────────────────────────────────

export interface EarningSplit {
  apprenticeAmount: number;
  masterAmount: number;
  apprenticeshipId: string;
  masterId: string;
}

/**
 * Given the pro's net-of-platform earning for a booking, return the split when
 * the pro is an active apprentice. Returns null when no split applies (the
 * caller should fall back to a single SERVICE earning row).
 */
export async function computeEarningsSplit(
  proId: string,
  proEarning: number,
): Promise<EarningSplit | null> {
  const apprenticeship = await getActiveApprenticeshipForApprentice(proId);
  if (!apprenticeship) return null;
  const masterAmount = Math.round(proEarning * apprenticeship.masterCommission * 100) / 100;
  const apprenticeAmount = Math.round((proEarning - masterAmount) * 100) / 100;
  return {
    apprenticeAmount,
    masterAmount,
    apprenticeshipId: apprenticeship.id,
    masterId: apprenticeship.masterId,
  };
}

export type { Apprenticeship, CurriculumModule };
