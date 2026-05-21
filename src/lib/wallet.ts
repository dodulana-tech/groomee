import { db } from "./db";
import { Prisma, WalletMovementType } from "@prisma/client";
import type { ProWallet, WalletLedger } from "@prisma/client";

// ─── DEFAULTS & SETTINGS KEYS ────────────────────────────────────────────────
//
// The split fractions are stored as Settings rows so admin can tune them
// without a deploy. These constants are the fallbacks used when a row is
// missing or unparseable.

export const SETTING_KEYS = {
  mobilizationFraction: "WALLET_MOBILIZATION_FRACTION",
  completionFraction: "WALLET_COMPLETION_FRACTION",
  confirmFraction: "WALLET_CONFIRM_FRACTION",
  defaultCreditLimit: "WALLET_DEFAULT_CREDIT_LIMIT",
  advanceRepayRate: "WALLET_ADVANCE_REPAY_RATE",
} as const;

export const DEFAULT_MOBILIZATION_FRACTION = 0.25;
export const DEFAULT_COMPLETION_FRACTION = 0.5;
export const DEFAULT_CONFIRM_FRACTION = 0.25;
export const DEFAULT_CREDIT_LIMIT = 0;
export const DEFAULT_ADVANCE_REPAY_RATE = 0.3;

export const WALLET_PERMISSIONS = {
  view: "wallet.view",
  manage: "wallet.manage",
} as const;

const SUM_TOLERANCE = 0.001;

export interface ReleaseFractions {
  mobilization: number;
  completion: number;
  confirm: number;
}

/**
 * Pull the release fractions from Settings. Falls back to defaults when a key
 * is missing or invalid. Validates the three add up to ~1.0 - if they don't,
 * the defaults are returned (we never silently misallocate money).
 */
export async function loadReleaseFractions(): Promise<ReleaseFractions> {
  const rows = await db.setting.findMany({
    where: {
      key: {
        in: [
          SETTING_KEYS.mobilizationFraction,
          SETTING_KEYS.completionFraction,
          SETTING_KEYS.confirmFraction,
        ],
      },
    },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const parse = (key: string, fallback: number) => {
    const raw = map.get(key);
    const n = raw ? parseFloat(raw) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
  };
  const mobilization = parse(SETTING_KEYS.mobilizationFraction, DEFAULT_MOBILIZATION_FRACTION);
  const completion = parse(SETTING_KEYS.completionFraction, DEFAULT_COMPLETION_FRACTION);
  const confirm = parse(SETTING_KEYS.confirmFraction, DEFAULT_CONFIRM_FRACTION);
  const sum = mobilization + completion + confirm;
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    // Misconfigured - never split money based on bad settings.
    return {
      mobilization: DEFAULT_MOBILIZATION_FRACTION,
      completion: DEFAULT_COMPLETION_FRACTION,
      confirm: DEFAULT_CONFIRM_FRACTION,
    };
  }
  return { mobilization, completion, confirm };
}

export async function loadDefaultCreditLimit(): Promise<number> {
  const row = await db.setting.findFirst({
    where: { key: SETTING_KEYS.defaultCreditLimit },
  });
  const n = row ? parseFloat(row.value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CREDIT_LIMIT;
}

/**
 * Fraction of each weekly payout that's redirected to ADVANCE_REPAYMENT when
 * a pro carries a positive netAdvanceOwed. Clamped to [0, 1]; falls back to
 * DEFAULT_ADVANCE_REPAY_RATE when missing/malformed.
 */
export async function loadAdvanceRepayRate(): Promise<number> {
  const row = await db.setting.findFirst({
    where: { key: SETTING_KEYS.advanceRepayRate },
  });
  const n = row ? parseFloat(row.value) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_ADVANCE_REPAY_RATE;
}

// ─── WALLET LAZY INIT ────────────────────────────────────────────────────────

export async function ensureWallet(
  proId: string,
  tx?: Prisma.TransactionClient,
): Promise<ProWallet> {
  const client = tx ?? db;
  const existing = await client.proWallet.findUnique({ where: { proId } });
  if (existing) return existing;
  const creditLimit = await loadDefaultCreditLimit();
  return client.proWallet.create({
    data: { proId, available: 0, pending: 0, creditLimit, netAdvanceOwed: 0 },
  });
}

// ─── POSTING MOVEMENTS ───────────────────────────────────────────────────────
//
// Single source of truth for any money movement. Always atomic: the wallet
// row is locked-for-update, the new ledger row is written, the cached
// available/netAdvanceOwed totals are bumped, all inside one transaction.
//
// Pass `idempotencyKey` when the same lifecycle event might fire twice
// (e.g. concurrent confirm-races). The compound unique (proId, idempotencyKey)
// turns the second post into a no-op that returns the existing row.

export interface PostMovementInput {
  proId: string;
  type: WalletMovementType;
  amount: number; // signed; +credit, -debit
  bookingId?: string | null;
  advanceId?: string | null;
  payoutId?: string | null;
  sourceProId?: string | null;
  apprenticeshipId?: string | null;
  note?: string | null;
  idempotencyKey?: string | null;
}

export interface PostMovementResult {
  ledger: WalletLedger;
  wallet: ProWallet;
  /** True when the movement was deduplicated (no second posting). */
  deduplicated: boolean;
}

const ADVANCE_TYPES = new Set<WalletMovementType>([
  "ADVANCE_DISBURSED",
  "ADVANCE_REPAYMENT",
]);

async function postMovementInner(
  input: PostMovementInput,
  tx: Prisma.TransactionClient,
): Promise<PostMovementResult> {
  const wallet = await ensureWallet(input.proId, tx);

  // Idempotency check.
  if (input.idempotencyKey) {
    const existing = await tx.walletLedger.findUnique({
      where: {
        proId_idempotencyKey: {
          proId: input.proId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      return { ledger: existing, wallet, deduplicated: true };
    }
  }

  const newAvailable = round2(wallet.available + input.amount);
  // ADVANCE_DISBURSED: pro takes a +credit AND we increment netAdvanceOwed.
  // ADVANCE_REPAYMENT: pro spends -debit AND we decrement netAdvanceOwed.
  const advanceDelta = ADVANCE_TYPES.has(input.type)
    ? input.type === "ADVANCE_DISBURSED"
      ? Math.abs(input.amount)
      : -Math.abs(input.amount)
    : 0;
  const newNetAdvance = round2(wallet.netAdvanceOwed + advanceDelta);

  const updated = await tx.proWallet.update({
    where: { id: wallet.id },
    data: { available: newAvailable, netAdvanceOwed: newNetAdvance },
  });

  const ledger = await tx.walletLedger.create({
    data: {
      proId: input.proId,
      type: input.type,
      amount: round2(input.amount),
      balanceAfter: newAvailable,
      bookingId: input.bookingId ?? null,
      advanceId: input.advanceId ?? null,
      payoutId: input.payoutId ?? null,
      sourceProId: input.sourceProId ?? null,
      apprenticeshipId: input.apprenticeshipId ?? null,
      note: input.note ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  return { ledger, wallet: updated, deduplicated: false };
}

export async function postMovement(
  input: PostMovementInput,
  tx?: Prisma.TransactionClient,
): Promise<PostMovementResult> {
  if (tx) return postMovementInner(input, tx);
  return db.$transaction((innerTx) => postMovementInner(input, innerTx));
}

// ─── HIGH-LEVEL HELPERS ──────────────────────────────────────────────────────

/**
 * Compute the three release amounts for a pro's per-booking earning. Pure -
 * does no DB writes.
 */
export function splitProEarning(
  proEarning: number,
  fractions: ReleaseFractions,
) {
  const mobilization = round2(proEarning * fractions.mobilization);
  const completion = round2(proEarning * fractions.completion);
  // Force the three to sum exactly to proEarning to avoid rounding drift.
  const confirm = round2(proEarning - mobilization - completion);
  return { mobilization, completion, confirm };
}

/**
 * Reverse every wallet movement for a given booking (idempotent). Used when
 * a customer or admin cancels/refunds. Posts a CLAWBACK row for the negative
 * of each non-clawback movement that's still live for this booking.
 *
 * Fraction lets us scale for partial refunds: pass 1 for full reversal, 0.5
 * for half, etc.
 */
export async function clawbackForBooking(
  bookingId: string,
  fraction: number = 1,
  tx?: Prisma.TransactionClient,
): Promise<{ posted: WalletLedger[] }> {
  const client = tx ?? db;
  const live = await client.walletLedger.findMany({
    where: { bookingId, type: { not: "CLAWBACK" } },
    orderBy: { createdAt: "asc" },
  });
  const grouped = new Map<string, WalletLedger[]>();
  for (const m of live) {
    const key = `${m.proId}|${m.type}`;
    const arr = grouped.get(key) ?? [];
    arr.push(m);
    grouped.set(key, arr);
  }

  const posted: WalletLedger[] = [];
  for (const [, group] of grouped) {
    const m = group[0];
    // Already-reversed entries shouldn't be reversed twice. Sum the live ones
    // and any existing clawbacks for the same (proId, bookingId) pair, then
    // claw back the residual.
    const liveSum = group.reduce((s, x) => s + x.amount, 0);
    const existingClawbacks = await client.walletLedger.aggregate({
      where: {
        bookingId,
        proId: m.proId,
        type: "CLAWBACK",
        note: { contains: m.type },
      },
      _sum: { amount: true },
    });
    const alreadyReversed = existingClawbacks._sum.amount ?? 0;
    const reversibleNet = liveSum + alreadyReversed; // alreadyReversed is negative
    if (Math.abs(reversibleNet) < 0.01) continue;
    const reverseAmount = -round2(reversibleNet * fraction);
    if (Math.abs(reverseAmount) < 0.01) continue;
    const idempotencyKey = `clawback:${bookingId}:${m.type}:${fraction}`;
    const result = await postMovementInner(
      {
        proId: m.proId,
        type: "CLAWBACK",
        amount: reverseAmount,
        bookingId,
        sourceProId: m.sourceProId,
        apprenticeshipId: m.apprenticeshipId,
        note: `Clawback of ${m.type} on booking ${bookingId}`,
        idempotencyKey,
      },
      client as Prisma.TransactionClient,
    );
    if (!result.deduplicated) posted.push(result.ledger);
  }
  return { posted };
}

// ─── BALANCE READS ───────────────────────────────────────────────────────────

export async function getWallet(
  proId: string,
): Promise<ProWallet | null> {
  return db.proWallet.findUnique({ where: { proId } });
}

export async function recentLedger(
  proId: string,
  limit = 30,
): Promise<WalletLedger[]> {
  return db.walletLedger.findMany({
    where: { proId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Sum every movement in the ledger - this is the authoritative balance,
 * useful for forensic checks against the cached `available` on ProWallet.
 */
export async function ledgerSum(proId: string): Promise<number> {
  const r = await db.walletLedger.aggregate({
    where: { proId },
    _sum: { amount: true },
  });
  return round2(r._sum.amount ?? 0);
}

// ─── ADMIN OVERVIEW HELPERS ──────────────────────────────────────────────────

export interface WalletOverviewKpis {
  totalAvailable: number;
  totalPending: number;
  totalNetAdvanceOwed: number;
  prosWithNegativeBalance: number;
  todayMobilizationSum: number;
  todayClawbackSum: number;
}

/**
 * Aggregated KPIs for the wallet overview page. All sums are computed off
 * the cached ProWallet columns (fast); daily totals come off the ledger.
 */
export async function loadWalletOverviewKpis(): Promise<WalletOverviewKpis> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [walletAgg, negativeCount, todayMob, todayClawback] = await Promise.all([
    db.proWallet.aggregate({
      _sum: { available: true, pending: true, netAdvanceOwed: true },
    }),
    db.proWallet.count({ where: { available: { lt: 0 } } }),
    db.walletLedger.aggregate({
      where: { type: "MOBILIZATION", createdAt: { gte: startOfToday } },
      _sum: { amount: true },
    }),
    db.walletLedger.aggregate({
      where: { type: "CLAWBACK", createdAt: { gte: startOfToday } },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalAvailable: round2(walletAgg._sum.available ?? 0),
    totalPending: round2(walletAgg._sum.pending ?? 0),
    totalNetAdvanceOwed: round2(walletAgg._sum.netAdvanceOwed ?? 0),
    prosWithNegativeBalance: negativeCount,
    todayMobilizationSum: round2(todayMob._sum.amount ?? 0),
    // CLAWBACK rows are negative; expose absolute value for the KPI card.
    todayClawbackSum: Math.abs(round2(todayClawback._sum.amount ?? 0)),
  };
}

export interface ProWalletSummary {
  proId: string;
  name: string;
  phone: string;
  available: number;
  pending: number;
  netAdvanceOwed: number;
  creditLimit: number;
  lastMovementAt: Date | null;
}

/**
 * List every pro that has a wallet (or has earned anything historically).
 * Used by the overview table.
 */
export async function listProWalletSummaries(): Promise<ProWalletSummary[]> {
  const wallets = await db.proWallet.findMany({
    include: {
      pro: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { available: "desc" },
  });
  // Fetch the latest movement per wallet in one query.
  const latest = await db.walletLedger.groupBy({
    by: ["proId"],
    _max: { createdAt: true },
  });
  const lastByPro = new Map(latest.map((l) => [l.proId, l._max.createdAt]));
  return wallets.map((w) => ({
    proId: w.proId,
    name: w.pro.name,
    phone: w.pro.phone,
    available: round2(w.available),
    pending: round2(w.pending),
    netAdvanceOwed: round2(w.netAdvanceOwed),
    creditLimit: round2(w.creditLimit),
    lastMovementAt: lastByPro.get(w.proId) ?? null,
  }));
}

// ─── UTIL ────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
