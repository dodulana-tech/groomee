import { db } from "./db";

export async function awardPoints(userId: string, amount: number, reason: string, referenceId?: string) {
  await db.$transaction([
    db.pointsLedger.create({
      data: { userId, amount, reason, referenceId },
    }),
    db.user.update({
      where: { id: userId },
      data: { points: { increment: amount } },
    }),
  ]);
}

export const POINTS = {
  SURVEY_COMPLETION: 10,
  BOOKING_COMPLETION: 5,
  LEAVE_REVIEW: 3,
  JOIN_WAITLIST: 5,
  REFERRAL: 50,
} as const;
