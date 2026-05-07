import { db } from "./db";
import type { Prisma } from "@prisma/client";

/**
 * Reverses every Earning row attached to a booking when the booking is
 * cancelled (after CONFIRMED) or refunded.
 *
 * Behaviour:
 *  - `refundFraction === 1` (full refund / cancel): hard-delete every row.
 *  - `refundFraction < 1` (partial refund): scale each row's amount down by
 *    `(1 - refundFraction)`. Rounded to 2 d.p. to match the rest of the
 *    earnings system.
 *
 * Important: this also handles APPRENTICE_COMMISSION rows on the master, so
 * a master cannot keep their cut on a refunded booking. That's the whole
 * point of clawback parity.
 *
 * If a Prisma transaction client is provided, work happens on that tx.
 * Otherwise this opens its own short transaction.
 */
export async function reverseEarningsForBooking(
  bookingId: string,
  refundFraction: number,
  txClient?: Prisma.TransactionClient,
): Promise<{ removed: number; scaled: number }> {
  const work = async (tx: Prisma.TransactionClient) => {
    if (refundFraction >= 1) {
      const result = await tx.earning.deleteMany({ where: { bookingId } });
      return { removed: result.count, scaled: 0 };
    }
    if (refundFraction <= 0) {
      return { removed: 0, scaled: 0 };
    }
    const rows = await tx.earning.findMany({ where: { bookingId } });
    const keepFraction = 1 - refundFraction;
    let scaled = 0;
    for (const row of rows) {
      const newAmount = Math.round(row.amount * keepFraction * 100) / 100;
      await tx.earning.update({
        where: { id: row.id },
        data: { amount: newAmount },
      });
      scaled++;
    }
    return { removed: 0, scaled };
  };

  if (txClient) return work(txClient);
  return db.$transaction(work);
}
