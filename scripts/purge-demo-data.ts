/**
 * Purge demo / test / preview data so Groomee can run as a clean production
 * service.
 *
 * DRY-RUN BY DEFAULT. Nothing is deleted unless you pass --execute AND confirm
 * the database host.
 *
 * Usage:
 *   npm run purge:demo                                  # dry run (safe)
 *   npm run purge:demo -- --verbose                     # dry run, more sample rows
 *   npm run purge:demo -- --execute                     # asks you to type the DB host
 *   CONFIRM_DB_HOST=<host> npm run purge:demo -- --execute   # non-interactive
 *
 * Flags:
 *   --execute                      actually delete (inside one transaction)
 *   --i-know-this-is-production    required when NODE_ENV=production
 *   --allow-real-money-impact      allow deleting bookings that a REAL customer
 *                                  paid for, or paid earnings of a REAL pro
 *                                  (the run aborts without it if any exist)
 *   --keep-phones=+234...,+234...  never treat these users/pros as demo
 *   --no-name-markers              don't flag users/pros by a "test" word in
 *                                  their name (phone/script markers only)
 *   --backup-dir=<dir>             where to write the JSON backup (default ./backups)
 *   --verbose                      print up to 25 sample rows per table (default 5)
 *
 * What counts as demo data (each rule is traced back to where it came from):
 *   Pros / users
 *     - phone starts with +2348011111      prisma/seed.ts demo pros (+2348011111101..108)
 *     - phone starts with +23499           scripts/deep-test.ts (+23499<stamp><n>)
 *     - phone starts with +234809999991    scripts/test-scheduler.ts (Kemi Abuja / Ada Test)
 *     - phone starts with +234800000       placeholder numbers (+2348000000000)
 *     - phone = +2348011112222             scripts/deep-test.ts OTP login test
 *     - name contains the word "test"      ad-hoc test accounts ("TEST Master 138172",
 *                                          "Vault Test Pro", "Ada Test", "test user")
 *     - a user linked to a demo pro, and a pro linked to a demo user
 *     - temp users: no phone (or legacy +234_email_*), no name, >24h old and
 *       owning nothing (same rule as scripts/gc-temp-users.ts)
 *   Services
 *     - slug or name contains the word "test" (scripts/test-scheduler.ts
 *       abuja-test-loosen / -wash / -reloc / -makeup)
 *   Bookings
 *     - customer or pro is demo, a service/extra is a test service,
 *       reference starts with TEST- (deep-test / test-scheduler), or delegated
 *       through a demo apprenticeship
 *   Everything hanging off those rows (payments, disputes, reviews, dispatch
 *   logs, strikes, items, health acks, earnings, wallet + ledger, savings,
 *   inventory, benefits, advances, payouts, schedules, apprenticeships,
 *   curriculum, favourites, profiles, subscriptions, gift cards, referrals,
 *   points, notes, audit logs about those entities, notifications to their
 *   phones), plus every EXPIRED OTP code and SMS/WhatsApp notification rows
 *   addressed to a malformed +234 number.
 *
 * Never deleted: ADMIN users, anyone with an admin role, phones/emails listed
 * in ADMIN_PHONES / ADMIN_EMAILS, cities, zones, zone travel, the real service
 * catalogue, settings, subscription plans, benefit plans, products, admin roles.
 *
 * Run it from the SAME commit that is deployed: it uses this checkout's
 * Prisma schema.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// ─── Markers ────────────────────────────────────────────────────────────────

const DEMO_PHONE_PREFIXES = [
  "+2348011111", // prisma/seed.ts demo pros
  "+23499", // scripts/deep-test.ts
  "+234809999991", // scripts/test-scheduler.ts
  "+234800000", // placeholder numbers
];
const DEMO_PHONES_EXACT = ["+2348011112222"]; // deep-test OTP login
const TEST_SERVICE_RE = /(^|[^a-z0-9])test([^a-z0-9]|$)/i;
const TEST_NAME_RE = /\btest\b/i;
const TEMP_USER_STALE_HOURS = 24;
const TEST_BOOKING_REF_PREFIX = "TEST-";

// ─── CLI ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const opt = (name: string) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const EXECUTE = flag("--execute");
const VERBOSE = flag("--verbose");
const PROD_OK = flag("--i-know-this-is-production");
const MONEY_OK = flag("--allow-real-money-impact");
const NAME_MARKERS = !flag("--no-name-markers");
const SAMPLE = VERBOSE ? 25 : 5;
const BACKUP_DIR = path.resolve(opt("backup-dir") ?? "backups");
const KEEP_PHONES = new Set(
  (opt("keep-phones") ?? process.env.PURGE_KEEP_PHONES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const KNOWN = new Set([
  "--execute",
  "--verbose",
  "--i-know-this-is-production",
  "--allow-real-money-impact",
  "--no-name-markers",
]);
for (const a of argv) {
  if (!KNOWN.has(a) && !/^--(keep-phones|backup-dir)=/.test(a)) {
    console.error(`Unknown argument: ${a}`);
    process.exit(2);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function dbTarget() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("DATABASE_URL is not set.");
    process.exit(2);
  }
  try {
    const u = new URL(raw);
    return { host: u.hostname, port: u.port || "5432", db: u.pathname.replace(/^\//, "") };
  } catch {
    console.error("DATABASE_URL is not a valid URL.");
    process.exit(2);
  }
}

const isDemoPhone = (p: string | null | undefined) =>
  !!p &&
  !KEEP_PHONES.has(p) &&
  (DEMO_PHONES_EXACT.includes(p) || DEMO_PHONE_PREFIXES.some((x) => p.startsWith(x)));

const hasTestName = (n: string | null | undefined) => NAME_MARKERS && !!n && TEST_NAME_RE.test(n);

const ids = <T extends { id: string }>(rows: T[]) => rows.map((r) => r.id);
const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

function chunks<T>(xs: T[], n = 5000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

function ask(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) =>
    rl.question(q, (a) => {
      rl.close();
      res(a.trim());
    }),
  );
}

type Tx = Prisma.TransactionClient | PrismaClient;

// ─── Plan ───────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
interface TablePlan {
  table: string; // DB table name, for humans
  rows: Row[];
  // Delete the rows. Default: by id.
  del: (tx: Tx) => Promise<number>;
}
interface Plan {
  tables: TablePlan[]; // in delete order (children first)
  nullified: { table: string; column: string; rows: Row[] }[]; // FK SET NULL side effects on kept rows
  moneyGuard: { realPaidBookings: Row[]; realPaidEarnings: Row[] };
  reasons: Record<string, Record<string, string[]>>; // table → id → reasons
  warnings: string[];
}

async function buildPlan(tx: Tx): Promise<Plan> {
  const warnings: string[] = [];
  const reasons: Plan["reasons"] = { users: {}, groomers: {}, services: {}, bookings: {} };
  const why = (t: string, id: string, r: string) => {
    (reasons[t][id] ??= []).includes(r) || reasons[t][id].push(r);
  };

  // ── Protected users ──
  const adminPhones = (process.env.ADMIN_PHONES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const allUsers = await tx.user.findMany({
    select: { id: true, phone: true, email: true, name: true, role: true, adminRoleId: true, createdAt: true },
  });
  const isProtected = (u: (typeof allUsers)[number]) =>
    u.role === "ADMIN" ||
    !!u.adminRoleId ||
    (!!u.phone && (adminPhones.includes(u.phone) || KEEP_PHONES.has(u.phone))) ||
    (!!u.email && adminEmails.includes(u.email.toLowerCase()));
  const protectedIds = new Set(allUsers.filter(isProtected).map((u) => u.id));

  // ── Demo pros + users (fixpoint over the user↔pro link) ──
  const allPros = await tx.pro.findMany({
    select: { id: true, phone: true, name: true, userId: true, currentBookingId: true },
  });
  const P = new Set<string>();
  const U = new Set<string>();
  for (const p of allPros) {
    if (KEEP_PHONES.has(p.phone)) continue;
    if (isDemoPhone(p.phone)) (P.add(p.id), why("groomers", p.id, "demo phone"));
    else if (hasTestName(p.name)) (P.add(p.id), why("groomers", p.id, "test name"));
  }
  for (const u of allUsers) {
    if (protectedIds.has(u.id)) continue;
    if (isDemoPhone(u.phone)) (U.add(u.id), why("users", u.id, "demo phone"));
    else if (hasTestName(u.name)) (U.add(u.id), why("users", u.id, "test name"));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of allPros) {
      if (!p.userId) continue;
      if (P.has(p.id) && !U.has(p.userId) && !protectedIds.has(p.userId)) {
        U.add(p.userId), why("users", p.userId, "linked to demo pro"), (changed = true);
      }
      if (U.has(p.userId) && !P.has(p.id) && !KEEP_PHONES.has(p.phone)) {
        P.add(p.id), why("groomers", p.id, "linked to demo user"), (changed = true);
      }
    }
  }
  for (const p of allPros) {
    if (P.has(p.id) && p.userId && protectedIds.has(p.userId)) {
      warnings.push(`Demo pro ${p.name} (${p.phone}) is linked to protected admin user ${p.userId}; the pro is deleted, the user is kept.`);
    }
  }

  // ── Temp users (gc-temp-users rule) ──
  const cutoff = new Date(Date.now() - TEMP_USER_STALE_HOURS * 3600 * 1000);
  const tempCandidates = await tx.user.findMany({
    where: {
      name: null,
      createdAt: { lt: cutoff },
      OR: [{ phone: null }, { phone: { startsWith: "+234_email_" } }],
    },
    select: {
      id: true,
      role: true,
      adminRoleId: true,
      phone: true,
      email: true,
      _count: {
        select: {
          bookings: true, favouritePros: true, subscriptions: true, giftCardsSent: true,
          referralsMade: true, activityLogs: true, notes: true, pointsLedger: true,
        },
      },
      pro: { select: { id: true } },
      beautyProfile: { select: { id: true } },
      healthProfile: { select: { id: true } },
    },
  });
  for (const u of tempCandidates) {
    if (protectedIds.has(u.id) || U.has(u.id)) continue;
    if (u.pro || u.beautyProfile || u.healthProfile) continue;
    if (Object.values(u._count).some((n) => n > 0)) continue;
    U.add(u.id), why("users", u.id, "stale temp user");
  }

  // ── Test services ──
  const allServices = await tx.service.findMany({ select: { id: true, slug: true, name: true } });
  const S = new Set<string>();
  for (const s of allServices) {
    if (TEST_SERVICE_RE.test(s.slug) || TEST_SERVICE_RE.test(s.name)) (S.add(s.id), why("services", s.id, "test slug/name"));
  }

  const Pa = [...P], Ua = [...U], Sa = [...S];

  // ── Apprenticeships touching a demo pro ──
  const apprenticeships = await tx.apprenticeship.findMany({
    where: { OR: [{ apprenticeId: { in: Pa } }, { masterId: { in: Pa } }] },
  });
  const Aa = ids(apprenticeships);

  // ── Bookings ──
  const itemBookingIds = uniq(
    (await tx.bookingItem.findMany({ where: { serviceId: { in: Sa } }, select: { bookingId: true } })).map((r) => r.bookingId),
  );
  const bookings = await tx.booking.findMany({
    where: {
      OR: [
        { customerId: { in: Ua } },
        { proId: { in: Pa } },
        { serviceId: { in: Sa } },
        { id: { in: itemBookingIds } },
        { reference: { startsWith: TEST_BOOKING_REF_PREFIX } },
        { delegatedApprenticeshipId: { in: Aa } },
      ],
    },
    include: { payment: true },
  });
  for (const b of bookings) {
    if (U.has(b.customerId)) why("bookings", b.id, "demo customer");
    if (b.proId && P.has(b.proId)) why("bookings", b.id, "demo pro");
    if (S.has(b.serviceId) || itemBookingIds.includes(b.id)) why("bookings", b.id, "test service");
    if (b.reference.startsWith(TEST_BOOKING_REF_PREFIX)) why("bookings", b.id, "TEST- reference");
    if (b.delegatedApprenticeshipId && Aa.includes(b.delegatedApprenticeshipId)) why("bookings", b.id, "demo apprenticeship");
  }
  const Ba = ids(bookings);
  const B = new Set(Ba);

  // Money guard: a booking paid by a REAL customer (not demo, not staff).
  const realPaidBookings = bookings
    .filter(
      (b) =>
        !U.has(b.customerId) &&
        !protectedIds.has(b.customerId) &&
        b.payment &&
        ["AUTHORISED", "CAPTURED", "REFUNDED"].includes(b.payment.status),
    )
    .map((b) => ({ id: b.id, reference: b.reference, customerId: b.customerId, proId: b.proId, total: b.totalAmount, payment: b.payment?.status, paystackRef: b.payment?.paystackRef }));

  // ── Booking children ──
  const T: TablePlan[] = [];
  const byId = (model: { deleteMany: (a: { where: { id: { in: string[] } } }) => Prisma.PrismaPromise<Prisma.BatchPayload> }, rows: Row[]) =>
    async () => {
      let n = 0;
      for (const c of chunks(rows.map((r) => r.id as string))) n += (await model.deleteMany({ where: { id: { in: c } } })).count;
      return n;
    };
  const add = (table: string, rows: Row[], del: (tx: Tx) => Promise<number>) => T.push({ table, rows, del });

  const bookingItems = await tx.bookingItem.findMany({ where: { OR: [{ bookingId: { in: Ba } }, { serviceId: { in: Sa } }] } });
  add("booking_items", bookingItems, (t) => byId(t.bookingItem, bookingItems)());
  const payments = await tx.payment.findMany({ where: { bookingId: { in: Ba } } });
  add("payments", payments, (t) => byId(t.payment, payments)());
  const disputes = await tx.dispute.findMany({ where: { bookingId: { in: Ba } } });
  add("disputes", disputes, (t) => byId(t.dispute, disputes)());
  const reviews = await tx.review.findMany({ where: { bookingId: { in: Ba } } });
  add("reviews", reviews, (t) => byId(t.review, reviews)());
  const dispatchLogs = await tx.dispatchLog.findMany({ where: { OR: [{ bookingId: { in: Ba } }, { proId: { in: Pa } }] } });
  add("dispatch_logs", dispatchLogs, (t) => byId(t.dispatchLog, dispatchLogs)());
  const strikes = await tx.strike.findMany({ where: { OR: [{ bookingId: { in: Ba } }, { proId: { in: Pa } }] } });
  add("strikes", strikes, (t) => byId(t.strike, strikes)());

  // Health profiles of demo users (acks hang off both booking and profile).
  const healthProfiles = await tx.healthProfile.findMany({ where: { userId: { in: Ua } } });
  const Ha = ids(healthProfiles);
  const healthAcks = await tx.healthAcknowledgment.findMany({
    where: { OR: [{ bookingId: { in: Ba } }, { proId: { in: Pa } }, { profileId: { in: Ha } }] },
  });
  add("health_acknowledgments", healthAcks, (t) => byId(t.healthAcknowledgment, healthAcks)());

  // ── Earnings ──
  const earnings = await tx.earning.findMany({
    where: {
      OR: [{ proId: { in: Pa } }, { bookingId: { in: Ba } }, { sourceProId: { in: Pa } }, { apprenticeshipId: { in: Aa } }],
    },
  });
  const realPaidEarnings = earnings
    .filter((e) => !P.has(e.proId) && e.paid)
    .map((e) => ({ id: e.id, proId: e.proId, bookingId: e.bookingId, amount: e.amount, type: e.type, payoutId: e.payoutId }));
  add("earnings", earnings, (t) => byId(t.earning, earnings)());

  // ── Pro-owned financial / ops tables ──
  const walletLedger = await tx.walletLedger.findMany({ where: { proId: { in: Pa } } });
  add("wallet_ledger", walletLedger, (t) => byId(t.walletLedger, walletLedger)());
  const savingsMovements = await tx.savingsMovement.findMany({ where: { proId: { in: Pa } } });
  add("savings_movements", savingsMovements, (t) => byId(t.savingsMovement, savingsMovements)());
  const savingsWithdrawals = await tx.savingsWithdrawal.findMany({ where: { proId: { in: Pa } } });
  add("savings_withdrawals", savingsWithdrawals, (t) => byId(t.savingsWithdrawal, savingsWithdrawals)());
  const savingsAccounts = await tx.proSavingsAccount.findMany({ where: { proId: { in: Pa } } });
  add("pro_savings_accounts", savingsAccounts, (t) => byId(t.proSavingsAccount, savingsAccounts)());
  const inventoryTxns = await tx.inventoryTxn.findMany({ where: { proId: { in: Pa } } });
  add("inventory_txns", inventoryTxns, (t) => byId(t.inventoryTxn, inventoryTxns)());
  const inventories = await tx.proInventory.findMany({ where: { proId: { in: Pa } } });
  add("pro_inventories", inventories, (t) => byId(t.proInventory, inventories)());
  const benefitDebits = await tx.benefitDebit.findMany({ where: { proId: { in: Pa } } });
  add("benefit_debits", benefitDebits, (t) => byId(t.benefitDebit, benefitDebits)());
  const benefitClaims = await tx.benefitClaim.findMany({ where: { proId: { in: Pa } } });
  add("benefit_claims", benefitClaims, (t) => byId(t.benefitClaim, benefitClaims)());
  const enrollments = await tx.proBenefitEnrollment.findMany({ where: { proId: { in: Pa } } });
  add("pro_benefit_enrollments", enrollments, (t) => byId(t.proBenefitEnrollment, enrollments)());
  const wallets = await tx.proWallet.findMany({ where: { proId: { in: Pa } } });
  add("pro_wallets", wallets, (t) => byId(t.proWallet, wallets)());
  const advances = await tx.proAdvance.findMany({ where: { proId: { in: Pa } } });
  add("pro_advances", advances, (t) => byId(t.proAdvance, advances)());
  const creditEvents = await tx.proCreditEvent.findMany({ where: { proId: { in: Pa } } });
  add("pro_credit_events", creditEvents, (t) => byId(t.proCreditEvent, creditEvents)());
  const payouts = await tx.payout.findMany({ where: { proId: { in: Pa } } });
  add("payouts", payouts, (t) => byId(t.payout, payouts)());
  const schedules = await tx.proSchedule.findMany({ where: { proId: { in: Pa } } });
  add("pro_schedules", schedules, (t) => byId(t.proSchedule, schedules)());

  const proServiceWhere = { OR: [{ proId: { in: Pa } }, { serviceId: { in: Sa } }] };
  const proServices = await tx.proService.findMany({ where: proServiceWhere });
  add("groomer_services", proServices, async (t) => (await t.proService.deleteMany({ where: proServiceWhere })).count);
  const proZoneWhere = { proId: { in: Pa } };
  const proZones = await tx.proZone.findMany({ where: proZoneWhere });
  add("groomer_zones", proZones, async (t) => (await t.proZone.deleteMany({ where: proZoneWhere })).count);
  const favourites = await tx.favouritePro.findMany({ where: { OR: [{ proId: { in: Pa } }, { userId: { in: Ua } }] } });
  add("favourite_pros", favourites, (t) => byId(t.favouritePro, favourites)());

  // ── Apprenticeships ──
  const modules = await tx.curriculumModule.findMany({ where: { apprenticeshipId: { in: Aa } } });
  add("curriculum_modules", modules, (t) => byId(t.curriculumModule, modules)());
  add("apprenticeships", apprenticeships, (t) => byId(t.apprenticeship, apprenticeships)());

  // ── Bookings ──
  add("bookings", bookings.map(({ payment: _p, ...b }) => b), (t) => byId(t.booking, bookings)());

  // ── Pros ──
  const proRows = await tx.pro.findMany({ where: { id: { in: Pa } } });
  add("groomers", proRows, (t) => byId(t.pro, proRows)());

  // ── User-owned tables ──
  const healthConditions = await tx.healthCondition.findMany({ where: { profileId: { in: Ha } } });
  add("health_conditions", healthConditions, (t) => byId(t.healthCondition, healthConditions)());
  const healthAccess = await tx.healthAccessLog.findMany({ where: { profileId: { in: Ha } } });
  add("health_access_logs", healthAccess, (t) => byId(t.healthAccessLog, healthAccess)());
  add("health_profiles", healthProfiles, (t) => byId(t.healthProfile, healthProfiles)());

  const subscriptions = await tx.subscription.findMany({ where: { userId: { in: Ua } } });
  const subUsages = await tx.subscriptionUsage.findMany({ where: { subscriptionId: { in: ids(subscriptions) } } });
  add("subscription_usages", subUsages, (t) => byId(t.subscriptionUsage, subUsages)());
  add("subscriptions", subscriptions, (t) => byId(t.subscription, subscriptions)());
  const giftCards = await tx.giftCard.findMany({ where: { senderId: { in: Ua } } });
  add("gift_cards", giftCards, (t) => byId(t.giftCard, giftCards)());
  const referrals = await tx.referral.findMany({ where: { referrerId: { in: Ua } } });
  add("referrals", referrals, (t) => byId(t.referral, referrals)());
  const points = await tx.pointsLedger.findMany({ where: { userId: { in: Ua } } });
  add("points_ledger", points, (t) => byId(t.pointsLedger, points)());
  const beautyProfiles = await tx.beautyProfile.findMany({ where: { userId: { in: Ua } } });
  add("beauty_profiles", beautyProfiles, (t) => byId(t.beautyProfile, beautyProfiles)());

  // Notes / audit logs written about (or by) the deleted entities.
  const entityIds = [...Ua, ...Pa, ...Ba, ...Sa, ...Aa];
  const notes = await tx.note.findMany({ where: { OR: [{ authorId: { in: Ua } }, { entityId: { in: entityIds } }] } });
  add("notes", notes, (t) => byId(t.note, notes)());
  const activity = await tx.activityLog.findMany({ where: { OR: [{ adminId: { in: Ua } }, { entityId: { in: entityIds } }] } });
  add("activity_logs", activity, (t) => byId(t.activityLog, activity)());

  // ── Test services ──
  const contraindications = await tx.serviceContraindication.findMany({ where: { serviceId: { in: Sa } } });
  add("service_contraindications", contraindications, (t) => byId(t.serviceContraindication, contraindications)());
  const recipes = await tx.serviceRecipe.findMany({ where: { serviceId: { in: Sa } } });
  add("service_recipes", recipes, (t) => byId(t.serviceRecipe, recipes)());
  const serviceRows = await tx.service.findMany({ where: { id: { in: Sa } } });
  add("services", serviceRows, (t) => byId(t.service, serviceRows)());

  // ── Users ──
  const userRows = await tx.user.findMany({ where: { id: { in: Ua } } });
  add("users", userRows, (t) => byId(t.user, userRows)());

  // ── Rows keyed by phone (no FK) ──
  const demoPhones = uniq([
    ...allUsers.filter((u) => U.has(u.id)).map((u) => u.phone),
    ...allPros.filter((p) => P.has(p.id)).map((p) => p.phone),
  ]).filter((p) => !KEEP_PHONES.has(p));
  const phoneOr = (field: string) => [
    { [field]: { in: demoPhones } },
    ...DEMO_PHONE_PREFIXES.map((x) => ({ [field]: { startsWith: x } })),
    { [field]: { in: DEMO_PHONES_EXACT } },
  ];
  // Also: SMS/WhatsApp notifications to a malformed +234 number (test scripts
  // that built phones like "+234802ovk2q2s"); real numbers are +234 + 10 digits.
  const notifications = (
    await tx.notification.findMany({
      where: {
        OR: [
          ...phoneOr("recipient"),
          { AND: [{ recipient: { startsWith: "+234" } }, { channel: { in: ["whatsapp", "sms"] } }] },
        ],
      },
    })
  ).filter(
    (n) =>
      !KEEP_PHONES.has(n.recipient) &&
      (isDemoPhone(n.recipient) || demoPhones.includes(n.recipient) || !/^\+234\d{10}$/.test(n.recipient)),
  );
  add("notifications", notifications, (t) => byId(t.notification, notifications)());
  const otps = (
    await tx.otpCode.findMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, ...phoneOr("phone")] } })
  ).filter((o) => o.expiresAt < new Date() || !KEEP_PHONES.has(o.phone));
  add("OtpCode", otps, (t) => byId(t.otpCode, otps)());
  const surveys = (await tx.surveyResponse.findMany({ where: { OR: phoneOr("phone") } })).filter((s) => !KEEP_PHONES.has(s.phone ?? ""));
  add("survey_responses", surveys, (t) => byId(t.surveyResponse, surveys)());
  const waitlist = (await tx.waitlist.findMany({ where: { OR: phoneOr("phone") } })).filter((w) => !KEEP_PHONES.has(w.phone ?? ""));
  add("waitlist", waitlist, (t) => byId(t.waitlist, waitlist)());

  // ── SET NULL side effects on rows we KEEP ──
  const nullified: Plan["nullified"] = [];
  const keptPros = await tx.pro.findMany({
    where: {
      id: { notIn: Pa },
      OR: [{ parentProId: { in: Pa } }, { freedUnderProId: { in: Pa } }, { currentBookingId: { in: Ba } }],
    },
    select: { id: true, name: true, phone: true, parentProId: true, freedUnderProId: true, currentBookingId: true },
  });
  if (keptPros.length) nullified.push({ table: "groomers", column: "parentProId/freedUnderProId/currentBookingId", rows: keptPros });
  const keptGifts = await tx.giftCard.findMany({ where: { senderId: { notIn: Ua }, redeemedBy: { in: Ua } }, select: { id: true, redeemedBy: true } });
  if (keptGifts.length) nullified.push({ table: "gift_cards", column: "redeemedBy", rows: keptGifts });
  const keptRefs = await tx.referral.findMany({ where: { referrerId: { notIn: Ua }, referredUserId: { in: Ua } }, select: { id: true, referredUserId: true } });
  if (keptRefs.length) nullified.push({ table: "referrals", column: "referredUserId", rows: keptRefs });

  // Real pros' ledgers that reference a deleted booking (no FK, left as-is).
  const realLedgerRefs = await tx.walletLedger.count({ where: { proId: { notIn: Pa }, bookingId: { in: Ba } } });
  if (realLedgerRefs)
    warnings.push(`${realLedgerRefs} wallet_ledger row(s) of KEPT pros reference deleted bookings. They are left untouched (ledger history); review balances afterwards.`);
  const realSavingsRefs = await tx.savingsMovement.count({ where: { proId: { notIn: Pa }, bookingId: { in: Ba } } });
  if (realSavingsRefs) warnings.push(`${realSavingsRefs} savings_movements row(s) of KEPT pros reference deleted bookings; left untouched.`);
  const realInvRefs = await tx.inventoryTxn.count({ where: { proId: { notIn: Pa }, bookingId: { in: Ba } } });
  if (realInvRefs) warnings.push(`${realInvRefs} inventory_txns row(s) of KEPT pros reference deleted bookings; left untouched.`);
  const keptRealProsOnDemoBookings = uniq(bookings.map((b) => b.proId)).filter((p) => !P.has(p));
  if (keptRealProsOnDemoBookings.length)
    warnings.push(`${keptRealProsOnDemoBookings.length} KEPT pro(s) served deleted demo bookings; their cached totalJobs/avgRating/reviewCount are not recomputed.`);

  // Sanity: everything in B is covered by a reason.
  void B;

  return { tables: T, nullified, moneyGuard: { realPaidBookings, realPaidEarnings }, reasons, warnings };
}

// ─── Reporting ──────────────────────────────────────────────────────────────

function summarise(r: Row): string {
  const pick = ["phone", "name", "email", "role", "reference", "status", "slug", "type", "amount", "recipient", "expiresAt"];
  const parts: string[] = [`id=${r.id ?? `${r.proId ?? ""}/${r.serviceId ?? r.zoneId ?? ""}`}`];
  for (const k of pick) if (r[k] !== undefined && r[k] !== null) parts.push(`${k}=${r[k] instanceof Date ? (r[k] as Date).toISOString() : String(r[k])}`);
  return parts.join("  ");
}

async function tableTotals(db: PrismaClient): Promise<Record<string, number>> {
  const rows = await db.$queryRaw<{ relname: string; n: bigint }[]>`
    SELECT c.relname, (xpath('/row/cnt/text()', query_to_xml(format('select count(*) as cnt from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint AS n
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = current_schema()`;
  return Object.fromEntries(rows.map((r) => [r.relname, Number(r.n)]));
}

function printPlan(plan: Plan, totals: Record<string, number>) {
  console.log("\nPer-table rows that WOULD be deleted (of current total):\n");
  let sum = 0;
  for (const t of plan.tables) {
    sum += t.rows.length;
    const total = totals[t.table] ?? "?";
    console.log(`  ${t.table.padEnd(28)} ${String(t.rows.length).padStart(6)}  / ${total}`);
  }
  console.log(`  ${"TOTAL".padEnd(28)} ${String(sum).padStart(6)}`);

  console.log("\nSample rows:");
  for (const t of plan.tables) {
    if (!t.rows.length) continue;
    console.log(`\n  [${t.table}]`);
    for (const r of t.rows.slice(0, SAMPLE)) {
      const rs = plan.reasons[t.table]?.[r.id as string];
      console.log(`    ${summarise(r)}${rs ? `   <- ${rs.join(", ")}` : ""}`);
    }
    if (t.rows.length > SAMPLE) console.log(`    ... and ${t.rows.length - SAMPLE} more`);
  }

  if (plan.nullified.length) {
    console.log("\nKEPT rows whose link to a deleted row will be set to NULL:");
    for (const n of plan.nullified) console.log(`  ${n.table}.${n.column}: ${n.rows.length} row(s)`);
  }
  if (plan.warnings.length) {
    console.log("\nWarnings:");
    for (const w of plan.warnings) console.log(`  ! ${w}`);
  }
  const { realPaidBookings, realPaidEarnings } = plan.moneyGuard;
  if (realPaidBookings.length || realPaidEarnings.length) {
    console.log("\nREAL-MONEY GUARD:");
    console.log(`  ${realPaidBookings.length} booking(s) paid by a NON-demo customer would be deleted (they booked a demo pro / test service):`);
    for (const b of realPaidBookings.slice(0, 25)) console.log(`    ${JSON.stringify(b)}`);
    console.log(`  ${realPaidEarnings.length} PAID earning(s) of NON-demo pros would be deleted:`);
    for (const e of realPaidEarnings.slice(0, 25)) console.log(`    ${JSON.stringify(e)}`);
    console.log("  Refund/reconcile these in Paystack first, then re-run with --allow-real-money-impact (or --keep-phones=...).");
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const target = dbTarget();
  const isProdEnv = process.env.NODE_ENV === "production";
  const banner = "=".repeat(72);
  console.log(banner);
  console.log(`  GROOMEE DEMO-DATA PURGE   mode: ${EXECUTE ? "EXECUTE (will delete)" : "DRY RUN (no changes)"}`);
  console.log(`  TARGET DB HOST: ${target.host}   port: ${target.port}   database: ${target.db}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV ?? "(unset)"}   name markers: ${NAME_MARKERS ? "on" : "off"}   keep-phones: ${KEEP_PHONES.size}`);
  console.log(banner);

  if (isProdEnv && !PROD_OK) {
    console.error("\nRefusing to run: NODE_ENV=production. Re-run with --i-know-this-is-production if you really mean it.");
    process.exit(3);
  }

  const db = new PrismaClient();
  try {
    const totals = await tableTotals(db);

    if (!EXECUTE) {
      const plan = await buildPlan(db);
      printPlan(plan, totals);
      console.log("\nDRY RUN complete. Nothing was changed. Re-run with --execute to delete.");
      return;
    }

    // ── Confirmation ──
    const envConfirm = process.env.CONFIRM_DB_HOST;
    if (envConfirm !== undefined) {
      if (envConfirm !== target.host) {
        console.error(`\nCONFIRM_DB_HOST="${envConfirm}" does not match target host "${target.host}". Aborting.`);
        process.exit(4);
      }
    } else {
      if (!process.stdin.isTTY) {
        console.error("\nNo TTY to confirm on. Set CONFIRM_DB_HOST=<host> to run non-interactively. Aborting.");
        process.exit(4);
      }
      const typed = await ask(`\nType the database host to confirm deletion (${target.host}): `);
      if (typed !== target.host) {
        console.error("Host did not match. Aborting; nothing changed.");
        process.exit(4);
      }
    }

    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `purge-demo-${target.host}-${target.db}-${stamp}.json`);

    const result = await db.$transaction(
      async (tx) => {
        // Re-plan inside the transaction so we delete exactly what we back up.
        const plan = await buildPlan(tx);
        printPlan(plan, totals);
        const { realPaidBookings, realPaidEarnings } = plan.moneyGuard;
        if ((realPaidBookings.length || realPaidEarnings.length) && !MONEY_OK) {
          throw new Error("REAL-MONEY GUARD tripped (see above). Nothing deleted. Use --allow-real-money-impact after reconciling.");
        }

        const backup = {
          createdAt: new Date().toISOString(),
          target,
          args: argv,
          note: "Every row deleted by scripts/purge-demo-data.ts, plus kept rows whose FK was SET NULL (before values).",
          deleted: Object.fromEntries(plan.tables.map((t) => [t.table, t.rows])),
          nullified: plan.nullified,
          reasons: plan.reasons,
          warnings: plan.warnings,
        };
        const fd = fs.openSync(backupPath, "w");
        fs.writeSync(fd, JSON.stringify(backup, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        console.log(`\nBackup written: ${backupPath}`);

        // Kept pros pointing at a deleted booking: clear the dangling pointer.
        const Ba = plan.tables.find((t) => t.table === "bookings")!.rows.map((r) => r.id as string);
        if (Ba.length) await tx.pro.updateMany({ where: { currentBookingId: { in: Ba } }, data: { currentBookingId: null } });

        const deleted: Record<string, number> = {};
        for (const t of plan.tables) {
          if (!t.rows.length) continue;
          deleted[t.table] = await t.del(tx);
        }
        return deleted;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: 300_000 },
    );

    const after = await tableTotals(db);
    console.log("\nDeleted (statement counts; FK cascades may remove the same rows earlier):");
    for (const [k, v] of Object.entries(result)) console.log(`  ${k.padEnd(28)} ${String(v).padStart(6)}`);
    console.log("\nTable totals before -> after:");
    for (const k of Object.keys(totals).sort()) {
      if (totals[k] !== after[k]) console.log(`  ${k.padEnd(28)} ${String(totals[k]).padStart(6)} -> ${after[k]}`);
    }
    console.log(`\nDone. Committed. Backup: ${backupPath}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\nFAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
