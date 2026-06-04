import { Prisma, SavingsMovementType } from "@prisma/client";
import type {
  ProSavingsAccount,
  SavingsMovement,
  SavingsWithdrawal,
} from "@prisma/client";
import { db } from "./db";
import { postMovement } from "./wallet";

// ─── FORCED SAVINGS / EARNINGS RESERVE (Concept #5) ──────────────────────────
//
// "Earnings Reserve" in user copy, never "savings account" or "deposit".
// A configurable % of every CONFIRMED booking's proEarning is skimmed into the
// pro's vault. Withdrawals run on either a 14-day notice or an instant break
// with a 20% penalty (forfeited as platform retention). A 2% match bonus is
// applied on every withdrawal that completed its notice. Clawback window is
// 72hr — refunds within window reverse the skim; beyond it the vault is final
// and Groomee absorbs the loss from take-rate.
//
// Source of truth: SavingsMovement. ProSavingsAccount.balance* are caches.

export const SAVINGS_SETTING_KEYS = {
  enabled: "SAVINGS_ENABLED",
  defaultRate: "SAVINGS_DEFAULT_RATE",
  sliderMin: "SAVINGS_SLIDER_MIN",
  sliderMax: "SAVINGS_SLIDER_MAX",
  defaultNoticeDays: "SAVINGS_DEFAULT_NOTICE_DAYS",
  defaultPenaltyPct: "SAVINGS_DEFAULT_PENALTY_PCT",
  clawbackHours: "SAVINGS_CLAWBACK_HOURS",
  matchBonusPct: "SAVINGS_MATCH_BONUS_PCT",
} as const;

export const SAVINGS_DEFAULTS = {
  enabled: true,
  rate: 0.05,
  sliderMin: 0.02,
  sliderMax: 0.15,
  noticeDays: 14,
  penaltyPct: 0.20,
  clawbackHours: 72,
  matchBonusPct: 0.02,
} as const;

export interface SavingsSettings {
  enabled: boolean;
  rate: number;
  sliderMin: number;
  sliderMax: number;
  noticeDays: number;
  penaltyPct: number;
  clawbackHours: number;
  matchBonusPct: number;
}

// ─── SETTINGS LOADER ─────────────────────────────────────────────────────────

export async function loadSavingsSettings(
  tx?: Prisma.TransactionClient,
): Promise<SavingsSettings> {
  const client = tx ?? db;
  const rows = await client.setting.findMany({
    where: { key: { in: Object.values(SAVINGS_SETTING_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const parseNum = (key: string, fallback: number, min = 0, max = 1) => {
    const raw = map.get(key);
    const n = raw == null ? NaN : parseFloat(raw);
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  };
  const parseInteger = (key: string, fallback: number, min = 0, max = 365) => {
    const raw = map.get(key);
    const n = raw == null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  };
  const enabledRaw = map.get(SAVINGS_SETTING_KEYS.enabled);
  const enabled = enabledRaw == null ? SAVINGS_DEFAULTS.enabled : enabledRaw === "true";
  return {
    enabled,
    rate: parseNum(SAVINGS_SETTING_KEYS.defaultRate, SAVINGS_DEFAULTS.rate, 0, 1),
    sliderMin: parseNum(SAVINGS_SETTING_KEYS.sliderMin, SAVINGS_DEFAULTS.sliderMin, 0, 1),
    sliderMax: parseNum(SAVINGS_SETTING_KEYS.sliderMax, SAVINGS_DEFAULTS.sliderMax, 0, 1),
    noticeDays: parseInteger(SAVINGS_SETTING_KEYS.defaultNoticeDays, SAVINGS_DEFAULTS.noticeDays, 1, 365),
    penaltyPct: parseNum(SAVINGS_SETTING_KEYS.defaultPenaltyPct, SAVINGS_DEFAULTS.penaltyPct, 0, 1),
    clawbackHours: parseInteger(SAVINGS_SETTING_KEYS.clawbackHours, SAVINGS_DEFAULTS.clawbackHours, 0, 168),
    matchBonusPct: parseNum(SAVINGS_SETTING_KEYS.matchBonusPct, SAVINGS_DEFAULTS.matchBonusPct, 0, 1),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── PENDING NOTIFICATIONS ───────────────────────────────────────────────────
//
// Skim happens inside the booking transaction; we never want to fire WhatsApp
// during a DB tx (Twilio latency + lock contention). Instead we return a
// notice payload that the caller fires post-commit. The same pattern is used
// throughout wallet-releases.ts.

export interface PendingSkimNotice {
  proPhone: string | null;
  amount: number;
  reserveBalance: number;
  bookingRef: string;
}

export interface PendingClawbackNotice {
  proPhone: string | null;
  amount: number;
  bookingRef: string;
}

// ─── ENSURE ACCOUNT ──────────────────────────────────────────────────────────

export async function ensureSavingsAccount(
  proId: string,
  tx?: Prisma.TransactionClient,
): Promise<ProSavingsAccount> {
  const client = tx ?? db;
  const existing = await client.proSavingsAccount.findUnique({ where: { proId } });
  if (existing) return existing;
  const settings = await loadSavingsSettings(client as Prisma.TransactionClient);
  return client.proSavingsAccount.create({
    data: {
      proId,
      optedIn: false,
      skimRate: settings.rate,
      noticeDays: settings.noticeDays,
      penaltyPct: settings.penaltyPct,
      goalLabels: [],
    },
  });
}

// ─── POST SAVINGS MOVEMENT (atomic, idempotent) ──────────────────────────────

interface PostSavingsMovementInput {
  account: ProSavingsAccount;
  type: SavingsMovementType;
  amount: number; // signed
  bookingId?: string | null;
  withdrawalId?: string | null;
  walletLedgerId?: string | null;
  goalLabel?: string | null;
  note?: string | null;
  idempotencyKey?: string | null;
  /** Balance delta updates to apply atomically to the account row. */
  delta?: Partial<
    Pick<
      ProSavingsAccount,
      | "balanceAvailable"
      | "balanceLocked"
      | "balancePendingWd"
      | "totalSkimmed"
      | "totalMatchEarned"
      | "totalWithdrawn"
      | "totalClawedBack"
    >
  >;
}

interface PostSavingsMovementResult {
  movement: SavingsMovement;
  account: ProSavingsAccount;
  deduplicated: boolean;
}

async function postSavingsMovementInner(
  input: PostSavingsMovementInput,
  tx: Prisma.TransactionClient,
): Promise<PostSavingsMovementResult> {
  // Idempotency check.
  if (input.idempotencyKey) {
    const existing = await tx.savingsMovement.findUnique({
      where: {
        proId_idempotencyKey: {
          proId: input.account.proId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      const acct = await tx.proSavingsAccount.findUniqueOrThrow({
        where: { proId: input.account.proId },
      });
      return { movement: existing, account: acct, deduplicated: true };
    }
  }

  // Apply balance deltas atomically.
  const delta = input.delta ?? {};
  const updateData: Prisma.ProSavingsAccountUpdateInput = {};
  if (delta.balanceAvailable != null) updateData.balanceAvailable = { increment: round2(delta.balanceAvailable) };
  if (delta.balanceLocked != null) updateData.balanceLocked = { increment: round2(delta.balanceLocked) };
  if (delta.balancePendingWd != null) updateData.balancePendingWd = { increment: round2(delta.balancePendingWd) };
  if (delta.totalSkimmed != null) updateData.totalSkimmed = { increment: round2(delta.totalSkimmed) };
  if (delta.totalMatchEarned != null) updateData.totalMatchEarned = { increment: round2(delta.totalMatchEarned) };
  if (delta.totalWithdrawn != null) updateData.totalWithdrawn = { increment: round2(delta.totalWithdrawn) };
  if (delta.totalClawedBack != null) updateData.totalClawedBack = { increment: round2(delta.totalClawedBack) };

  const account = Object.keys(updateData).length
    ? await tx.proSavingsAccount.update({
        where: { proId: input.account.proId },
        data: updateData,
      })
    : await tx.proSavingsAccount.findUniqueOrThrow({
        where: { proId: input.account.proId },
      });

  const newCachedBalance = round2(
    account.balanceAvailable + account.balanceLocked + account.balancePendingWd,
  );

  const movement = await tx.savingsMovement.create({
    data: {
      accountId: account.id,
      proId: account.proId,
      type: input.type,
      amount: round2(input.amount),
      balanceAfter: newCachedBalance,
      bookingId: input.bookingId ?? null,
      withdrawalId: input.withdrawalId ?? null,
      walletLedgerId: input.walletLedgerId ?? null,
      goalLabel: input.goalLabel ?? null,
      note: input.note ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });

  return { movement, account, deduplicated: false };
}

async function withTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  tx?: Prisma.TransactionClient,
): Promise<T> {
  if (tx) return fn(tx);
  return db.$transaction(fn);
}

// ─── SKIM ─────────────────────────────────────────────────────────────────────

/**
 * Called from confirm flow (booking → CONFIRMED) after the wallet's
 * CONFIRM_RELEASE has been posted. Skims the configured % of proEarning
 * from the pro's wallet (debit SAVINGS_SKIM) and credits the savings vault.
 * Idempotent via `booking:{id}:SAVINGS_SKIM:{proId}`.
 *
 * No-op when:
 *   - SAVINGS_ENABLED setting is "false"
 *   - The pro has no ProSavingsAccount, or has not opted in
 *   - proEarning is 0 or negative
 *
 * Returns a pending-notice record so the caller can fire WhatsApp AFTER the
 * surrounding tx commits.
 */
export async function maybeSkimSavingsForBooking(
  bookingId: string,
  tx?: Prisma.TransactionClient,
): Promise<PendingSkimNotice | null> {
  const client = tx ?? db;
  const booking = await client.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      proId: true,
      proEarning: true,
      reference: true,
    },
  });
  if (!booking || !booking.proId || booking.proEarning <= 0) return null;

  const settings = await loadSavingsSettings(client as Prisma.TransactionClient);
  if (!settings.enabled) return null;

  const account = await client.proSavingsAccount.findUnique({
    where: { proId: booking.proId },
    include: { pro: { select: { phone: true } } },
  });
  if (!account || !account.optedIn) return null;

  const skim = round2(booking.proEarning * account.skimRate);
  if (skim <= 0) return null;

  const idempotencyKey = `booking:${booking.id}:SAVINGS_SKIM:${booking.proId}`;

  const txOutcome = await withTx(async (inner): Promise<{
    result: PostSavingsMovementResult;
    walletDeduped: boolean;
  }> => {
    // 1. Wallet-side debit (SAVINGS_SKIM). Idempotent — re-runs no-op.
    const walletRes = await postMovement(
      {
        proId: booking.proId!,
        type: "SAVINGS_SKIM",
        amount: -skim,
        bookingId: booking.id,
        note: `Earnings Reserve skim on booking ${booking.reference}`,
        idempotencyKey,
      },
      inner,
    );

    // 2. Savings-side credit.
    const r = await postSavingsMovementInner(
      {
        account,
        type: "SKIM",
        amount: skim,
        bookingId: booking.id,
        walletLedgerId: walletRes.ledger.id,
        note: `Skim from booking ${booking.reference}`,
        idempotencyKey,
        delta: {
          balanceLocked: skim,
          totalSkimmed: skim,
        },
      },
      inner,
    );
    return { result: r, walletDeduped: walletRes.deduplicated };
  }, tx);

  if (txOutcome.result.deduplicated || txOutcome.walletDeduped) return null;

  const finalResult = txOutcome.result;
  const reserveBalance = round2(
    finalResult.account.balanceAvailable +
      finalResult.account.balanceLocked +
      finalResult.account.balancePendingWd,
  );

  const notice: PendingSkimNotice = {
    proPhone: account.pro?.phone ?? null,
    amount: skim,
    reserveBalance,
    bookingRef: booking.reference,
  };

  // Fire WhatsApp post-tx. Detached so the booking tx commit isn't blocked
  // and any Twilio latency doesn't hold the wallet row lock open. Best
  // effort — failures are logged but never bubble.
  if (notice.proPhone) {
    setImmediate(() => {
      import("./whatsapp").then(({ notifyProSavingsSkim }) =>
        notifyProSavingsSkim(notice.proPhone!, notice.amount, notice.reserveBalance, notice.bookingRef),
      ).catch((err) => {
        console.error("[savings] skim notify failed", err);
      });
    });
  }

  return notice;
}

// ─── CLAWBACK ────────────────────────────────────────────────────────────────

/**
 * Called from the cancel/refund flow when a booking is reversed. If the
 * skim occurred within `SAVINGS_CLAWBACK_HOURS`, reverse it: debit savings
 * (CLAWBACK), credit wallet back. After the window, the skim stays put;
 * Groomee absorbs the loss from take-rate (trust guarantee).
 *
 * `fraction` scales for partial refunds (1 = full).
 */
export async function clawbackSavingsForBooking(
  bookingId: string,
  fraction: number = 1,
  tx?: Prisma.TransactionClient,
): Promise<PendingClawbackNotice[]> {
  const client = tx ?? db;
  const settings = await loadSavingsSettings(client as Prisma.TransactionClient);
  const cutoff = new Date(Date.now() - settings.clawbackHours * 60 * 60 * 1000);

  // Load all SKIM rows tied to this booking. We claw back only those still
  // within the clawback window.
  const skims = await client.savingsMovement.findMany({
    where: { bookingId, type: "SKIM" },
    orderBy: { createdAt: "asc" },
  });
  if (skims.length === 0) return [];

  const booking = await client.booking.findUnique({
    where: { id: bookingId },
    select: { reference: true },
  });
  const bookingRef = booking?.reference ?? bookingId;

  const notices: PendingClawbackNotice[] = [];

  await withTx(async (inner) => {
    for (const skim of skims) {
      if (skim.createdAt <= cutoff) continue; // beyond window — vault stays
      const account = await inner.proSavingsAccount.findUnique({
        where: { proId: skim.proId },
        include: { pro: { select: { phone: true } } },
      });
      if (!account) continue;

      // Check for pre-existing clawback (idempotency + already partially clawed).
      const existingClawback = await inner.savingsMovement.aggregate({
        where: { bookingId, proId: skim.proId, type: "CLAWBACK" },
        _sum: { amount: true },
      });
      const alreadyReversed = existingClawback._sum.amount ?? 0; // negative
      const remainingLive = round2(skim.amount + alreadyReversed); // amount still live to potentially claw
      if (remainingLive <= 0) continue;

      const reverseAmount = round2(remainingLive * fraction);
      if (reverseAmount <= 0) continue;

      const idempotencyKey = `clawback:${bookingId}:savings:${fraction}:${skim.proId}`;

      // 1. Reverse on wallet (positive amount returns cash). Use CLAWBACK
      //    wallet type (existing) with a savings-scoped idempotency key so
      //    booking-level clawback math doesn't collide.
      const walletResult = await postMovement(
        {
          proId: skim.proId,
          type: "CLAWBACK",
          amount: reverseAmount,
          bookingId,
          note: `Earnings Reserve clawback on booking ${bookingRef}`,
          idempotencyKey,
        },
        inner,
      );

      // 2. Reverse on savings vault.
      const res = await postSavingsMovementInner(
        {
          account,
          type: "CLAWBACK",
          amount: -reverseAmount,
          bookingId,
          walletLedgerId: walletResult.ledger.id,
          note: `Reverse skim from booking ${bookingRef}`,
          idempotencyKey,
          delta: {
            balanceLocked: -reverseAmount,
            totalClawedBack: reverseAmount,
          },
        },
        inner,
      );
      if (!res.deduplicated && !walletResult.deduplicated) {
        notices.push({
          proPhone: account.pro?.phone ?? null,
          amount: reverseAmount,
          bookingRef,
        });
      }
    }

    // Locked → Available maturity check. Any SKIM rows that are now older
    // than the clawback window should be moved from `balanceLocked` to
    // `balanceAvailable` so the pro can request withdrawals against them.
    // We do this opportunistically on every clawback call (cheap), and the
    // cron does the same in `runMaturityCron` to cover the no-refund path.
    await maturePastClawbackWindow(inner, settings);
  }, tx);

  // Fire WhatsApp post-tx. Detached fire-and-forget so a slow Twilio call
  // never holds the booking-cancel tx open. Best effort.
  for (const n of notices) {
    if (!n.proPhone) continue;
    setImmediate(() => {
      import("./whatsapp").then(({ notifyProSavingsClawback }) =>
        notifyProSavingsClawback(n.proPhone!, n.amount, n.bookingRef),
      ).catch((err) => {
        console.error("[savings] clawback notify failed", err);
      });
    });
  }

  return notices;
}

/**
 * Move every SKIM amount whose row is now older than SAVINGS_CLAWBACK_HOURS
 * out of `balanceLocked` and into `balanceAvailable`. Tracks "matured" state
 * by writing one SavingsMovement of type ADJUSTMENT with a sentinel
 * idempotency key per (account, skimMovementId).
 *
 * Cheap to run repeatedly because of the idempotency key.
 */
async function maturePastClawbackWindow(
  tx: Prisma.TransactionClient,
  settings: SavingsSettings,
): Promise<void> {
  const cutoff = new Date(Date.now() - settings.clawbackHours * 60 * 60 * 1000);

  // Find SKIM rows older than cutoff that haven't been matured yet.
  const skims = await tx.savingsMovement.findMany({
    where: { type: "SKIM", createdAt: { lte: cutoff } },
    select: { id: true, amount: true, proId: true, accountId: true, bookingId: true },
    take: 200,
  });
  if (skims.length === 0) return;

  for (const skim of skims) {
    const idempotencyKey = `mature:savings:${skim.id}`;
    const existing = await tx.savingsMovement.findUnique({
      where: {
        proId_idempotencyKey: { proId: skim.proId, idempotencyKey },
      },
    });
    if (existing) continue;

    // Sum any clawback already taken against this booking on this pro.
    let stillLocked = skim.amount;
    if (skim.bookingId) {
      const clawbacks = await tx.savingsMovement.aggregate({
        where: { bookingId: skim.bookingId, proId: skim.proId, type: "CLAWBACK" },
        _sum: { amount: true },
      });
      stillLocked = round2(skim.amount + (clawbacks._sum.amount ?? 0));
    }
    if (stillLocked <= 0) {
      // Mark matured even at zero so we never re-process this skim.
      await tx.savingsMovement.create({
        data: {
          accountId: skim.accountId,
          proId: skim.proId,
          type: "ADJUSTMENT",
          amount: 0,
          balanceAfter: 0,
          bookingId: skim.bookingId,
          note: "Maturity: nothing left to move (already clawed back)",
          idempotencyKey,
        },
      });
      continue;
    }

    const updated = await tx.proSavingsAccount.update({
      where: { proId: skim.proId },
      data: {
        balanceLocked: { decrement: stillLocked },
        balanceAvailable: { increment: stillLocked },
      },
    });
    await tx.savingsMovement.create({
      data: {
        accountId: skim.accountId,
        proId: skim.proId,
        type: "ADJUSTMENT",
        amount: 0,
        balanceAfter: round2(
          updated.balanceAvailable + updated.balanceLocked + updated.balancePendingWd,
        ),
        bookingId: skim.bookingId,
        note: `Matured: ₦${stillLocked.toFixed(2)} moved locked → available`,
        idempotencyKey,
      },
    });
  }
}

// ─── OPT-IN / OPT-OUT ────────────────────────────────────────────────────────

export async function optInPro(
  proId: string,
  options: { rate?: number; goalLabels?: string[]; note?: string } = {},
): Promise<ProSavingsAccount> {
  const settings = await loadSavingsSettings();
  const rate = options.rate ?? settings.rate;
  if (rate < settings.sliderMin || rate > settings.sliderMax) {
    throw new Error(
      `Skim rate ${rate} outside allowed range ${settings.sliderMin}–${settings.sliderMax}`,
    );
  }

  return db.$transaction(async (tx) => {
    const account = await ensureSavingsAccount(proId, tx);
    const wasOptedIn = account.optedIn;
    const updated = await tx.proSavingsAccount.update({
      where: { id: account.id },
      data: {
        optedIn: true,
        optedInAt: new Date(),
        optedOutAt: null,
        skimRate: rate,
        ...(options.goalLabels ? { goalLabels: options.goalLabels } : {}),
      },
    });
    if (!wasOptedIn) {
      await tx.savingsMovement.create({
        data: {
          accountId: updated.id,
          proId: updated.proId,
          type: "ADJUSTMENT",
          amount: 0,
          balanceAfter: round2(
            updated.balanceAvailable + updated.balanceLocked + updated.balancePendingWd,
          ),
          note: options.note ?? `Opted in to Earnings Reserve at ${(rate * 100).toFixed(1)}%`,
        },
      });
    }
    return updated;
  });
}

export async function optOutPro(
  proId: string,
  options: { note?: string } = {},
): Promise<ProSavingsAccount> {
  return db.$transaction(async (tx) => {
    const account = await ensureSavingsAccount(proId, tx);
    if (!account.optedIn) return account;
    const updated = await tx.proSavingsAccount.update({
      where: { id: account.id },
      data: { optedIn: false, optedOutAt: new Date() },
    });
    await tx.savingsMovement.create({
      data: {
        accountId: updated.id,
        proId: updated.proId,
        type: "ADJUSTMENT",
        amount: 0,
        balanceAfter: round2(
          updated.balanceAvailable + updated.balanceLocked + updated.balancePendingWd,
        ),
        note: options.note ?? "Opted out of Earnings Reserve. Existing balance preserved.",
      },
    });
    return updated;
  });
}

// ─── SET SKIM RATE ───────────────────────────────────────────────────────────

export async function setSkimRate(
  proId: string,
  rate: number,
): Promise<{ account: ProSavingsAccount; oldRate: number }> {
  const settings = await loadSavingsSettings();
  if (rate < settings.sliderMin || rate > settings.sliderMax) {
    throw new Error(
      `Skim rate ${rate} outside allowed range ${settings.sliderMin}–${settings.sliderMax}`,
    );
  }
  return db.$transaction(async (tx) => {
    const account = await ensureSavingsAccount(proId, tx);
    const oldRate = account.skimRate;
    if (oldRate === rate) return { account, oldRate };
    const updated = await tx.proSavingsAccount.update({
      where: { id: account.id },
      data: { skimRate: rate },
    });
    await tx.savingsMovement.create({
      data: {
        accountId: updated.id,
        proId: updated.proId,
        type: "ADJUSTMENT",
        amount: 0,
        balanceAfter: round2(
          updated.balanceAvailable + updated.balanceLocked + updated.balancePendingWd,
        ),
        note: `Skim rate changed from ${(oldRate * 100).toFixed(1)}% to ${(rate * 100).toFixed(1)}%`,
      },
    });
    return { account: updated, oldRate };
  });
}

// ─── GOAL LABELS ─────────────────────────────────────────────────────────────

export async function setGoalLabels(
  proId: string,
  goals: string[],
): Promise<ProSavingsAccount> {
  const cleaned = Array.from(new Set(goals.map((g) => g.trim()).filter(Boolean))).slice(0, 12);
  return db.$transaction(async (tx) => {
    const account = await ensureSavingsAccount(proId, tx);
    return tx.proSavingsAccount.update({
      where: { id: account.id },
      data: { goalLabels: cleaned },
    });
  });
}

// ─── MANUAL ADJUSTMENT ───────────────────────────────────────────────────────

export async function adjustBalance(
  proId: string,
  amount: number,
  note: string,
): Promise<{ movement: SavingsMovement; account: ProSavingsAccount }> {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error("Adjustment amount must be a non-zero number");
  }
  if (!note || note.trim().length < 5) {
    throw new Error("Adjustment requires a note (min 5 chars)");
  }
  return db.$transaction(async (tx) => {
    const account = await ensureSavingsAccount(proId, tx);
    const res = await postSavingsMovementInner(
      {
        account,
        type: "ADJUSTMENT",
        amount: round2(amount),
        note: note.trim(),
        delta: { balanceAvailable: round2(amount) },
      },
      tx,
    );
    return { movement: res.movement, account: res.account };
  });
}

// ─── WITHDRAWALS ─────────────────────────────────────────────────────────────

export interface RequestWithdrawalOptions {
  notes?: string;
}

export async function requestWithdrawal(
  proId: string,
  amount: number,
  isInstant: boolean,
  options: RequestWithdrawalOptions = {},
): Promise<{
  withdrawal: SavingsWithdrawal;
  account: ProSavingsAccount;
  matchBonusOnRelease: number;
}> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Withdrawal amount must be positive");
  }
  return db.$transaction(async (tx) => {
    const account = await tx.proSavingsAccount.findUnique({ where: { proId } });
    if (!account) throw new Error("No Earnings Reserve account for this pro");
    if (round2(amount) > round2(account.balanceAvailable)) {
      throw new Error(
        `Insufficient available balance (₦${account.balanceAvailable.toFixed(2)})`,
      );
    }

    const settings = await loadSavingsSettings(tx);
    const penaltyPct = isInstant ? account.penaltyPct || settings.penaltyPct : 0;
    const penalty = round2(amount * penaltyPct);
    const net = round2(amount - penalty);

    // Notice-period withdrawals receive a 2% match bonus on release.
    const matchBonusOnRelease = isInstant ? 0 : round2(net * settings.matchBonusPct);

    const noticeUntil = isInstant
      ? null
      : new Date(Date.now() + (account.noticeDays || settings.noticeDays) * 24 * 60 * 60 * 1000);

    const withdrawal = await tx.savingsWithdrawal.create({
      data: {
        accountId: account.id,
        proId,
        amount: round2(amount),
        penaltyAmount: penalty,
        netAmount: net,
        status: "PENDING",
        isInstant,
        noticeUntil,
        notes: options.notes ?? null,
      },
    });

    // Reserve balance: available → pendingWd
    const idempotencyKey = `withdrawal:${withdrawal.id}:REQUEST`;
    const updated = await tx.proSavingsAccount.update({
      where: { id: account.id },
      data: {
        balanceAvailable: { decrement: round2(amount) },
        balancePendingWd: { increment: round2(amount) },
      },
    });
    await tx.savingsMovement.create({
      data: {
        accountId: account.id,
        proId,
        type: "WITHDRAWAL_REQUEST",
        amount: -round2(amount),
        balanceAfter: round2(
          updated.balanceAvailable + updated.balanceLocked + updated.balancePendingWd,
        ),
        withdrawalId: withdrawal.id,
        note: isInstant
          ? `Instant break requested. Penalty ₦${penalty.toFixed(2)} (${(penaltyPct * 100).toFixed(0)}%), net ₦${net.toFixed(2)}.`
          : `Standard withdrawal requested. Notice until ${noticeUntil!.toDateString()}. Net ₦${net.toFixed(2)}.`,
        idempotencyKey,
      },
    });

    return { withdrawal, account: updated, matchBonusOnRelease };
  });
}

export async function cancelWithdrawal(
  withdrawalId: string,
  options: { adminId?: string; note?: string } = {},
): Promise<SavingsWithdrawal> {
  return db.$transaction(async (tx) => {
    const w = await tx.savingsWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new Error("Withdrawal not found");
    if (w.status === "PAID") throw new Error("Cannot cancel a paid withdrawal");
    if (w.status === "CANCELLED") return w;
    if (w.status === "FAILED") throw new Error("Withdrawal already failed; use retry or adjust");

    const updated = await tx.savingsWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    // Un-reserve: pendingWd → available
    const acct = await tx.proSavingsAccount.update({
      where: { id: w.accountId },
      data: {
        balancePendingWd: { decrement: round2(w.amount) },
        balanceAvailable: { increment: round2(w.amount) },
      },
    });
    await tx.savingsMovement.create({
      data: {
        accountId: w.accountId,
        proId: w.proId,
        type: "WITHDRAWAL_CANCELLED",
        amount: round2(w.amount),
        balanceAfter: round2(
          acct.balanceAvailable + acct.balanceLocked + acct.balancePendingWd,
        ),
        withdrawalId: w.id,
        note: options.note ?? "Withdrawal cancelled — balance returned to available",
        idempotencyKey: `withdrawal:${withdrawalId}:CANCELLED`,
      },
    });
    return updated;
  });
}

/**
 * Force-mature a PENDING withdrawal to ELIGIBLE without waiting for its
 * notice. Admin-only. Used when the pro has a genuine emergency or the
 * notice was set in error.
 */
export async function forceMatureWithdrawal(
  withdrawalId: string,
): Promise<SavingsWithdrawal> {
  const w = await db.savingsWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!w) throw new Error("Withdrawal not found");
  if (w.status !== "PENDING") {
    throw new Error(`Cannot force-mature from status ${w.status}`);
  }
  return db.savingsWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "ELIGIBLE", noticeUntil: new Date() },
  });
}

/**
 * Release an ELIGIBLE (or PENDING-via-instant) withdrawal: actually pays it
 * out to the pro. Posts WITHDRAWAL_RELEASED + MATCH_BONUS movements,
 * decrements the vault, marks withdrawal PAID, returns the Payout record.
 *
 * Paystack transfer is the caller's responsibility — we expose `payoutId`
 * so the route can stitch it back in.
 */
export async function releaseWithdrawal(
  withdrawalId: string,
  options: { payoutId?: string | null } = {},
): Promise<{
  withdrawal: SavingsWithdrawal;
  account: ProSavingsAccount;
  matchBonus: number;
}> {
  return db.$transaction(async (tx) => {
    const w = await tx.savingsWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new Error("Withdrawal not found");
    if (w.status === "PAID") {
      const acct = await tx.proSavingsAccount.findUniqueOrThrow({ where: { id: w.accountId } });
      return { withdrawal: w, account: acct, matchBonus: 0 };
    }
    if (w.status === "CANCELLED" || w.status === "FAILED") {
      throw new Error(`Cannot release from status ${w.status}`);
    }
    // Instant withdrawals skip the notice — auto-flip PENDING → ELIGIBLE here.
    if (w.status === "PENDING" && !w.isInstant) {
      const now = new Date();
      if (w.noticeUntil && w.noticeUntil > now) {
        throw new Error(
          `Notice period not yet elapsed (until ${w.noticeUntil.toISOString()})`,
        );
      }
    }

    const settings = await loadSavingsSettings(tx);
    const matchBonus = w.isInstant ? 0 : round2(w.netAmount * settings.matchBonusPct);

    // 1. Decrement vault: pendingWd → out, plus EARLY_BREAK_PENALTY for the
    //    forfeited slice (penalty stays out of the pro's reach entirely).
    const updated = await tx.proSavingsAccount.update({
      where: { id: w.accountId },
      data: {
        balancePendingWd: { decrement: round2(w.amount) },
        totalWithdrawn: { increment: round2(w.netAmount) },
        ...(matchBonus > 0
          ? { totalMatchEarned: { increment: matchBonus } }
          : {}),
      },
    });

    // 2. Sentinel WITHDRAWAL_RELEASED row.
    await tx.savingsMovement.create({
      data: {
        accountId: w.accountId,
        proId: w.proId,
        type: "WITHDRAWAL_RELEASED",
        amount: -round2(w.netAmount),
        balanceAfter: round2(
          updated.balanceAvailable + updated.balanceLocked + updated.balancePendingWd,
        ),
        withdrawalId: w.id,
        note: `Withdrawal released. Paid ₦${w.netAmount.toFixed(2)} to pro.`,
        idempotencyKey: `withdrawal:${withdrawalId}:RELEASED`,
      },
    });

    // 3. EARLY_BREAK_PENALTY (only for instant withdrawals with penalty > 0).
    if (w.isInstant && w.penaltyAmount > 0) {
      await tx.savingsMovement.create({
        data: {
          accountId: w.accountId,
          proId: w.proId,
          type: "EARLY_BREAK_PENALTY",
          amount: -round2(w.penaltyAmount),
          balanceAfter: round2(
            updated.balanceAvailable + updated.balanceLocked + updated.balancePendingWd,
          ),
          withdrawalId: w.id,
          note: `Instant-break penalty forfeited to platform.`,
          idempotencyKey: `withdrawal:${withdrawalId}:PENALTY`,
        },
      });
    }

    // 4. Match bonus (only for notice withdrawals).
    if (matchBonus > 0) {
      await tx.savingsMovement.create({
        data: {
          accountId: w.accountId,
          proId: w.proId,
          type: "MATCH_BONUS",
          amount: round2(matchBonus),
          balanceAfter: round2(
            updated.balanceAvailable + updated.balanceLocked + updated.balancePendingWd,
          ),
          withdrawalId: w.id,
          note: `Groomee loyalty top-up (${(settings.matchBonusPct * 100).toFixed(1)}%).`,
          idempotencyKey: `withdrawal:${withdrawalId}:MATCH_BONUS`,
        },
      });
    }

    const withdrawalUpdated = await tx.savingsWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: "PAID",
        releasedAt: new Date(),
        ...(options.payoutId ? { payoutId: options.payoutId } : {}),
      },
    });

    return { withdrawal: withdrawalUpdated, account: updated, matchBonus };
  });
}

/**
 * Mark a withdrawal as FAILED (e.g. Paystack transfer failed). Returns the
 * reserved balance to available.
 */
export async function markWithdrawalFailed(
  withdrawalId: string,
  reason: string,
): Promise<SavingsWithdrawal> {
  return db.$transaction(async (tx) => {
    const w = await tx.savingsWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new Error("Withdrawal not found");
    if (w.status === "FAILED") return w;

    const updated = await tx.savingsWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: "FAILED", failureReason: reason },
    });
    const acct = await tx.proSavingsAccount.update({
      where: { id: w.accountId },
      data: {
        balancePendingWd: { decrement: round2(w.amount) },
        balanceAvailable: { increment: round2(w.amount) },
      },
    });
    await tx.savingsMovement.create({
      data: {
        accountId: w.accountId,
        proId: w.proId,
        type: "ADJUSTMENT",
        amount: 0,
        balanceAfter: round2(
          acct.balanceAvailable + acct.balanceLocked + acct.balancePendingWd,
        ),
        withdrawalId: w.id,
        note: `Withdrawal failed: ${reason}. Balance returned to available.`,
        idempotencyKey: `withdrawal:${withdrawalId}:FAILED`,
      },
    });
    return updated;
  });
}

// ─── ADMIN: MANUAL MATCH BONUS ───────────────────────────────────────────────

/**
 * Admin-awarded loyalty top-up. Credits the pro's available balance, posts a
 * MATCH_BONUS movement, and increments totalMatchEarned. Audit-logged at the
 * route layer.
 */
export async function applyMatchBonus(
  proId: string,
  amount: number,
  note: string,
): Promise<{ movement: SavingsMovement; account: ProSavingsAccount }> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Match bonus amount must be positive");
  }
  const cleanNote = (note ?? "").trim();
  if (cleanNote.length < 5) {
    throw new Error("Match bonus requires a note (min 5 chars)");
  }
  return db.$transaction(async (tx) => {
    const account = await ensureSavingsAccount(proId, tx);
    const res = await postSavingsMovementInner(
      {
        account,
        type: "MATCH_BONUS",
        amount: round2(amount),
        note: cleanNote,
        delta: {
          balanceAvailable: round2(amount),
          totalMatchEarned: round2(amount),
        },
      },
      tx,
    );
    return { movement: res.movement, account: res.account };
  });
}

// ─── WEBHOOK: REVERSE A PAID WITHDRAWAL WHEN PAYSTACK TRANSFER FAILS ─────────

/**
 * Called from the Paystack webhook when a `transfer.failed` event fires for a
 * savings withdrawal that we already optimistically marked PAID. Walks the
 * release back: status PAID → FAILED, restores totalWithdrawn → balance, and
 * unwinds any match bonus we credited. Idempotent.
 */
export async function reverseWithdrawalAfterPaystackFailure(
  withdrawalId: string,
  reason: string,
): Promise<SavingsWithdrawal> {
  return db.$transaction(async (tx) => {
    const w = await tx.savingsWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new Error("Withdrawal not found");
    if (w.status === "FAILED") return w;

    // Idempotency guard: did we already post the reversal movement?
    const idempotencyKey = `withdrawal:${withdrawalId}:PAYSTACK_FAILED`;
    const dup = await tx.savingsMovement.findUnique({
      where: { proId_idempotencyKey: { proId: w.proId, idempotencyKey } },
    });
    if (dup) {
      return tx.savingsWithdrawal.update({
        where: { id: withdrawalId },
        data: { status: "FAILED", failureReason: reason },
      });
    }

    // Reverse the match bonus we credited at release time (if any).
    const matchAgg = await tx.savingsMovement.aggregate({
      where: { withdrawalId, type: "MATCH_BONUS" },
      _sum: { amount: true },
    });
    const matchBonus = round2(matchAgg._sum.amount ?? 0);

    // Restore the net amount that we counted as withdrawn back into available.
    const acct = await tx.proSavingsAccount.update({
      where: { id: w.accountId },
      data: {
        balanceAvailable: { increment: round2(w.netAmount + matchBonus) },
        totalWithdrawn: { decrement: round2(w.netAmount) },
        ...(matchBonus > 0 ? { totalMatchEarned: { decrement: matchBonus } } : {}),
      },
    });

    await tx.savingsMovement.create({
      data: {
        accountId: w.accountId,
        proId: w.proId,
        type: "ADJUSTMENT",
        amount: round2(w.netAmount + matchBonus),
        balanceAfter: round2(
          acct.balanceAvailable + acct.balanceLocked + acct.balancePendingWd,
        ),
        withdrawalId: w.id,
        note: `Paystack transfer failed (${reason}). Reserve fully restored.`,
        idempotencyKey,
      },
    });

    return tx.savingsWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: "FAILED", failureReason: reason },
    });
  });
}

// ─── CRON: MATURITY TICKER ───────────────────────────────────────────────────

/**
 * 1. Find PENDING withdrawals whose noticeUntil has elapsed; flip to ELIGIBLE.
 * 2. Mature any SKIM rows past the clawback window (locked → available).
 *
 * Returns counts for cron logging.
 */
export async function runMaturityCron(): Promise<{
  withdrawalsMatured: number;
  skimRowsMatured: number;
}> {
  const settings = await loadSavingsSettings();
  const now = new Date();
  const matured = await db.savingsWithdrawal.updateMany({
    where: {
      status: "PENDING",
      isInstant: false,
      noticeUntil: { lte: now },
    },
    data: { status: "ELIGIBLE" },
  });

  let skimRowsMatured = 0;
  await db.$transaction(async (tx) => {
    const before = await tx.savingsMovement.count({
      where: {
        type: "ADJUSTMENT",
        idempotencyKey: { startsWith: "mature:savings:" },
      },
    });
    await maturePastClawbackWindow(tx, settings);
    const after = await tx.savingsMovement.count({
      where: {
        type: "ADJUSTMENT",
        idempotencyKey: { startsWith: "mature:savings:" },
      },
    });
    skimRowsMatured = after - before;
  });

  return { withdrawalsMatured: matured.count, skimRowsMatured };
}

// ─── FORENSIC RECALC ─────────────────────────────────────────────────────────

/**
 * Re-derive cached running balances from the SavingsMovement ledger. Returns
 * the recomputed totals + the cached snapshot before recompute so admins
 * can verify whether the cache was drifting.
 */
export async function recalcCachedBalances(proId: string): Promise<{
  before: Pick<
    ProSavingsAccount,
    | "balanceAvailable"
    | "balanceLocked"
    | "balancePendingWd"
    | "totalSkimmed"
    | "totalMatchEarned"
    | "totalWithdrawn"
    | "totalClawedBack"
  >;
  after: Pick<
    ProSavingsAccount,
    | "balanceAvailable"
    | "balanceLocked"
    | "balancePendingWd"
    | "totalSkimmed"
    | "totalMatchEarned"
    | "totalWithdrawn"
    | "totalClawedBack"
  >;
  drifted: boolean;
}> {
  const account = await db.proSavingsAccount.findUnique({ where: { proId } });
  if (!account) throw new Error("Account not found");

  // Compute lifetime totals from immutable ledger.
  const skimsAgg = await db.savingsMovement.aggregate({
    where: { proId, type: "SKIM" },
    _sum: { amount: true },
  });
  const matchAgg = await db.savingsMovement.aggregate({
    where: { proId, type: "MATCH_BONUS" },
    _sum: { amount: true },
  });
  const withdrawAgg = await db.savingsMovement.aggregate({
    where: { proId, type: "WITHDRAWAL_RELEASED" },
    _sum: { amount: true },
  });
  const clawbackAgg = await db.savingsMovement.aggregate({
    where: { proId, type: "CLAWBACK" },
    _sum: { amount: true },
  });

  const totalSkimmed = round2(skimsAgg._sum.amount ?? 0);
  const totalMatchEarned = round2(matchAgg._sum.amount ?? 0);
  const totalWithdrawn = round2(Math.abs(withdrawAgg._sum.amount ?? 0));
  const totalClawedBack = round2(Math.abs(clawbackAgg._sum.amount ?? 0));

  // Cached balance buckets:
  //   balancePendingWd = sum of amount on open PENDING/ELIGIBLE withdrawals
  //   balanceLocked    = sum of net (skim - clawback) for SKIM rows that
  //                      are still within the clawback window
  //   balanceAvailable = totalSkimmed + totalMatchEarned
  //                      - totalWithdrawn - totalClawedBack
  //                      - balanceLocked - balancePendingWd
  const openWithdrawals = await db.savingsWithdrawal.aggregate({
    where: { proId, status: { in: ["PENDING", "ELIGIBLE"] } },
    _sum: { amount: true },
  });
  const balancePendingWd = round2(openWithdrawals._sum.amount ?? 0);

  const settings = await loadSavingsSettings();
  const cutoff = new Date(Date.now() - settings.clawbackHours * 60 * 60 * 1000);
  const liveSkims = await db.savingsMovement.findMany({
    where: { type: "SKIM", proId, createdAt: { gt: cutoff } },
    select: { bookingId: true, amount: true },
  });
  let lockedSum = 0;
  for (const s of liveSkims) {
    if (!s.bookingId) {
      lockedSum += s.amount;
      continue;
    }
    const cb = await db.savingsMovement.aggregate({
      where: { type: "CLAWBACK", proId, bookingId: s.bookingId },
      _sum: { amount: true },
    });
    lockedSum += s.amount + (cb._sum.amount ?? 0);
  }
  const balanceLocked = round2(Math.max(0, lockedSum));

  const balanceAvailable = round2(
    totalSkimmed +
      totalMatchEarned -
      totalWithdrawn -
      totalClawedBack -
      balanceLocked -
      balancePendingWd,
  );

  const before = {
    balanceAvailable: account.balanceAvailable,
    balanceLocked: account.balanceLocked,
    balancePendingWd: account.balancePendingWd,
    totalSkimmed: account.totalSkimmed,
    totalMatchEarned: account.totalMatchEarned,
    totalWithdrawn: account.totalWithdrawn,
    totalClawedBack: account.totalClawedBack,
  };
  const after = {
    balanceAvailable,
    balanceLocked,
    balancePendingWd,
    totalSkimmed,
    totalMatchEarned,
    totalWithdrawn,
    totalClawedBack,
  };
  const drift = (Object.keys(after) as Array<keyof typeof after>).some(
    (k) => Math.abs((before[k] ?? 0) - (after[k] ?? 0)) > 0.01,
  );

  await db.proSavingsAccount.update({
    where: { proId },
    data: after,
  });

  return { before, after, drifted: drift };
}

// ─── SETTINGS WRITE ──────────────────────────────────────────────────────────

export interface SavingsSettingsInput {
  enabled?: boolean;
  rate?: number;
  sliderMin?: number;
  sliderMax?: number;
  noticeDays?: number;
  penaltyPct?: number;
  clawbackHours?: number;
  matchBonusPct?: number;
}

export async function saveSavingsSettings(input: SavingsSettingsInput): Promise<SavingsSettings> {
  const updates: Array<{ key: string; value: string }> = [];

  if (input.enabled != null) updates.push({ key: SAVINGS_SETTING_KEYS.enabled, value: input.enabled ? "true" : "false" });

  // Validate cross-bounds first using the post-update view.
  const current = await loadSavingsSettings();
  const next: SavingsSettings = {
    enabled: input.enabled ?? current.enabled,
    rate: input.rate ?? current.rate,
    sliderMin: input.sliderMin ?? current.sliderMin,
    sliderMax: input.sliderMax ?? current.sliderMax,
    noticeDays: input.noticeDays ?? current.noticeDays,
    penaltyPct: input.penaltyPct ?? current.penaltyPct,
    clawbackHours: input.clawbackHours ?? current.clawbackHours,
    matchBonusPct: input.matchBonusPct ?? current.matchBonusPct,
  };

  if (!(next.sliderMin >= 0 && next.sliderMin < next.sliderMax && next.sliderMax <= 1)) {
    throw new Error("Slider range invalid: need 0 ≤ min < max ≤ 1");
  }
  if (!(next.rate >= next.sliderMin && next.rate <= next.sliderMax)) {
    throw new Error("Default rate must lie within slider range");
  }
  if (!(next.noticeDays >= 1 && next.noticeDays <= 90)) {
    throw new Error("Notice days must be between 1 and 90");
  }
  if (!(next.penaltyPct >= 0 && next.penaltyPct <= 0.5)) {
    throw new Error("Penalty pct must be between 0 and 0.5");
  }
  if (!(next.clawbackHours >= 0 && next.clawbackHours <= 168)) {
    throw new Error("Clawback hours must be between 0 and 168");
  }
  if (!(next.matchBonusPct >= 0 && next.matchBonusPct <= 0.10)) {
    throw new Error("Match bonus pct must be between 0 and 0.10");
  }

  if (input.rate != null) updates.push({ key: SAVINGS_SETTING_KEYS.defaultRate, value: String(next.rate) });
  if (input.sliderMin != null) updates.push({ key: SAVINGS_SETTING_KEYS.sliderMin, value: String(next.sliderMin) });
  if (input.sliderMax != null) updates.push({ key: SAVINGS_SETTING_KEYS.sliderMax, value: String(next.sliderMax) });
  if (input.noticeDays != null) updates.push({ key: SAVINGS_SETTING_KEYS.defaultNoticeDays, value: String(next.noticeDays) });
  if (input.penaltyPct != null) updates.push({ key: SAVINGS_SETTING_KEYS.defaultPenaltyPct, value: String(next.penaltyPct) });
  if (input.clawbackHours != null) updates.push({ key: SAVINGS_SETTING_KEYS.clawbackHours, value: String(next.clawbackHours) });
  if (input.matchBonusPct != null) updates.push({ key: SAVINGS_SETTING_KEYS.matchBonusPct, value: String(next.matchBonusPct) });

  await Promise.all(
    updates.map(({ key, value }) =>
      db.setting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
  return next;
}

// ─── KPI SUMMARY ─────────────────────────────────────────────────────────────

export async function getOverview(): Promise<{
  totalLocked: number;
  totalAvailable: number;
  totalPendingWd: number;
  totalWithdrawn: number;
  totalSkimmed: number;
  optInCount: number;
  totalProCount: number;
  optInPct: number;
  skimmedLast7d: number;
  clawedBackLast7d: number;
  pendingWithdrawalCount: number;
  eligibleWithdrawalCount: number;
}> {
  const [
    sums,
    optInCount,
    totalProCount,
    skim7d,
    claw7d,
    pendingCount,
    eligibleCount,
  ] = await Promise.all([
    db.proSavingsAccount.aggregate({
      _sum: {
        balanceLocked: true,
        balanceAvailable: true,
        balancePendingWd: true,
        totalWithdrawn: true,
        totalSkimmed: true,
      },
    }),
    db.proSavingsAccount.count({ where: { optedIn: true } }),
    db.pro.count(),
    db.savingsMovement.aggregate({
      where: {
        type: "SKIM",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      _sum: { amount: true },
    }),
    db.savingsMovement.aggregate({
      where: {
        type: "CLAWBACK",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      _sum: { amount: true },
    }),
    db.savingsWithdrawal.count({ where: { status: "PENDING" } }),
    db.savingsWithdrawal.count({ where: { status: "ELIGIBLE" } }),
  ]);

  const totalLocked = round2(sums._sum.balanceLocked ?? 0);
  const totalAvailable = round2(sums._sum.balanceAvailable ?? 0);
  const totalPendingWd = round2(sums._sum.balancePendingWd ?? 0);
  const totalWithdrawn = round2(sums._sum.totalWithdrawn ?? 0);
  const totalSkimmed = round2(sums._sum.totalSkimmed ?? 0);
  const optInPct = totalProCount > 0 ? round2((optInCount / totalProCount) * 100) : 0;

  return {
    totalLocked,
    totalAvailable,
    totalPendingWd,
    totalWithdrawn,
    totalSkimmed,
    optInCount,
    totalProCount,
    optInPct,
    skimmedLast7d: round2(skim7d._sum.amount ?? 0),
    clawedBackLast7d: round2(Math.abs(claw7d._sum.amount ?? 0)),
    pendingWithdrawalCount: pendingCount,
    eligibleWithdrawalCount: eligibleCount,
  };
}
