import { db } from "./db";
import { Prisma } from "@prisma/client";
import {
  ensureWallet,
  postMovement,
  splitProEarning,
  loadReleaseFractions,
  clawbackForBooking,
} from "./wallet";
import { computeEarningsSplit } from "./apprenticeships";
import {
  notifyProMobilizationCredited,
  notifyProCompletionRelease,
  notifyProConfirmRelease,
  notifyProClawback,
} from "./whatsapp";

// Pending notifications to fire after the surrounding tx commits. The wallet
// release helpers can be called with an external tx (e.g. from booking confirm
// route), so we never call sendMessage inside the tx — Twilio latency would
// hold the wallet row lock open.
interface PendingNotice {
  phone: string;
  kind: "MOBILIZATION" | "COMPLETION" | "CONFIRM" | "CLAWBACK";
  amount: number;
  bookingRef: string;
  reason?: string;
}

async function fireNotices(notices: PendingNotice[]): Promise<void> {
  if (notices.length === 0) return;
  await Promise.allSettled(
    notices.map(async (n) => {
      if (!n.phone) return;
      try {
        switch (n.kind) {
          case "MOBILIZATION":
            await notifyProMobilizationCredited(n.phone, n.amount, n.bookingRef);
            break;
          case "COMPLETION":
            await notifyProCompletionRelease(n.phone, n.amount, n.bookingRef);
            break;
          case "CONFIRM":
            await notifyProConfirmRelease(n.phone, n.amount, n.bookingRef);
            break;
          case "CLAWBACK":
            await notifyProClawback(n.phone, Math.abs(n.amount), n.reason ?? `Booking ${n.bookingRef}`);
            break;
        }
      } catch (err) {
        console.error("[wallet-releases] notify failed", { kind: n.kind, err });
      }
    }),
  );
}

// ─── BOOKING-LIFECYCLE WALLET RELEASES ───────────────────────────────────────
//
// One helper per stage. Each is idempotent (compound unique on
// `idempotencyKey`) so multiple calls for the same booking+stage no-op.
//
// Apprenticeship attribution:
//   - MOBILIZATION (accept): apprentice gets mobilization*(1-mc) as
//     MOBILIZATION; master gets mobilization*mc ALSO as MOBILIZATION (same
//     type), tagged with sourceProId=apprenticeId. The transport money is
//     visibly mobilization for both sides of the relationship.
//   - COMPLETION_RELEASE (DONE): apprentice gets completion*(1-mc); no
//     master leg here — the master's cut accrues silently until confirm.
//   - CONFIRM_RELEASE (CONFIRMED): apprentice gets confirm*(1-mc) as
//     CONFIRM_RELEASE; master gets a SINGLE APPRENTICE_COMMISSION_RELEASE
//     row for the still-unposted master share (i.e. mc * (completion +
//     confirm) when mobilization was already settled). This keeps the
//     audit trail compact: apprentice has 3 lines, master has 2.
//
// Canonical idempotency keys (consumed by clawback math too):
//   booking:{id}:MOBILIZATION:{apprenticeProId}
//   booking:{id}:MOBILIZATION:MASTER:{masterId}
//   booking:{id}:COMPLETION:{apprenticeProId}
//   booking:{id}:CONFIRM:{apprenticeProId}
//   booking:{id}:MASTER:{masterId}
//
// Non-apprentice (independent) pro keeps the same MOBILIZATION/COMPLETION/
// CONFIRM keys, just no master leg.

export type ReleaseStage =
  | "MOBILIZATION"
  | "COMPLETION_RELEASE"
  | "CONFIRM_RELEASE";

function stageKey(stage: ReleaseStage): string {
  if (stage === "MOBILIZATION") return "MOBILIZATION";
  if (stage === "COMPLETION_RELEASE") return "COMPLETION";
  return "CONFIRM";
}

async function withTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  tx?: Prisma.TransactionClient,
): Promise<T> {
  if (tx) return fn(tx);
  return db.$transaction(fn);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Post the mobilization release for a booking that just transitioned to
 * ACCEPTED. Fraction comes from Settings. No-op if mobilization fraction is 0.
 *
 * Apprentice path: apprentice gets `mob*(1-mc)`; master gets `mob*mc` also
 * as a MOBILIZATION movement (transport money is visibly mobilization for
 * both sides). Tagged with sourceProId=apprenticeId + apprenticeshipId so
 * the audit trail walks both directions.
 */
export async function releaseMobilization(
  bookingId: string,
  tx?: Prisma.TransactionClient,
) {
  const booking = await (tx ?? db).booking.findUnique({
    where: { id: bookingId },
    select: { id: true, proId: true, proEarning: true, reference: true },
  });
  if (!booking || !booking.proId || booking.proEarning <= 0) return;
  const fractions = await loadReleaseFractions();
  const { mobilization } = splitProEarning(booking.proEarning, fractions);
  if (mobilization <= 0) return;

  const notices: PendingNotice[] = [];

  await withTx(async (inner) => {
    const split = await computeEarningsSplit(booking.proId!, mobilization);
    if (split) {
      await ensureWallet(booking.proId!, inner);
      await ensureWallet(split.masterId, inner);
      const apprenticeRes = await postMovement(
        {
          proId: booking.proId!,
          type: "MOBILIZATION",
          amount: split.apprenticeAmount,
          bookingId: booking.id,
          apprenticeshipId: split.apprenticeshipId,
          note: `Mobilization on booking ${booking.reference}`,
          idempotencyKey: `booking:${booking.id}:MOBILIZATION:${booking.proId}`,
        },
        inner,
      );
      const masterRes = await postMovement(
        {
          proId: split.masterId,
          type: "MOBILIZATION",
          amount: split.masterAmount,
          bookingId: booking.id,
          sourceProId: booking.proId,
          apprenticeshipId: split.apprenticeshipId,
          note: `Master's share of mobilization on booking ${booking.reference}`,
          idempotencyKey: `booking:${booking.id}:MOBILIZATION:MASTER:${split.masterId}`,
        },
        inner,
      );
      if (!apprenticeRes.deduplicated) {
        const apprenticePro = await inner.pro.findUnique({
          where: { id: booking.proId! },
          select: { phone: true },
        });
        if (apprenticePro?.phone) {
          notices.push({
            phone: apprenticePro.phone,
            kind: "MOBILIZATION",
            amount: split.apprenticeAmount,
            bookingRef: booking.reference,
          });
        }
      }
      if (!masterRes.deduplicated) {
        const masterPro = await inner.pro.findUnique({
          where: { id: split.masterId },
          select: { phone: true },
        });
        if (masterPro?.phone) {
          notices.push({
            phone: masterPro.phone,
            kind: "MOBILIZATION",
            amount: split.masterAmount,
            bookingRef: booking.reference,
          });
        }
      }
    } else {
      await ensureWallet(booking.proId!, inner);
      const res = await postMovement(
        {
          proId: booking.proId!,
          type: "MOBILIZATION",
          amount: mobilization,
          bookingId: booking.id,
          note: `Mobilization on booking ${booking.reference}`,
          idempotencyKey: `booking:${booking.id}:MOBILIZATION:${booking.proId}`,
        },
        inner,
      );
      if (!res.deduplicated) {
        const pro = await inner.pro.findUnique({
          where: { id: booking.proId! },
          select: { phone: true },
        });
        if (pro?.phone) {
          notices.push({
            phone: pro.phone,
            kind: "MOBILIZATION",
            amount: mobilization,
            bookingRef: booking.reference,
          });
        }
      }
    }
  }, tx);

  // Best-effort post-commit fire-and-forget. If the helper was called inside
  // an external tx that later rolls back, the dedup guard means a retry won't
  // re-notify; here we just send.
  void fireNotices(notices);
}

/**
 * Post the completion release for a booking that just transitioned to
 * COMPLETED. Apprentice gets reduced share; master leg accrues to be paid
 * out at confirm time so the audit trail stays clean.
 */
export async function releaseCompletion(
  bookingId: string,
  tx?: Prisma.TransactionClient,
) {
  const booking = await (tx ?? db).booking.findUnique({
    where: { id: bookingId },
    select: { id: true, proId: true, proEarning: true, reference: true },
  });
  if (!booking || !booking.proId || booking.proEarning <= 0) return;
  const fractions = await loadReleaseFractions();
  const { completion } = splitProEarning(booking.proEarning, fractions);
  if (completion <= 0) return;

  const notices: PendingNotice[] = [];

  await withTx(async (inner) => {
    const split = await computeEarningsSplit(booking.proId!, completion);
    const postedAmount = split ? split.apprenticeAmount : completion;
    await ensureWallet(booking.proId!, inner);
    const res = await postMovement(
      {
        proId: booking.proId!,
        type: "COMPLETION_RELEASE",
        amount: postedAmount,
        bookingId: booking.id,
        ...(split ? { apprenticeshipId: split.apprenticeshipId } : {}),
        note: `Completion release on booking ${booking.reference}`,
        idempotencyKey: `booking:${booking.id}:COMPLETION:${booking.proId}`,
      },
      inner,
    );
    if (!res.deduplicated) {
      const pro = await inner.pro.findUnique({
        where: { id: booking.proId! },
        select: { phone: true },
      });
      if (pro?.phone) {
        notices.push({
          phone: pro.phone,
          kind: "COMPLETION",
          amount: postedAmount,
          bookingRef: booking.reference,
        });
      }
    }
    // Master leg accrues silently to be paid out at confirm time.
  }, tx);

  void fireNotices(notices);
}

/**
 * Post the final confirm release for a booking that just transitioned to
 * CONFIRMED. Apprentice gets their reduced confirm slice; master collects a
 * single APPRENTICE_COMMISSION_RELEASE for whatever master-share still
 * hasn't been posted (typically completion*mc + confirm*mc, since mob*mc
 * was already paid at accept).
 *
 * Math is wallet-ledger-driven (forensic): we compute target sums and post
 * the gap, so any pre-existing partial state heals itself. Idempotent.
 */
export async function releaseConfirm(
  bookingId: string,
  tx?: Prisma.TransactionClient,
) {
  const booking = await (tx ?? db).booking.findUnique({
    where: { id: bookingId },
    select: { id: true, proId: true, proEarning: true, reference: true },
  });
  if (!booking || !booking.proId || booking.proEarning <= 0) return;
  const fractions = await loadReleaseFractions();
  const slices = splitProEarning(booking.proEarning, fractions);

  const notices: PendingNotice[] = [];

  await withTx(async (inner) => {
    const split = await computeEarningsSplit(booking.proId!, booking.proEarning);
    if (split) {
      // Apprentice's confirm slice (reduced by mc). Run the confirm slice
      // through computeEarningsSplit so the rounding lines up with the
      // mobilization/completion legs that did the same.
      const confirmSplit = await computeEarningsSplit(
        booking.proId!,
        slices.confirm,
      );
      const apprenticeShare = confirmSplit
        ? confirmSplit.apprenticeAmount
        : slices.confirm;

      await ensureWallet(booking.proId!, inner);
      const apprenticeRes = await postMovement(
        {
          proId: booking.proId!,
          type: "CONFIRM_RELEASE",
          amount: apprenticeShare,
          bookingId: booking.id,
          apprenticeshipId: split.apprenticeshipId,
          note: `Confirm release on booking ${booking.reference}`,
          idempotencyKey: `booking:${booking.id}:CONFIRM:${booking.proId}`,
        },
        inner,
      );
      if (!apprenticeRes.deduplicated) {
        const apprenticePro = await inner.pro.findUnique({
          where: { id: booking.proId! },
          select: { phone: true },
        });
        if (apprenticePro?.phone) {
          notices.push({
            phone: apprenticePro.phone,
            kind: "CONFIRM",
            amount: apprenticeShare,
            bookingRef: booking.reference,
          });
        }
      }

      // Master's combined commission: total master-cut minus whatever has
      // already been credited to the master for this booking (the master's
      // mobilization leg). The remainder is posted as a single
      // APPRENTICE_COMMISSION_RELEASE row, keyed booking:{id}:MASTER:{master}.
      const masterTotal = round2(booking.proEarning - split.apprenticeAmount);
      const existingMasterCredits = await inner.walletLedger.aggregate({
        where: {
          proId: split.masterId,
          bookingId: booking.id,
          type: { in: ["MOBILIZATION", "APPRENTICE_COMMISSION_RELEASE"] },
        },
        _sum: { amount: true },
      });
      const alreadyPaid = existingMasterCredits._sum.amount ?? 0;
      const remaining = round2(masterTotal - alreadyPaid);
      if (Math.abs(remaining) >= 0.01) {
        await ensureWallet(split.masterId, inner);
        const masterRes = await postMovement(
          {
            proId: split.masterId,
            type: "APPRENTICE_COMMISSION_RELEASE",
            amount: remaining,
            bookingId: booking.id,
            sourceProId: booking.proId,
            apprenticeshipId: split.apprenticeshipId,
            note: `Master's commission on booking ${booking.reference}`,
            idempotencyKey: `booking:${booking.id}:MASTER:${split.masterId}`,
          },
          inner,
        );
        if (!masterRes.deduplicated && remaining > 0) {
          const masterPro = await inner.pro.findUnique({
            where: { id: split.masterId },
            select: { phone: true },
          });
          if (masterPro?.phone) {
            notices.push({
              phone: masterPro.phone,
              kind: "CONFIRM",
              amount: remaining,
              bookingRef: booking.reference,
            });
          }
        }
      }
    } else {
      // Independent pro: catch-up to proEarning regardless of which upstream
      // stages ran. Sum existing non-clawback movements for this booking +
      // pro and post the gap as CONFIRM_RELEASE.
      const existing = await inner.walletLedger.aggregate({
        where: {
          proId: booking.proId!,
          bookingId: booking.id,
          type: {
            in: ["MOBILIZATION", "COMPLETION_RELEASE", "CONFIRM_RELEASE"],
          },
        },
        _sum: { amount: true },
      });
      const alreadyReleased = existing._sum.amount ?? 0;
      const remaining = round2(booking.proEarning - alreadyReleased);
      if (remaining <= 0) return;
      await ensureWallet(booking.proId!, inner);
      const res = await postMovement(
        {
          proId: booking.proId!,
          type: "CONFIRM_RELEASE",
          amount: remaining,
          bookingId: booking.id,
          note: `Confirm release on booking ${booking.reference}`,
          idempotencyKey: `booking:${booking.id}:CONFIRM:${booking.proId}`,
        },
        inner,
      );
      if (!res.deduplicated) {
        const pro = await inner.pro.findUnique({
          where: { id: booking.proId! },
          select: { phone: true },
        });
        if (pro?.phone) {
          notices.push({
            phone: pro.phone,
            kind: "CONFIRM",
            amount: remaining,
            bookingRef: booking.reference,
          });
        }
      }
    }
  }, tx);

  void fireNotices(notices);
}

/**
 * Convenience wrapper for refund/cancel paths: reverses every wallet
 * movement posted for this booking, scaled by `fraction` (1 = full reversal,
 * 0.5 = half).
 */
export async function clawbackBooking(
  bookingId: string,
  fraction = 1,
  tx?: Prisma.TransactionClient,
) {
  const notices: PendingNotice[] = [];
  let bookingRef = "";

  await withTx(async (inner) => {
    const booking = await inner.booking.findUnique({
      where: { id: bookingId },
      select: { reference: true },
    });
    bookingRef = booking?.reference ?? bookingId;
    const { posted } = await clawbackForBooking(bookingId, fraction, inner);
    for (const row of posted) {
      // Only notify on debits (negative amounts). The clawback engine
      // sometimes posts a positive (rare healing); skip those.
      if (row.amount >= 0) continue;
      const pro = await inner.pro.findUnique({
        where: { id: row.proId },
        select: { phone: true },
      });
      if (pro?.phone) {
        notices.push({
          phone: pro.phone,
          kind: "CLAWBACK",
          amount: row.amount,
          bookingRef,
          reason: `Booking ${bookingRef} was cancelled or refunded`,
        });
      }
    }
  }, tx);

  void fireNotices(notices);
}

// ─── DELEGATE / RESCIND MOBILIZATION FOLLOW-THROUGH ──────────────────────────
//
// When a master delegates an ACCEPTED booking to a dependent, the
// mobilization that was already paid to the master MUST follow the dependent
// (and the apprenticeship master-leg, if any, must follow too). Rescind is
// the symmetric reverse.
//
// We don't try to "re-issue" mobilization through `releaseMobilization`
// here because that would re-use the same idempotency keys and dedupe.
// Instead we post explicit MANUAL_ADJUSTMENT-style transfers… no — wait,
// we'd lose the type-as-event semantic. The cleaner approach: claw back
// the existing MOBILIZATION rows for this booking (negative MOBILIZATION
// is not allowed — it's spelled CLAWBACK), then post a fresh MOBILIZATION
// to the new pro with a delegate/rescind-scoped idempotency key.

/**
 * Move the mobilization that was paid against `bookingId` to the new
 * `toProId`. Used after a delegate transition flipped booking.proId.
 *
 * Steps inside the caller's tx:
 *   1. CLAWBACK every still-live MOBILIZATION row on this booking (using
 *      delegate-scoped idempotency keys so this is safe to retry).
 *   2. Re-issue MOBILIZATION to the new pro (with their own apprenticeship
 *      attribution if they're an apprentice of `fromProId`).
 */
export async function transferMobilizationOnDelegate(
  bookingId: string,
  fromProId: string,
  toProId: string,
  tx?: Prisma.TransactionClient,
) {
  await withTx(async (inner) => {
    const booking = await inner.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, proEarning: true, reference: true },
    });
    if (!booking || booking.proEarning <= 0) return;

    // 1. Claw back every live MOBILIZATION row on this booking, scoped to
    //    this delegate event so re-runs are no-ops.
    const liveMob = await inner.walletLedger.findMany({
      where: {
        bookingId,
        type: "MOBILIZATION",
      },
    });
    // Sum non-clawback per-pro and emit a CLAWBACK row per recipient.
    const perPro = new Map<string, number>();
    for (const m of liveMob) {
      perPro.set(m.proId, (perPro.get(m.proId) ?? 0) + m.amount);
    }
    for (const [proId, sum] of perPro) {
      if (Math.abs(sum) < 0.01) continue;
      await ensureWallet(proId, inner);
      await postMovement(
        {
          proId,
          type: "CLAWBACK",
          amount: -round2(sum),
          bookingId,
          note: `Delegate ${fromProId}→${toProId}: returning MOBILIZATION on booking ${booking.reference}`,
          idempotencyKey: `delegate:${bookingId}:${proId}`,
        },
        inner,
      );
    }

    // 2. Re-issue mobilization to the new pro under fresh idempotency keys.
    const fractions = await loadReleaseFractions();
    const { mobilization } = splitProEarning(booking.proEarning, fractions);
    if (mobilization <= 0) return;
    const split = await computeEarningsSplit(toProId, mobilization);
    if (split) {
      await ensureWallet(toProId, inner);
      await ensureWallet(split.masterId, inner);
      await postMovement(
        {
          proId: toProId,
          type: "MOBILIZATION",
          amount: split.apprenticeAmount,
          bookingId: booking.id,
          apprenticeshipId: split.apprenticeshipId,
          note: `Delegated mobilization on booking ${booking.reference}`,
          idempotencyKey: `delegate:${bookingId}:${toProId}:MOBILIZATION`,
        },
        inner,
      );
      await postMovement(
        {
          proId: split.masterId,
          type: "MOBILIZATION",
          amount: split.masterAmount,
          bookingId: booking.id,
          sourceProId: toProId,
          apprenticeshipId: split.apprenticeshipId,
          note: `Master's share of delegated mobilization on booking ${booking.reference}`,
          idempotencyKey: `delegate:${bookingId}:${toProId}:MOBILIZATION:MASTER:${split.masterId}`,
        },
        inner,
      );
    } else {
      await ensureWallet(toProId, inner);
      await postMovement(
        {
          proId: toProId,
          type: "MOBILIZATION",
          amount: mobilization,
          bookingId: booking.id,
          note: `Delegated mobilization on booking ${booking.reference}`,
          idempotencyKey: `delegate:${bookingId}:${toProId}:MOBILIZATION`,
        },
        inner,
      );
    }
  }, tx);
}

/**
 * Symmetric reverse: dependent's mobilization is clawed back, master gets
 * a fresh MOBILIZATION row. Called from rescind.
 */
export async function transferMobilizationOnRescind(
  bookingId: string,
  fromProId: string,
  toProId: string,
  tx?: Prisma.TransactionClient,
) {
  await withTx(async (inner) => {
    const booking = await inner.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, proEarning: true, reference: true },
    });
    if (!booking || booking.proEarning <= 0) return;

    // Claw back live MOBILIZATION on this booking (covers dependent's
    // share and any master-leg that was attached during the delegated
    // window).
    const liveMob = await inner.walletLedger.findMany({
      where: { bookingId, type: "MOBILIZATION" },
    });
    const perPro = new Map<string, number>();
    for (const m of liveMob) {
      perPro.set(m.proId, (perPro.get(m.proId) ?? 0) + m.amount);
    }
    for (const [proId, sum] of perPro) {
      if (Math.abs(sum) < 0.01) continue;
      await ensureWallet(proId, inner);
      await postMovement(
        {
          proId,
          type: "CLAWBACK",
          amount: -round2(sum),
          bookingId,
          note: `Rescind ${fromProId}→${toProId}: returning MOBILIZATION on booking ${booking.reference}`,
          idempotencyKey: `rescind:${bookingId}:${proId}`,
        },
        inner,
      );
    }

    const fractions = await loadReleaseFractions();
    const { mobilization } = splitProEarning(booking.proEarning, fractions);
    if (mobilization <= 0) return;
    // On rescind the booking returned to the master; they're typically an
    // independent pro for this booking, but the master themselves may have
    // their own apprenticeship up the chain — we ignore that (apprentices
    // don't have apprentices). Just check via computeEarningsSplit which
    // will return null for non-apprenticed pros.
    const split = await computeEarningsSplit(toProId, mobilization);
    if (split) {
      await ensureWallet(toProId, inner);
      await ensureWallet(split.masterId, inner);
      await postMovement(
        {
          proId: toProId,
          type: "MOBILIZATION",
          amount: split.apprenticeAmount,
          bookingId: booking.id,
          apprenticeshipId: split.apprenticeshipId,
          note: `Rescinded mobilization on booking ${booking.reference}`,
          idempotencyKey: `rescind:${bookingId}:${toProId}:MOBILIZATION`,
        },
        inner,
      );
      await postMovement(
        {
          proId: split.masterId,
          type: "MOBILIZATION",
          amount: split.masterAmount,
          bookingId: booking.id,
          sourceProId: toProId,
          apprenticeshipId: split.apprenticeshipId,
          note: `Master's share of rescinded mobilization on booking ${booking.reference}`,
          idempotencyKey: `rescind:${bookingId}:${toProId}:MOBILIZATION:MASTER:${split.masterId}`,
        },
        inner,
      );
    } else {
      await ensureWallet(toProId, inner);
      await postMovement(
        {
          proId: toProId,
          type: "MOBILIZATION",
          amount: mobilization,
          bookingId: booking.id,
          note: `Rescinded mobilization on booking ${booking.reference}`,
          idempotencyKey: `rescind:${bookingId}:${toProId}:MOBILIZATION`,
        },
        inner,
      );
    }
  }, tx);
}
