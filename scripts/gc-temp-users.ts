import { PrismaClient } from "@prisma/client";

const LEGACY_TEMP_PREFIX = "+234_email_";
const STALE_AFTER_HOURS = 24;

async function main() {
  const db = new PrismaClient();
  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000);
  const dryRun = process.argv.includes("--dry-run");

  // First, normalise any legacy +234_email_* placeholders down to phone=null.
  // After the nullable-phone migration this is the canonical "no phone yet"
  // representation.
  const legacy = await db.user.findMany({
    where: { phone: { startsWith: LEGACY_TEMP_PREFIX } },
    select: { id: true },
  });
  if (legacy.length > 0) {
    console.log(`Normalising ${legacy.length} legacy +234_email_* phones to null${dryRun ? " (dry-run)" : ""}.`);
    if (!dryRun) {
      await db.user.updateMany({
        where: { id: { in: legacy.map((u) => u.id) } },
        data: { phone: null },
      });
    }
  }

  // Candidates: email-only users (phone null) older than cutoff that have not
  // completed signup (no name set). Guard by checking no owned data.
  const candidates = await db.user.findMany({
    where: {
      phone: null,
      name: null,
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      email: true,
      phone: true,
      createdAt: true,
      _count: {
        select: {
          bookings: true,
          favouritePros: true,
          subscriptions: true,
          giftCardsSent: true,
          referralsMade: true,
          activityLogs: true,
        },
      },
      pro: { select: { id: true } },
      beautyProfile: { select: { userId: true } },
    },
  });

  const safeToDelete = candidates.filter((u) => {
    if (u.pro) return false;
    if (u.beautyProfile) return false;
    return Object.values(u._count).every((n) => n === 0);
  });

  console.log(
    `Found ${candidates.length} stale temp users; ${safeToDelete.length} safe to delete${dryRun ? " (dry-run)" : ""}.`,
  );

  for (const u of safeToDelete) {
    console.log(`  ${u.id}  ${u.email ?? "(no email)"}  created=${u.createdAt.toISOString()}`);
  }

  if (!dryRun && safeToDelete.length > 0) {
    const result = await db.user.deleteMany({
      where: { id: { in: safeToDelete.map((u) => u.id) } },
    });
    console.log(`Deleted ${result.count} users.`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
