/**
 * Dedupes User rows that share an email so we can safely add `@unique` to
 * `User.email`.
 *
 * Strategy per duplicate group (case-insensitive email):
 *   1. Pick the "winner": prefer a user with a linked phone, then the oldest
 *      record by createdAt. This keeps the account a real human knows about.
 *   2. For every other user in the group:
 *      - If the winner has no phone and the loser does, lift the phone over.
 *      - Reassign FK rows that point at the loser (bookings, points, etc.)
 *        to the winner.
 *      - Delete the loser.
 *   3. Groups where two or more users have *different* phones are flagged for
 *      manual review and skipped — we won't merge two real accounts blindly.
 *
 * Idempotent: re-running after a clean pass is a no-op.
 *
 * Usage:
 *   npx tsx scripts/dedup-emails.ts            # dry run (default)
 *   npx tsx scripts/dedup-emails.ts --apply    # actually delete/merge
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type UserRow = {
  id: string;
  phone: string | null;
  email: string | null;
  name: string | null;
  createdAt: Date;
};

async function reassign(loserId: string, winnerId: string) {
  // Move every owned FK from loser → winner. Use updateMany so missing rows
  // don't blow up. Anything not listed here is either: a unique 1:1 we
  // handle inline (BeautyProfile, Pro), or genuinely fine to drop with the
  // loser (OtpCode, etc.).
  await db.booking.updateMany({ where: { customerId: loserId }, data: { customerId: winnerId } });
  await db.favouritePro.updateMany({ where: { userId: loserId }, data: { userId: winnerId } });
  await db.subscription.updateMany({ where: { userId: loserId }, data: { userId: winnerId } });
  await db.giftCard.updateMany({ where: { senderId: loserId }, data: { senderId: winnerId } });
  await db.giftCard.updateMany({ where: { redeemedBy: loserId }, data: { redeemedBy: winnerId } });
  await db.referral.updateMany({ where: { referrerId: loserId }, data: { referrerId: winnerId } });
  await db.referral.updateMany({ where: { referredUserId: loserId }, data: { referredUserId: winnerId } });
  await db.note.updateMany({ where: { authorId: loserId }, data: { authorId: winnerId } });
  await db.activityLog.updateMany({ where: { adminId: loserId }, data: { adminId: winnerId } });
  await db.pointsLedger.updateMany({ where: { userId: loserId }, data: { userId: winnerId } });

  // 1:1 relations — only move if winner doesn't already have one.
  const winnerBeauty = await db.beautyProfile.findUnique({ where: { userId: winnerId } });
  if (!winnerBeauty) {
    await db.beautyProfile.updateMany({ where: { userId: loserId }, data: { userId: winnerId } });
  } else {
    await db.beautyProfile.deleteMany({ where: { userId: loserId } });
  }

  const winnerPro = await db.pro.findUnique({ where: { userId: winnerId } });
  if (!winnerPro) {
    await db.pro.updateMany({ where: { userId: loserId }, data: { userId: winnerId } });
  } else {
    // Two pro records for the "same" person. Don't pick a winner blindly —
    // unhook the loser pro from this user and let an admin decide.
    await db.pro.updateMany({ where: { userId: loserId }, data: { userId: null } });
  }
}

async function run() {
  const allUsers: UserRow[] = await db.user.findMany({
    select: { id: true, phone: true, email: true, name: true, createdAt: true },
    where: { email: { not: null } },
  });

  const groups = new Map<string, UserRow[]>();
  for (const u of allUsers) {
    if (!u.email) continue;
    const key = u.email.toLowerCase().trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(u);
  }

  let dupGroups = 0;
  let merged = 0;
  let flagged = 0;

  for (const [email, rows] of groups) {
    if (rows.length < 2) continue;
    dupGroups++;

    const phones = new Set(rows.map((r) => r.phone).filter(Boolean));
    if (phones.size > 1) {
      console.warn(
        `[FLAG] Email "${email}" has ${rows.length} users with ${phones.size} different phones — skipping. IDs: ${rows.map((r) => r.id).join(", ")}`,
      );
      flagged++;
      continue;
    }

    const winner =
      rows.find((r) => r.phone) ??
      [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const losers = rows.filter((r) => r.id !== winner.id);

    console.log(
      `[MERGE] "${email}": keep ${winner.id} (${winner.phone ?? "no phone"}), drop ${losers.length} dup(s): ${losers.map((l) => l.id).join(", ")}`,
    );

    if (!APPLY) continue;

    // If the winner has no phone but a loser does, lift the phone.
    if (!winner.phone) {
      const loserWithPhone = losers.find((l) => l.phone);
      if (loserWithPhone?.phone) {
        // First null the loser's phone so the unique constraint doesn't fight us.
        await db.user.update({
          where: { id: loserWithPhone.id },
          data: { phone: null },
        });
        await db.user.update({
          where: { id: winner.id },
          data: { phone: loserWithPhone.phone },
        });
      }
    }

    for (const loser of losers) {
      await reassign(loser.id, winner.id);
      await db.user.delete({ where: { id: loser.id } });
      merged++;
    }
  }

  console.log("");
  console.log(`Duplicate email groups: ${dupGroups}`);
  console.log(`Users merged into winners: ${merged}`);
  console.log(`Groups flagged for manual review: ${flagged}`);
  console.log(APPLY ? "[applied]" : "[dry run — pass --apply to make changes]");
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
