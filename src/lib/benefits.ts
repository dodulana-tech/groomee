import { Prisma, BenefitEnrollmentStatus, BenefitDebitStatus } from "@prisma/client";
import { db } from "./db";
import { postMovement, getWallet } from "./wallet";
import { logAdminAction } from "./admin-audit";

// ─── BENEFITS / INSURANCE (Concept #9) ───────────────────────────────────────
//
// Pros enrol in benefit plans (HMO + accident bundle). A monthly cron debits
// the BENEFIT_PREMIUM movement off their wallet. Subsidy by tier:
// Standard 0%, Pro 50%, Elite 100%. Insufficient balance → GRACE for 14d,
// then PAUSED for 30d, then CANCELLED. Reactivation requires fresh waiting.
// Groomee never holds PHI: claims are handoff records only.

export const BENEFITS_SETTING_KEYS = {
  enabled: "BENEFITS_ENABLED",
  minBookings: "BENEFITS_MIN_BOOKINGS",
  minTenureDays: "BENEFITS_MIN_TENURE_DAYS",
  graceDays: "BENEFITS_GRACE_DAYS",
  pauseDays: "BENEFITS_PAUSE_DAYS",
} as const;

export const BENEFITS_DEFAULTS = {
  enabled: true,
  minBookings: 5,
  minTenureDays: 30,
  graceDays: 14,
  pauseDays: 30,
} as const;

export type ProTier = "STANDARD" | "PRO" | "ELITE";

// ─── SETTINGS LOAD ───────────────────────────────────────────────────────────

export interface BenefitsSettings {
  enabled: boolean;
  minBookings: number;
  minTenureDays: number;
  graceDays: number;
  pauseDays: number;
}

export async function loadBenefitsSettings(): Promise<BenefitsSettings> {
  const rows = await db.setting.findMany({
    where: { key: { in: Object.values(BENEFITS_SETTING_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const parseBool = (key: string, fallback: boolean) => {
    const raw = map.get(key);
    if (raw === undefined) return fallback;
    return raw === "true" || raw === "1";
  };
  const parseInt = (key: string, fallback: number) => {
    const raw = map.get(key);
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  return {
    enabled: parseBool(BENEFITS_SETTING_KEYS.enabled, BENEFITS_DEFAULTS.enabled),
    minBookings: parseInt(BENEFITS_SETTING_KEYS.minBookings, BENEFITS_DEFAULTS.minBookings),
    minTenureDays: parseInt(BENEFITS_SETTING_KEYS.minTenureDays, BENEFITS_DEFAULTS.minTenureDays),
    graceDays: parseInt(BENEFITS_SETTING_KEYS.graceDays, BENEFITS_DEFAULTS.graceDays),
    pauseDays: parseInt(BENEFITS_SETTING_KEYS.pauseDays, BENEFITS_DEFAULTS.pauseDays),
  };
}

// ─── TIER ────────────────────────────────────────────────────────────────────
//
// No central tier helper exists today, so we derive from totalJobs + avgRating
// per the locked product decisions.

export function deriveProTier(input: { totalJobs: number; avgRating: number }): ProTier {
  if (input.totalJobs >= 50 && input.avgRating >= 4.8) return "ELITE";
  if (input.totalJobs >= 20 && input.avgRating >= 4.5) return "PRO";
  return "STANDARD";
}

// ─── DATE UTILS ──────────────────────────────────────────────────────────────

function startOfNextMonth(d: Date): Date {
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return next;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function periodKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── ELIGIBILITY ─────────────────────────────────────────────────────────────

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  details: {
    proTier: ProTier;
    completedBookings30d: number;
    daysSinceFirstBooking: number | null;
    walletAvailable: number;
    requiredPremium: number;
    minBookings: number;
    minTenureDays: number;
  };
}

export async function checkEnrolmentEligibility(
  proId: string,
  planId: string,
): Promise<EligibilityResult> {
  const settings = await loadBenefitsSettings();
  const reasons: string[] = [];

  const pro = await db.pro.findUnique({
    where: { id: proId },
    select: { id: true, totalJobs: true, avgRating: true },
  });
  if (!pro) {
    return {
      eligible: false,
      reasons: ["Pro not found"],
      details: {
        proTier: "STANDARD",
        completedBookings30d: 0,
        daysSinceFirstBooking: null,
        walletAvailable: 0,
        requiredPremium: 0,
        minBookings: settings.minBookings,
        minTenureDays: settings.minTenureDays,
      },
    };
  }

  const plan = await db.benefitPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return {
      eligible: false,
      reasons: ["Plan not found"],
      details: {
        proTier: deriveProTier(pro),
        completedBookings30d: 0,
        daysSinceFirstBooking: null,
        walletAvailable: 0,
        requiredPremium: 0,
        minBookings: settings.minBookings,
        minTenureDays: settings.minTenureDays,
      },
    };
  }
  if (!plan.isActive) reasons.push("Plan is inactive");

  const minBookings = plan.minBookings ?? settings.minBookings;
  const minTenureDays = plan.minTenureDays ?? settings.minTenureDays;

  const thirtyDaysAgo = addDays(new Date(), -30);
  const completedBookings30d = await db.booking.count({
    where: {
      proId,
      status: { in: ["COMPLETED", "CONFIRMED"] },
      completedAt: { gte: thirtyDaysAgo },
    },
  });
  if (completedBookings30d < minBookings) {
    reasons.push(
      `Needs ${minBookings} completed bookings in last 30 days (has ${completedBookings30d})`,
    );
  }

  const firstBooking = await db.booking.findFirst({
    where: { proId, status: { in: ["COMPLETED", "CONFIRMED"] } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  let daysSinceFirstBooking: number | null = null;
  if (!firstBooking) {
    reasons.push(`Needs ${minTenureDays} days of tenure (no completed bookings yet)`);
  } else {
    daysSinceFirstBooking = Math.floor(
      (Date.now() - firstBooking.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceFirstBooking < minTenureDays) {
      reasons.push(
        `Needs ${minTenureDays} days since first booking (has ${daysSinceFirstBooking})`,
      );
    }
  }

  const wallet = await getWallet(proId);
  const walletAvailable = wallet?.available ?? 0;
  const proTier = deriveProTier(pro);
  const subsidy = await db.benefitSubsidyRule.findUnique({
    where: { planId_proTier: { planId, proTier } },
  });
  const subsidyPct = subsidy?.subsidyPct ?? 0;
  const requiredPremium = round2(plan.monthlyPremium * (1 - subsidyPct));
  if (walletAvailable < requiredPremium) {
    reasons.push(
      `Wallet must hold at least ₦${requiredPremium.toLocaleString()} (has ₦${walletAvailable.toLocaleString()})`,
    );
  }

  // Already enrolled?
  const existing = await db.proBenefitEnrollment.findUnique({
    where: { proId_planId: { proId, planId } },
  });
  if (existing && existing.status !== "CANCELLED") {
    reasons.push(`Already has an enrolment on this plan (status: ${existing.status})`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    details: {
      proTier,
      completedBookings30d,
      daysSinceFirstBooking,
      walletAvailable,
      requiredPremium,
      minBookings,
      minTenureDays,
    },
  };
}

// ─── ENROL ───────────────────────────────────────────────────────────────────

export interface EnrolProOptions {
  externalPolicyNo?: string | null;
  notes?: string | null;
  /** Skip eligibility gates (admin override). */
  skipEligibility?: boolean;
  /** Run the first debit immediately on enrol. */
  debitNow?: boolean;
}

export async function enrolPro(
  proId: string,
  planId: string,
  adminId: string,
  opts: EnrolProOptions = {},
): Promise<{
  enrollment: Awaited<ReturnType<typeof db.proBenefitEnrollment.findUnique>>;
  eligibility?: EligibilityResult;
  debit?: SingleDebitResult;
}> {
  const eligibility = opts.skipEligibility
    ? undefined
    : await checkEnrolmentEligibility(proId, planId);
  if (eligibility && !eligibility.eligible) {
    return { enrollment: null, eligibility };
  }

  const now = new Date();
  // If a previously-cancelled enrolment exists, recycle the row.
  const existing = await db.proBenefitEnrollment.findUnique({
    where: { proId_planId: { proId, planId } },
  });

  let enrollment;
  if (existing) {
    enrollment = await db.proBenefitEnrollment.update({
      where: { id: existing.id },
      data: {
        status: "PENDING",
        enrolledAt: now,
        activatedAt: null,
        nextDebitAt: now,
        lastDebitAt: null,
        graceUntil: null,
        pausedAt: null,
        cancelledAt: null,
        externalPolicyNo: opts.externalPolicyNo ?? existing.externalPolicyNo,
        enrolledByAdmin: adminId,
        notes: opts.notes ?? existing.notes,
      },
    });
  } else {
    enrollment = await db.proBenefitEnrollment.create({
      data: {
        proId,
        planId,
        status: "PENDING",
        nextDebitAt: now,
        externalPolicyNo: opts.externalPolicyNo ?? null,
        enrolledByAdmin: adminId,
        notes: opts.notes ?? null,
      },
    });
  }

  await logAdminAction({
    adminId,
    action: "benefits.enrol",
    entityType: "enrolment",
    entityId: enrollment.id,
    metadata: { proId, planId, externalPolicyNo: opts.externalPolicyNo ?? null },
  });

  let debit: SingleDebitResult | undefined;
  if (opts.debitNow) {
    debit = await runSingleDebit(enrollment.id);
  }

  return { enrollment, eligibility, debit };
}

// ─── STATE TRANSITIONS ───────────────────────────────────────────────────────

export async function pauseEnrolment(
  enrollmentId: string,
  reason: string,
  adminId?: string,
) {
  const now = new Date();
  const updated = await db.proBenefitEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "PAUSED",
      pausedAt: now,
      graceUntil: null,
      notes: reason,
    },
  });
  if (adminId) {
    await logAdminAction({
      adminId,
      action: "benefits.pause",
      entityType: "enrolment",
      entityId: enrollmentId,
      metadata: { reason },
    });
  }
  return updated;
}

export async function resumeEnrolment(enrollmentId: string, adminId?: string) {
  const now = new Date();
  const updated = await db.proBenefitEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "ACTIVE",
      pausedAt: null,
      graceUntil: null,
      cancelledAt: null,
      nextDebitAt: now,
    },
  });
  if (adminId) {
    await logAdminAction({
      adminId,
      action: "benefits.resume",
      entityType: "enrolment",
      entityId: enrollmentId,
    });
  }
  return updated;
}

export async function cancelEnrolment(
  enrollmentId: string,
  reason: string,
  adminId?: string,
) {
  const now = new Date();
  const updated = await db.proBenefitEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
      notes: reason,
    },
  });
  if (adminId) {
    await logAdminAction({
      adminId,
      action: "benefits.cancel",
      entityType: "enrolment",
      entityId: enrollmentId,
      metadata: { reason },
    });
  }
  return updated;
}

export async function attachExternalPolicy(
  enrollmentId: string,
  externalPolicyNo: string,
  adminId?: string,
) {
  const updated = await db.proBenefitEnrollment.update({
    where: { id: enrollmentId },
    data: { externalPolicyNo },
  });
  if (adminId) {
    await logAdminAction({
      adminId,
      action: "benefits.attach_policy",
      entityType: "enrolment",
      entityId: enrollmentId,
      metadata: { externalPolicyNo },
    });
  }
  return updated;
}

// ─── DEBIT ENGINE ────────────────────────────────────────────────────────────

export interface SingleDebitResult {
  enrollmentId: string;
  status: BenefitDebitStatus;
  amountDebited: number;
  premiumGross: number;
  subsidyAmount: number;
  newEnrolmentStatus: BenefitEnrollmentStatus;
  transitions: {
    grace?: boolean;
    pause?: boolean;
    cancel?: boolean;
  };
  failureReason?: string;
  debitId?: string;
}

interface DebitRunSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  graceTransitions: number;
  pauseTransitions: number;
  cancelTransitions: number;
  results: SingleDebitResult[];
}

/**
 * Run a single debit for one enrolment. Used both by the cron and by the
 * admin "Run debit now" button.
 */
export async function runSingleDebit(
  enrollmentId: string,
): Promise<SingleDebitResult> {
  const settings = await loadBenefitsSettings();
  const enrolment = await db.proBenefitEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { plan: true, pro: true },
  });
  if (!enrolment) {
    return {
      enrollmentId,
      status: "FAILED",
      amountDebited: 0,
      premiumGross: 0,
      subsidyAmount: 0,
      newEnrolmentStatus: "CANCELLED",
      transitions: {},
      failureReason: "Enrolment not found",
    };
  }

  if (enrolment.status === "CANCELLED" || enrolment.status === "PAUSED") {
    return {
      enrollmentId,
      status: "SKIPPED",
      amountDebited: 0,
      premiumGross: enrolment.plan.monthlyPremium,
      subsidyAmount: 0,
      newEnrolmentStatus: enrolment.status,
      transitions: {},
      failureReason: `Enrolment is ${enrolment.status}`,
    };
  }

  const now = new Date();
  const period = periodKey(now);
  const proTier = deriveProTier(enrolment.pro);
  const subsidyRule = await db.benefitSubsidyRule.findUnique({
    where: { planId_proTier: { planId: enrolment.planId, proTier } },
  });
  const subsidyPct = subsidyRule?.subsidyPct ?? 0;
  const premiumGross = round2(enrolment.plan.monthlyPremium);
  const subsidyAmount = round2(premiumGross * subsidyPct);
  const amountDebited = round2(premiumGross - subsidyAmount);

  // Already debited this period? Idempotent.
  const existingDebit = await db.benefitDebit.findUnique({
    where: { enrollmentId_period: { enrollmentId, period } },
  });
  if (existingDebit && existingDebit.status === "SUCCESS") {
    return {
      enrollmentId,
      status: existingDebit.status,
      amountDebited: existingDebit.amountDebited,
      premiumGross: existingDebit.premiumGross,
      subsidyAmount: existingDebit.subsidyAmount,
      newEnrolmentStatus: enrolment.status,
      transitions: {},
      debitId: existingDebit.id,
    };
  }

  // Wallet check
  const wallet = await getWallet(enrolment.proId);
  const available = wallet?.available ?? 0;

  // The "subsidy" portion does not come from the pro's wallet — only the
  // amountDebited does. If the pro's amountDebited is zero (ELITE 100%
  // subsidy), there is no wallet debit at all but we still mark SUCCESS.
  if (amountDebited > 0 && available < amountDebited) {
    return handleInsufficientFunds({
      enrolment,
      period,
      premiumGross,
      subsidyAmount,
      amountDebited,
      settings,
      now,
      existingDebitId: existingDebit?.id,
    });
  }

  // Success path
  try {
    let walletLedgerId: string | null = null;
    if (amountDebited > 0) {
      const result = await postMovement({
        proId: enrolment.proId,
        type: "BENEFIT_PREMIUM",
        amount: -amountDebited,
        idempotencyKey: `benefit:${enrolment.id}:${period}`,
        note: `${enrolment.plan.name} premium ${period}`,
      });
      walletLedgerId = result.ledger.id;
    }

    const debit = existingDebit
      ? await db.benefitDebit.update({
          where: { id: existingDebit.id },
          data: {
            premiumGross,
            subsidyAmount,
            amountDebited,
            status: "SUCCESS",
            walletLedgerId,
            failureReason: null,
          },
        })
      : await db.benefitDebit.create({
          data: {
            enrollmentId: enrolment.id,
            proId: enrolment.proId,
            period,
            premiumGross,
            subsidyAmount,
            amountDebited,
            status: "SUCCESS",
            walletLedgerId,
          },
        });

    const nextDebitAt = startOfNextMonth(now);
    await db.proBenefitEnrollment.update({
      where: { id: enrolment.id },
      data: {
        status: "ACTIVE",
        activatedAt: enrolment.activatedAt ?? now,
        lastDebitAt: now,
        nextDebitAt,
        graceUntil: null,
        pausedAt: null,
      },
    });

    return {
      enrollmentId,
      status: "SUCCESS",
      amountDebited,
      premiumGross,
      subsidyAmount,
      newEnrolmentStatus: "ACTIVE",
      transitions: {},
      debitId: debit.id,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown wallet failure";
    const debit = existingDebit
      ? await db.benefitDebit.update({
          where: { id: existingDebit.id },
          data: {
            premiumGross,
            subsidyAmount,
            amountDebited,
            status: "FAILED",
            failureReason: reason,
          },
        })
      : await db.benefitDebit.create({
          data: {
            enrollmentId: enrolment.id,
            proId: enrolment.proId,
            period,
            premiumGross,
            subsidyAmount,
            amountDebited,
            status: "FAILED",
            failureReason: reason,
          },
        });
    return {
      enrollmentId,
      status: "FAILED",
      amountDebited,
      premiumGross,
      subsidyAmount,
      newEnrolmentStatus: enrolment.status,
      transitions: {},
      failureReason: reason,
      debitId: debit.id,
    };
  }
}

interface InsufficientFundsArgs {
  enrolment: Prisma.ProBenefitEnrollmentGetPayload<{ include: { plan: true; pro: true } }>;
  period: string;
  premiumGross: number;
  subsidyAmount: number;
  amountDebited: number;
  settings: BenefitsSettings;
  now: Date;
  existingDebitId?: string;
}

async function handleInsufficientFunds(args: InsufficientFundsArgs): Promise<SingleDebitResult> {
  const { enrolment, period, premiumGross, subsidyAmount, amountDebited, settings, now } = args;

  // Failure cascade per locked product decisions.
  // - First failure (current status ACTIVE / PENDING): → GRACE for `graceDays`
  // - graceUntil elapsed: → PAUSED for `pauseDays`
  // - pausedAt > pauseDays ago: → CANCELLED
  let newStatus: BenefitEnrollmentStatus = enrolment.status;
  const transitions: SingleDebitResult["transitions"] = {};
  let graceUntil: Date | null = enrolment.graceUntil;
  let pausedAt: Date | null = enrolment.pausedAt;
  let cancelledAt: Date | null = enrolment.cancelledAt;

  if (enrolment.status === "ACTIVE" || enrolment.status === "PENDING") {
    newStatus = "GRACE";
    graceUntil = addDays(now, settings.graceDays);
    transitions.grace = true;
  } else if (enrolment.status === "GRACE") {
    // If graceUntil has already elapsed, push to PAUSED.
    if (enrolment.graceUntil && enrolment.graceUntil < now) {
      newStatus = "PAUSED";
      pausedAt = now;
      graceUntil = null;
      transitions.pause = true;
    } else {
      // Still in grace window — stay GRACE.
      newStatus = "GRACE";
    }
  }

  // If we entered PAUSED and we've been paused longer than pauseDays, cancel.
  if (newStatus === "PAUSED" && pausedAt) {
    const ageDays = (now.getTime() - pausedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > settings.pauseDays) {
      newStatus = "CANCELLED";
      cancelledAt = now;
      transitions.pause = false;
      transitions.cancel = true;
    }
  }
  // PAUSED → CANCELLED check when the enrolment was already PAUSED on entry.
  if (
    enrolment.status === "PAUSED" &&
    enrolment.pausedAt &&
    now.getTime() - enrolment.pausedAt.getTime() > settings.pauseDays * 24 * 60 * 60 * 1000
  ) {
    newStatus = "CANCELLED";
    cancelledAt = now;
    transitions.cancel = true;
  }

  // Write debit row.
  const debit = args.existingDebitId
    ? await db.benefitDebit.update({
        where: { id: args.existingDebitId },
        data: {
          premiumGross,
          subsidyAmount,
          amountDebited,
          status: "INSUFFICIENT_FUNDS",
          failureReason: "Wallet balance below required premium",
        },
      })
    : await db.benefitDebit.create({
        data: {
          enrollmentId: enrolment.id,
          proId: enrolment.proId,
          period,
          premiumGross,
          subsidyAmount,
          amountDebited,
          status: "INSUFFICIENT_FUNDS",
          failureReason: "Wallet balance below required premium",
        },
      });

  // Push nextDebitAt to tomorrow for daily retry while in GRACE; otherwise
  // forward to next month so we don't spam.
  const nextDebitAt =
    newStatus === "GRACE" ? addDays(now, 1) : startOfNextMonth(now);

  await db.proBenefitEnrollment.update({
    where: { id: enrolment.id },
    data: {
      status: newStatus,
      graceUntil,
      pausedAt,
      cancelledAt,
      nextDebitAt,
    },
  });

  return {
    enrollmentId: enrolment.id,
    status: "INSUFFICIENT_FUNDS",
    amountDebited,
    premiumGross,
    subsidyAmount,
    newEnrolmentStatus: newStatus,
    transitions,
    failureReason: "Wallet balance below required premium",
    debitId: debit.id,
  };
}

/**
 * Run the monthly benefits debit cron. Iterates every ACTIVE / PENDING /
 * GRACE enrolment whose nextDebitAt is due, computes premium (with subsidy
 * by tier), posts BENEFIT_PREMIUM via the wallet, and transitions enrolment
 * state on failure (GRACE → PAUSED → CANCELLED).
 *
 * Returns a summary of attempts for the admin debit log.
 */
export async function runMonthlyBenefitsDebit(): Promise<DebitRunSummary> {
  const settings = await loadBenefitsSettings();
  if (!settings.enabled) {
    return {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      graceTransitions: 0,
      pauseTransitions: 0,
      cancelTransitions: 0,
      results: [],
    };
  }

  const now = new Date();
  const due = await db.proBenefitEnrollment.findMany({
    where: {
      status: { in: ["ACTIVE", "PENDING", "GRACE", "PAUSED"] },
      nextDebitAt: { lte: now },
    },
    select: { id: true },
  });

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let graceTransitions = 0;
  let pauseTransitions = 0;
  let cancelTransitions = 0;
  const results: SingleDebitResult[] = [];

  for (const row of due) {
    attempted += 1;
    const r = await runSingleDebit(row.id);
    results.push(r);
    if (r.status === "SUCCESS") succeeded += 1;
    else if (r.status === "INSUFFICIENT_FUNDS" || r.status === "FAILED") failed += 1;
    if (r.transitions.grace) graceTransitions += 1;
    if (r.transitions.pause) pauseTransitions += 1;
    if (r.transitions.cancel) cancelTransitions += 1;
  }

  return {
    attempted,
    succeeded,
    failed,
    graceTransitions,
    pauseTransitions,
    cancelTransitions,
    results,
  };
}

// ─── CLAIMS ──────────────────────────────────────────────────────────────────

import type { BenefitKind, BenefitClaimStatus } from "@prisma/client";

export async function createClaim(
  enrollmentId: string,
  kind: BenefitKind,
  summary: string,
  adminId: string,
  externalRef?: string | null,
) {
  const enrolment = await db.proBenefitEnrollment.findUnique({
    where: { id: enrollmentId },
  });
  if (!enrolment) throw new Error("Enrolment not found");

  const claim = await db.benefitClaim.create({
    data: {
      enrollmentId,
      proId: enrolment.proId,
      kind,
      summary,
      externalRef: externalRef ?? null,
      status: "OPEN",
    },
  });
  await logAdminAction({
    adminId,
    action: "benefits.claim.create",
    entityType: "claim",
    entityId: claim.id,
    metadata: { enrollmentId, kind, summary, externalRef: externalRef ?? null },
  });
  return claim;
}

export async function updateClaim(
  claimId: string,
  data: {
    status?: BenefitClaimStatus;
    notes?: string | null;
    externalRef?: string | null;
  },
  adminId: string,
) {
  const updated = await db.benefitClaim.update({
    where: { id: claimId },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.externalRef !== undefined ? { externalRef: data.externalRef } : {}),
      ...(data.status === "RESOLVED" || data.status === "REJECTED"
        ? { resolvedAt: new Date() }
        : {}),
    },
  });
  await logAdminAction({
    adminId,
    action: "benefits.claim.update",
    entityType: "claim",
    entityId: claimId,
    metadata: data,
  });
  return updated;
}
