/**
 * Deep test of every Groomee feature.
 *
 *   npm run test:deep
 *
 * Sections:
 *   A — Page reachability (customer, partner, admin)
 *   B — API contract (auth/public/admin/partner)
 *   C — Apprenticeship full lifecycle E2E
 *   D — Booking + money lifecycle E2E
 *   E — Refund / clawback parity
 *   F — Admin override actions
 *   G — Edge cases & gating
 *   H — DB integrity audit
 *
 * Generates fixtures inline, exercises them via HTTP + Prisma, asserts
 * invariants, cleans up. Prints a section-by-section table at the end
 * with PASS/FAIL counts and exits non-zero if anything failed.
 */

import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { reverseEarningsForBooking } from "../src/lib/earnings-reversal";
import "../src/lib/env";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_DURATION = parseInt(process.env.SESSION_DURATION ?? "2592000");
const COOKIE_NAME = "groomee_session";

if (!JWT_SECRET) {
  console.error("JWT_SECRET missing");
  process.exit(1);
}

const db = new PrismaClient();
const secret = new TextEncoder().encode(JWT_SECRET);

type Outcome = { name: string; status: "PASS" | "FAIL" | "SKIP"; detail?: string; ms?: number };
const results: Record<string, Outcome[]> = {};

function record(section: string, outcome: Outcome) {
  if (!results[section]) results[section] = [];
  results[section].push(outcome);
  const icon = outcome.status === "PASS" ? "✓" : outcome.status === "SKIP" ? "·" : "✗";
  const ms = outcome.ms !== undefined ? `${String(outcome.ms).padStart(4)}ms ` : "       ";
  console.log(`  ${icon} ${ms}${outcome.name}${outcome.detail ? `  — ${outcome.detail}` : ""}`);
}

async function check(
  section: string,
  name: string,
  fn: () => Promise<{ ok: boolean; detail?: string }>,
): Promise<boolean> {
  const t0 = Date.now();
  try {
    const r = await fn();
    record(section, { name, status: r.ok ? "PASS" : "FAIL", detail: r.detail, ms: Date.now() - t0 });
    return r.ok;
  } catch (err: any) {
    record(section, { name, status: "FAIL", detail: `threw: ${err.message}`, ms: Date.now() - t0 });
    return false;
  }
}

async function signSessionFor(user: {
  id: string;
  phone: string | null;
  role: "ADMIN" | "PRO" | "CUSTOMER";
  adminRoleId?: string | null;
  adminRoleName?: string | null;
  permissions?: string[];
}) {
  return new SignJWT({
    userId: user.id,
    phone: user.phone,
    role: user.role,
    ...(user.adminRoleId ? { adminRoleId: user.adminRoleId } : {}),
    ...(user.adminRoleName ? { adminRoleName: user.adminRoleName } : {}),
    ...(user.permissions ? { permissions: user.permissions } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(secret);
}

async function http(
  path: string,
  opts: { method?: string; cookie?: string; body?: unknown } = {},
) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  let data: any = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// ─── FIXTURE SETUP ───────────────────────────────────────────────────────────

interface Fixtures {
  adminCookie: string;
  admin: { id: string; phone: string };
  masterUser: { id: string; phone: string };
  masterPro: { id: string; name: string };
  masterCookie: string;
  apprenticeUser: { id: string; phone: string };
  apprenticePro: { id: string; name: string };
  setApprenticePro?: (p: { id: string; name: string }) => void;
  apprenticeCookie: string;
  customerUser: { id: string; phone: string };
  customerCookie: string;
  service: { id: string; name: string; basePrice: number };
  zone: { id: string; name: string };
  cleanup: () => Promise<void>;
}

async function setupFixtures(): Promise<Fixtures> {
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    include: { adminRole: true },
  });
  if (!admin) throw new Error("No ADMIN user in DB — seed first.");
  const adminToken = await signSessionFor({
    id: admin.id,
    phone: admin.phone,
    role: "ADMIN",
    adminRoleId: admin.adminRole?.id,
    adminRoleName: admin.adminRole?.name,
    permissions: admin.adminRole?.permissions ?? ["*"],
  });

  const service = await db.service.findFirst({ where: { isActive: true } });
  if (!service) throw new Error("No active service — seed first.");
  const zone = await db.zone.findFirst();
  if (!zone) throw new Error("No zones seeded.");

  const stamp = Date.now().toString().slice(-7);
  const masterUser = await db.user.create({
    data: { phone: `+23499${stamp}1`, role: "PRO", name: "Test Master" },
  });
  const masterPro = await db.pro.create({
    data: {
      userId: masterUser.id,
      phone: masterUser.phone!,
      name: "Test Master",
      status: "ACTIVE",
      availability: "ONLINE",
      services: { create: { serviceId: service.id } },
      zones: { create: { zoneId: zone.id } },
    },
  });
  const masterToken = await signSessionFor({
    id: masterUser.id,
    phone: masterUser.phone,
    role: "PRO",
  });

  // Apprentice is intentionally NOT a Pro yet — the invitation flow creates
  // their Pro record. Once C accepts the invitation we backfill apprenticePro.
  const apprenticeUser = await db.user.create({
    data: { phone: `+23499${stamp}2`, role: "CUSTOMER", name: "Test Apprentice" },
  });
  let apprenticePro: { id: string; name: string } | null = null;
  const apprenticeToken = await signSessionFor({
    id: apprenticeUser.id,
    phone: apprenticeUser.phone,
    role: "CUSTOMER",
  });

  const customerUser = await db.user.create({
    data: { phone: `+23499${stamp}3`, role: "CUSTOMER", name: "Test Customer" },
  });
  const customerToken = await signSessionFor({
    id: customerUser.id,
    phone: customerUser.phone,
    role: "CUSTOMER",
  });

  const cleanup = async () => {
    const proIds = [masterPro.id, apprenticePro?.id].filter((x): x is string => !!x);
    // Wipe in dependency-safe order.
    await db.earning.deleteMany({ where: { proId: { in: proIds } } });
    await db.notification.deleteMany({
      where: { recipient: { in: [masterUser.phone!, apprenticeUser.phone!, customerUser.phone!] } },
    });
    await db.payment.deleteMany({
      where: { booking: { customerId: customerUser.id } },
    });
    await db.booking.deleteMany({ where: { customerId: customerUser.id } });
    await db.curriculumModule.deleteMany({
      where: { apprenticeship: { OR: [{ masterId: masterPro.id }, { apprenticeId: { in: proIds } }] } },
    });
    await db.apprenticeship.deleteMany({
      where: { OR: [{ masterId: masterPro.id }, { apprenticeId: { in: proIds } }] },
    });
    await db.proService.deleteMany({ where: { proId: { in: proIds } } });
    await db.proZone.deleteMany({ where: { proId: { in: proIds } } });
    await db.activityLog.deleteMany({
      where: { entityType: "apprenticeship", entityId: { startsWith: "fixt_" } },
    });
    await db.pro.deleteMany({ where: { id: { in: proIds } } });
    await db.user.deleteMany({
      where: { id: { in: [masterUser.id, apprenticeUser.id, customerUser.id] } },
    });
  };

  return {
    adminCookie: `${COOKIE_NAME}=${adminToken}`,
    admin: { id: admin.id, phone: admin.phone! },
    masterUser: { id: masterUser.id, phone: masterUser.phone! },
    masterPro: { id: masterPro.id, name: masterPro.name },
    masterCookie: `${COOKIE_NAME}=${masterToken}`,
    apprenticeUser: { id: apprenticeUser.id, phone: apprenticeUser.phone! },
    get apprenticePro() {
      if (!apprenticePro) throw new Error("apprenticePro not initialised — invite/accept must run first");
      return apprenticePro;
    },
    setApprenticePro(p: { id: string; name: string }) { apprenticePro = p; },
    apprenticeCookie: `${COOKIE_NAME}=${apprenticeToken}`,
    customerUser: { id: customerUser.id, phone: customerUser.phone! },
    customerCookie: `${COOKIE_NAME}=${customerToken}`,
    service: { id: service.id, name: service.name, basePrice: service.basePrice },
    zone: { id: zone.id, name: zone.name },
    cleanup,
  } as Fixtures & { setApprenticePro: (p: { id: string; name: string }) => void };
}

// ─── SECTION A — PAGE REACHABILITY ───────────────────────────────────────────

async function runPageReachability(f: Fixtures) {
  console.log("\nA — Page reachability");
  // Customer pages — most are public.
  const customerPages = [
    "/",
    "/auth",
    "/search",
    "/install",
    "/gift",
    "/subscriptions",
    "/bookings",
    "/profile",
    "/profile/edit",
    "/profile/beauty",
    "/profile/points",
    "/profile/squad",
  ];
  for (const p of customerPages) {
    await check("A", `page ${p}`, async () => {
      const { status } = await http(p, { cookie: f.customerCookie });
      return { ok: status === 200 || status === 307, detail: `status=${status}` };
    });
  }

  // Public cert page (Slice 6) — should 404 for a missing code (acceptable).
  await check("A", "page /cert/MISSING (expect 404)", async () => {
    const { status } = await http("/cert/MISSING-CODE-AAAA");
    return { ok: status === 404, detail: `status=${status}` };
  });

  // Partner pages — master cookie.
  for (const p of [
    "/partner",
    "/partner/bookings",
    "/partner/earnings",
    "/partner/profile",
    "/partner/schedule",
    "/partner/growth",
    "/partner/calendar",
    "/partner/team",
    "/partner/team/invite",
    "/partner/team/invitations",
  ]) {
    await check("A", `page ${p}`, async () => {
      const { status } = await http(p, { cookie: f.masterCookie });
      return { ok: status === 200, detail: `status=${status}` };
    });
  }

  // Admin pages — admin cookie.
  for (const p of [
    "/admin",
    "/admin/bookings",
    "/admin/calendar",
    "/admin/pros",
    "/admin/pros/new",
    "/admin/apprenticeships",
    "/admin/customers",
    "/admin/disputes",
    "/admin/advances",
    "/admin/payouts",
    "/admin/subscriptions",
    "/admin/catalog",
    "/admin/surveys",
    "/admin/waitlist",
    "/admin/analytics",
    "/admin/team",
    "/admin/settings",
    "/admin/settings/travel-times",
  ]) {
    await check("A", `page ${p}`, async () => {
      const { status } = await http(p, { cookie: f.adminCookie });
      return { ok: status === 200, detail: `status=${status}` };
    });
  }
}

// ─── SECTION B — API CONTRACT ────────────────────────────────────────────────

async function runApiContract(f: Fixtures) {
  console.log("\nB — API contract");

  // Public
  for (const p of ["/api/services", "/api/zones", "/api/pros"]) {
    await check("B", `GET ${p}`, async () => {
      const { status } = await http(p);
      return { ok: status === 200, detail: `status=${status}` };
    });
  }
  // /api/health is currently auth-protected (returns 401 without admin cookie).
  // Confirm it responds at all to admin so we know it's wired.
  await check("B", "GET /api/health (admin)", async () => {
    const { status } = await http("/api/health", { cookie: f.adminCookie });
    return { ok: status === 200, detail: `status=${status}` };
  });

  // Auth-required (customer)
  for (const p of [
    "/api/auth/me",
    "/api/profile/squad",
    "/api/profile/points",
    "/api/profile/referral",
  ]) {
    await check("B", `GET ${p} (customer)`, async () => {
      const { status } = await http(p, { cookie: f.customerCookie });
      return { ok: status === 200, detail: `status=${status}` };
    });
  }

  // Auth-required (partner)
  for (const p of [
    "/api/partner/dashboard",
    "/api/partner/profile",
    "/api/partner/bookings",
    "/api/partner/earnings",
    "/api/partner/schedule",
    "/api/partner/calendar",
  ]) {
    await check("B", `GET ${p} (partner)`, async () => {
      const { status } = await http(p, { cookie: f.masterCookie });
      return { ok: status === 200, detail: `status=${status}` };
    });
  }

  // Admin
  for (const p of [
    "/api/admin/settings",
    "/api/admin/zones",
    "/api/admin/bookings",
    "/api/admin/disputes",
    "/api/admin/roles",
    "/api/admin/team",
    "/api/admin/payouts",
    "/api/admin/payouts/history",
    "/api/admin/stats",
    "/api/admin/pros/list",
    "/api/admin/apprenticeships",
    "/api/admin/advances",
    "/api/admin/subscriptions",
    "/api/admin/activity",
    "/api/admin/travel-times",
  ]) {
    await check("B", `GET ${p} (admin)`, async () => {
      const { status } = await http(p, { cookie: f.adminCookie });
      return { ok: status === 200, detail: `status=${status}` };
    });
  }

  // Auth gating — admin endpoint with customer cookie → 403/401.
  await check("B", "GET /api/admin/stats (customer cookie) → 403/401", async () => {
    const { status } = await http("/api/admin/stats", { cookie: f.customerCookie });
    return { ok: status === 403 || status === 401, detail: `status=${status}` };
  });

  // Unauthorised — no cookie → 401 or redirect.
  await check("B", "GET /api/admin/stats (no cookie) → 401/403", async () => {
    const { status } = await http("/api/admin/stats");
    return { ok: status === 401 || status === 403, detail: `status=${status}` };
  });
}

// ─── SECTION C — APPRENTICESHIP LIFECYCLE ────────────────────────────────────

async function runApprenticeshipE2E(f: Fixtures) {
  console.log("\nC — Apprenticeship lifecycle");

  // 1. Invite — master invites apprentice.
  let apprenticeshipId = "";
  const ok1 = await check("C", "master invites apprentice", async () => {
    const { status, data } = await http("/api/partner/apprentices/invite", {
      method: "POST",
      cookie: f.masterCookie,
      body: {
        phone: f.apprenticeUser.phone,
        masterCommission: 0.30,
        notes: "Deep test invitation",
      },
    });
    if (status !== 200 && status !== 201) return { ok: false, detail: `status=${status} body=${JSON.stringify(data).slice(0, 200)}` };
    apprenticeshipId =
      data?.data?.apprenticeship?.id ??
      data?.data?.id ??
      data?.apprenticeship?.id ??
      data?.id ??
      "";
    if (!apprenticeshipId) {
      const found = await db.apprenticeship.findFirst({
        where: { masterId: f.masterPro.id, status: "PENDING_ACCEPT" },
        orderBy: { invitedAt: "desc" },
      });
      apprenticeshipId = found?.id ?? "";
    }
    return { ok: !!apprenticeshipId, detail: `id=${apprenticeshipId.slice(0, 12)}` };
  });
  if (!ok1) return;

  // Backfill apprenticePro now that invitation created it.
  const apprenticeshipRow = await db.apprenticeship.findUnique({
    where: { id: apprenticeshipId },
    include: { apprentice: true },
  });
  if (apprenticeshipRow?.apprentice && (f as any).setApprenticePro) {
    (f as any).setApprenticePro({ id: apprenticeshipRow.apprentice.id, name: apprenticeshipRow.apprentice.name });
    // The invite route creates a PENDING Pro — promote to ACTIVE so it can take bookings later.
    await db.pro.update({
      where: { id: apprenticeshipRow.apprentice.id },
      data: {
        status: "ACTIVE",
        availability: "ONLINE",
        services: { create: { serviceId: f.service.id } },
        zones: { create: { zoneId: f.zone.id } },
      },
    });
  }

  await check("C", "default curriculum has 7 modules", async () => {
    const count = await db.curriculumModule.count({ where: { apprenticeshipId } });
    return { ok: count === 7, detail: `count=${count}` };
  });

  // 2. Apprentice accepts.
  await check("C", "apprentice accepts invitation", async () => {
    const { status } = await http(`/api/partner/apprentices/${apprenticeshipId}/accept`, {
      method: "POST",
      cookie: f.apprenticeCookie,
    });
    return { ok: status === 200, detail: `status=${status}` };
  });

  await check("C", "Pro.relationship is APPRENTICE", async () => {
    const pro = await db.pro.findUnique({ where: { id: f.apprenticePro.id } });
    return {
      ok: pro?.relationship === "APPRENTICE" && pro?.parentProId === f.masterPro.id,
      detail: `rel=${pro?.relationship} parent=${pro?.parentProId?.slice(0, 10)}`,
    };
  });

  // 3. Mark all gating modules complete + signed off.
  const gatingModules = await db.curriculumModule.findMany({
    where: { apprenticeshipId, gatesIndependence: true },
  });
  for (const m of gatingModules) {
    await check("C", `sign-off gating module "${m.title.slice(0, 35)}"`, async () => {
      const { status } = await http(
        `/api/partner/apprentices/${apprenticeshipId}/modules/${m.id}`,
        {
          method: "PATCH",
          cookie: f.masterCookie,
          body: { completed: true, signedOff: true },
        },
      );
      return { ok: status === 200, detail: `status=${status}` };
    });
  }

  // 4. Independence guard — should fail until non-gating advanced modules don't block.
  // Independence rule is: every required+gating module is complete+signedoff.
  // All gating done above, so granting independence should succeed now.
  await check("C", "master grants independence", async () => {
    const { status, data } = await http(
      `/api/partner/apprentices/${apprenticeshipId}/independence`,
      { method: "POST", cookie: f.masterCookie },
    );
    return { ok: status === 200, detail: `status=${status} body=${JSON.stringify(data).slice(0, 100)}` };
  });

  await check("C", "Apprenticeship.masterApprovedIndependence set", async () => {
    const a = await db.apprenticeship.findUnique({ where: { id: apprenticeshipId } });
    return { ok: a?.masterApprovedIndependence !== null, detail: `${a?.masterApprovedIndependence}` };
  });

  // 5. Mark remaining (advanced) required modules complete + bump stats → READY_FOR_FREEDOM.
  const remaining = await db.curriculumModule.findMany({
    where: { apprenticeshipId, required: true, masterSignoffAt: null },
  });
  for (const m of remaining) {
    await db.curriculumModule.update({
      where: { id: m.id },
      data: { completedAt: new Date(), masterSignoffAt: new Date() },
    });
  }
  await db.pro.update({
    where: { id: f.apprenticePro.id },
    data: { totalJobs: 80, avgRating: 4.7 },
  });
  // Trigger readiness via one more PATCH (the route runs isFreedomReady after every patch).
  const lastModule = await db.curriculumModule.findFirst({
    where: { apprenticeshipId, required: true },
  });
  await http(
    `/api/partner/apprentices/${apprenticeshipId}/modules/${lastModule!.id}`,
    {
      method: "PATCH",
      cookie: f.masterCookie,
      body: { notes: "Final review by master." },
    },
  );

  await check("C", "status auto-flipped to READY_FOR_FREEDOM", async () => {
    const a = await db.apprenticeship.findUnique({ where: { id: apprenticeshipId } });
    return {
      ok: a?.status === "READY_FOR_FREEDOM" && a?.readyForFreedomAt !== null,
      detail: `status=${a?.status}`,
    };
  });

  // 6. Master initiates Freedom.
  let certCode = "";
  await check("C", "master initiates Freedom", async () => {
    const { status, data } = await http(
      `/api/partner/apprentices/${apprenticeshipId}/freedom`,
      { method: "POST", cookie: f.masterCookie, body: { note: "Deep test freedom" } },
    );
    if (status !== 200) return { ok: false, detail: `status=${status} body=${JSON.stringify(data).slice(0, 200)}` };
    const a = await db.apprenticeship.findUnique({ where: { id: apprenticeshipId } });
    certCode = a?.freedomCertCode ?? "";
    return { ok: !!certCode, detail: `cert=${certCode}` };
  });

  await check("C", "Pro graduated — freedUnder + INDEPENDENT", async () => {
    const pro = await db.pro.findUnique({ where: { id: f.apprenticePro.id } });
    return {
      ok:
        pro?.relationship === "INDEPENDENT" &&
        pro?.parentProId === null &&
        pro?.freedUnderProId === f.masterPro.id &&
        pro?.freedAt !== null &&
        pro?.freedomCertCode === certCode,
      detail: `rel=${pro?.relationship} freedUnder=${pro?.freedUnderProId?.slice(0, 10)}`,
    };
  });

  await check("C", "public /cert/[code] is accessible without auth", async () => {
    const { status } = await http(`/cert/${certCode}`);
    return { ok: status === 200, detail: `status=${status}` };
  });

  await check("C", "Re-initiating Freedom is rejected (already FREED)", async () => {
    const { status } = await http(
      `/api/partner/apprentices/${apprenticeshipId}/freedom`,
      { method: "POST", cookie: f.masterCookie },
    );
    return { ok: status === 422 || status === 409, detail: `status=${status}` };
  });
}

// ─── SECTION D — BOOKING + MONEY LIFECYCLE ───────────────────────────────────

async function runBookingE2E(f: Fixtures) {
  console.log("\nD — Booking + money lifecycle");

  // Create an active apprentice for this section (decoupled from C, which freed theirs).
  // We'll reuse the apprentice Pro who is now INDEPENDENT (post-Freedom). That's fine
  // for booking flow tests — the earnings split test we'll do separately by injecting
  // a new active apprenticeship.
  const proForBooking = f.apprenticePro.id;

  // Create a booking directly in DB (bypassing Paystack); start at DISPATCHING.
  const ref = `TEST-${Date.now().toString(36).toUpperCase()}`;
  const booking = await db.booking.create({
    data: {
      reference: ref,
      customerId: f.customerUser.id,
      proId: proForBooking,
      serviceId: f.service.id,
      zoneId: f.zone.id,
      status: "ACCEPTED",
      address: "Deep test address",
      totalAmount: 10000,
      baseAmount: 10000,
      proEarning: 8000,
      acceptedAt: new Date(),
    },
  });
  await db.payment.create({
    data: {
      bookingId: booking.id,
      amount: 10000,
      status: "AUTHORISED",
      reference: `${ref}-pay`,
      paystackRef: `${ref}-pay`,
    },
  });

  await check("D", "transition booking ACCEPTED→COMPLETED", async () => {
    await db.booking.update({
      where: { id: booking.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        enRouteAt: new Date(Date.now() - 60 * 60_000),
        arrivedAt: new Date(Date.now() - 30 * 60_000),
      },
    });
    const b = await db.booking.findUnique({ where: { id: booking.id } });
    return { ok: b?.status === "COMPLETED" };
  });

  // Customer confirms via API.
  await check("D", "customer confirms booking → CONFIRMED", async () => {
    const { status } = await http(`/api/bookings/${booking.id}/confirm`, {
      method: "POST",
      cookie: f.customerCookie,
    });
    return { ok: status === 200, detail: `status=${status}` };
  });

  await check("D", "Earning row created on confirm", async () => {
    const e = await db.earning.findFirst({ where: { bookingId: booking.id, proId: proForBooking } });
    return { ok: !!e && e.amount === 8000 && e.type === "SERVICE", detail: e ? `amt=${e.amount} type=${e.type}` : "no row" };
  });

  await check("D", "Payment status CAPTURED", async () => {
    const p = await db.payment.findUnique({ where: { bookingId: booking.id } });
    return { ok: p?.status === "CAPTURED" && !!p?.capturedAt, detail: `${p?.status}` };
  });

  await check("D", "Pro.totalJobs incremented", async () => {
    const pro = await db.pro.findUnique({ where: { id: proForBooking } });
    return { ok: (pro?.totalJobs ?? 0) >= 81, detail: `jobs=${pro?.totalJobs}` };
  });

  // Earnings split — set up a separate active apprenticeship + booking.
  // Apprentice has just been freed; create a NEW apprentice user/pro for this test.
  const stamp2 = Date.now().toString().slice(-6);
  const splitApprenticeUser = await db.user.create({
    data: { phone: `+23499${stamp2}9`, role: "PRO", name: "Split Apprentice" },
  });
  const splitApprenticePro = await db.pro.create({
    data: {
      userId: splitApprenticeUser.id,
      phone: splitApprenticeUser.phone!,
      name: "Split Apprentice",
      status: "ACTIVE",
      availability: "ONLINE",
      relationship: "APPRENTICE",
      parentProId: f.masterPro.id,
      services: { create: { serviceId: f.service.id } },
      zones: { create: { zoneId: f.zone.id } },
    },
  });
  const splitApprenticeship = await db.apprenticeship.create({
    data: {
      apprenticeId: splitApprenticePro.id,
      masterId: f.masterPro.id,
      status: "IN_TRAINING",
      masterCommission: 0.30,
      acceptedAt: new Date(),
    },
  });

  const splitBooking = await db.booking.create({
    data: {
      reference: `SPLIT-${Date.now().toString(36).toUpperCase()}`,
      customerId: f.customerUser.id,
      proId: splitApprenticePro.id,
      serviceId: f.service.id,
      zoneId: f.zone.id,
      status: "COMPLETED",
      address: "Split test addr",
      totalAmount: 10000,
      baseAmount: 10000,
      proEarning: 8000,
      acceptedAt: new Date(),
      enRouteAt: new Date(),
      arrivedAt: new Date(),
      completedAt: new Date(),
    },
  });
  await db.payment.create({
    data: {
      bookingId: splitBooking.id,
      amount: 10000,
      status: "AUTHORISED",
      reference: `${splitBooking.reference}-pay`,
      paystackRef: `${splitBooking.reference}-pay`,
    },
  });

  await check("D", "apprentice booking confirms — both Earning rows created", async () => {
    const { status } = await http(`/api/bookings/${splitBooking.id}/confirm`, {
      method: "POST",
      cookie: f.customerCookie,
    });
    if (status !== 200) return { ok: false, detail: `status=${status}` };
    const rows = await db.earning.findMany({ where: { bookingId: splitBooking.id }, orderBy: { type: "asc" } });
    if (rows.length !== 2) return { ok: false, detail: `rows=${rows.length}` };
    const service = rows.find((r) => r.type === "SERVICE");
    const commission = rows.find((r) => r.type === "APPRENTICE_COMMISSION");
    const correctAmounts = service?.amount === 5600 && commission?.amount === 2400;
    const masterAttribution =
      commission?.proId === f.masterPro.id &&
      commission?.sourceProId === splitApprenticePro.id &&
      commission?.apprenticeshipId === splitApprenticeship.id;
    return {
      ok: correctAmounts && masterAttribution,
      detail: `svc=${service?.amount} cmsn=${commission?.amount}`,
    };
  });

  // Stash for later sections + cleanup.
  (f as any).__bookingIds = [booking.id, splitBooking.id];
  (f as any).__extraCleanup = async () => {
    await db.earning.deleteMany({ where: { proId: splitApprenticePro.id } });
    await db.apprenticeship.deleteMany({ where: { id: splitApprenticeship.id } });
    await db.payment.deleteMany({ where: { bookingId: splitBooking.id } });
    await db.booking.deleteMany({ where: { id: splitBooking.id } });
    await db.proService.deleteMany({ where: { proId: splitApprenticePro.id } });
    await db.proZone.deleteMany({ where: { proId: splitApprenticePro.id } });
    await db.pro.deleteMany({ where: { id: splitApprenticePro.id } });
    await db.user.deleteMany({ where: { id: splitApprenticeUser.id } });
  };
}

// ─── SECTION E — REFUND / CLAWBACK ───────────────────────────────────────────

async function runRefundClawback(f: Fixtures) {
  console.log("\nE — Refund / clawback parity");

  // Create a fresh booking + earning to refund.
  const ref = `REFUND-${Date.now().toString(36).toUpperCase()}`;
  const booking = await db.booking.create({
    data: {
      reference: ref,
      customerId: f.customerUser.id,
      proId: f.apprenticePro.id,
      serviceId: f.service.id,
      zoneId: f.zone.id,
      status: "CONFIRMED",
      address: "Refund test",
      totalAmount: 10000,
      baseAmount: 10000,
      proEarning: 8000,
      acceptedAt: new Date(),
      enRouteAt: new Date(),
      arrivedAt: new Date(),
      completedAt: new Date(),
      confirmedAt: new Date(),
    },
  });
  await db.payment.create({
    data: {
      bookingId: booking.id,
      amount: 10000,
      status: "CAPTURED",
      reference: `${ref}-pay`,
      paystackRef: `${ref}-pay`,
      capturedAt: new Date(),
    },
  });
  await db.earning.create({
    data: { proId: f.apprenticePro.id, bookingId: booking.id, amount: 8000, type: "SERVICE" },
  });

  await check("E", "Full refund deletes earnings (helper)", async () => {
    await reverseEarningsForBooking(booking.id, 1);
    const remaining = await db.earning.count({ where: { bookingId: booking.id } });
    return { ok: remaining === 0, detail: `remaining=${remaining}` };
  });

  // Test partial refund haircut against a separate booking + dual earnings.
  const ref2 = `PARTIAL-${Date.now().toString(36).toUpperCase()}`;
  const partial = await db.booking.create({
    data: {
      reference: ref2,
      customerId: f.customerUser.id,
      proId: f.apprenticePro.id,
      serviceId: f.service.id,
      zoneId: f.zone.id,
      status: "CONFIRMED",
      address: "Partial refund test",
      totalAmount: 10000,
      baseAmount: 10000,
      proEarning: 8000,
      acceptedAt: new Date(),
      enRouteAt: new Date(),
      arrivedAt: new Date(),
      completedAt: new Date(),
      confirmedAt: new Date(),
    },
  });
  await db.earning.create({
    data: { proId: f.apprenticePro.id, bookingId: partial.id, amount: 8000, type: "SERVICE" },
  });
  await check("E", "Partial refund haircuts earnings proportionally", async () => {
    await reverseEarningsForBooking(partial.id, 0.5);
    const e = await db.earning.findFirst({ where: { bookingId: partial.id } });
    return { ok: e?.amount === 4000, detail: `amount=${e?.amount}` };
  });
  await db.earning.deleteMany({ where: { bookingId: partial.id } });
  await db.booking.deleteMany({ where: { id: partial.id } });

  // Cleanup the test booking.
  await db.payment.deleteMany({ where: { bookingId: booking.id } });
  await db.booking.deleteMany({ where: { id: booking.id } });
}

// ─── SECTION F — ADMIN OVERRIDE ──────────────────────────────────────────────

async function runAdminOverrides(f: Fixtures) {
  console.log("\nF — Admin overrides");

  // Build a fresh apprenticeship that admin can force-freedom on.
  const stamp = Date.now().toString().slice(-6);
  const targetUser = await db.user.create({
    data: { phone: `+23499${stamp}8`, role: "PRO", name: "Override Target" },
  });
  const targetPro = await db.pro.create({
    data: {
      userId: targetUser.id,
      phone: targetUser.phone!,
      name: "Override Target",
      status: "ACTIVE",
      availability: "ONLINE",
      relationship: "APPRENTICE",
      parentProId: f.masterPro.id,
    },
  });
  const targetApp = await db.apprenticeship.create({
    data: {
      apprenticeId: targetPro.id,
      masterId: f.masterPro.id,
      status: "IN_TRAINING",
      masterCommission: 0.25,
      acceptedAt: new Date(),
    },
  });

  await check("F", "admin force-freedom bypasses readiness gate", async () => {
    const { status } = await http(
      `/api/admin/apprenticeships/${targetApp.id}/force-freedom`,
      { method: "POST", cookie: f.adminCookie, body: { note: "Test override" } },
    );
    if (status !== 200) return { ok: false, detail: `status=${status}` };
    const after = await db.apprenticeship.findUnique({ where: { id: targetApp.id } });
    return {
      ok: after?.status === "FREED" && !!after?.freedomCertCode,
      detail: `status=${after?.status} cert=${after?.freedomCertCode?.slice(0, 6)}`,
    };
  });

  await check("F", "admin ActivityLog row written for force-freedom", async () => {
    const log = await db.activityLog.findFirst({
      where: { action: { contains: "force" }, entityType: "apprenticeship", entityId: targetApp.id },
    });
    return { ok: !!log, detail: log ? `id=${log.id.slice(0, 10)}` : "none" };
  });

  // Another fresh apprenticeship for terminate.
  const stamp2 = Date.now().toString().slice(-6);
  const t2User = await db.user.create({
    data: { phone: `+23499${stamp2}7`, role: "PRO", name: "Terminate Target" },
  });
  const t2Pro = await db.pro.create({
    data: {
      userId: t2User.id,
      phone: t2User.phone!,
      name: "Terminate Target",
      status: "ACTIVE",
      availability: "ONLINE",
      relationship: "APPRENTICE",
      parentProId: f.masterPro.id,
    },
  });
  const t2App = await db.apprenticeship.create({
    data: {
      apprenticeId: t2Pro.id,
      masterId: f.masterPro.id,
      status: "IN_TRAINING",
      masterCommission: 0.30,
      acceptedAt: new Date(),
    },
  });

  await check("F", "admin terminate resets apprentice Pro", async () => {
    const { status } = await http(
      `/api/admin/apprenticeships/${t2App.id}/terminate`,
      { method: "POST", cookie: f.adminCookie, body: { reason: "Deep test terminate" } },
    );
    if (status !== 200) return { ok: false, detail: `status=${status}` };
    const after = await db.apprenticeship.findUnique({ where: { id: t2App.id } });
    const pro = await db.pro.findUnique({ where: { id: t2Pro.id } });
    return {
      ok:
        after?.status === "TERMINATED" &&
        pro?.relationship === "INDEPENDENT" &&
        pro?.parentProId === null,
      detail: `appStatus=${after?.status} proRel=${pro?.relationship}`,
    };
  });

  await check("F", "admin PATCH commission rate", async () => {
    const { status } = await http(`/api/admin/apprenticeships/${targetApp.id}`, {
      method: "PATCH",
      cookie: f.adminCookie,
      body: { masterCommission: 0.42 },
    });
    if (status !== 200) return { ok: false, detail: `status=${status}` };
    const after = await db.apprenticeship.findUnique({ where: { id: targetApp.id } });
    return { ok: after?.masterCommission === 0.42, detail: `rate=${after?.masterCommission}` };
  });

  // Cleanup
  await db.activityLog.deleteMany({
    where: {
      entityType: "apprenticeship",
      entityId: { in: [targetApp.id, t2App.id] },
    },
  });
  await db.curriculumModule.deleteMany({
    where: { apprenticeshipId: { in: [targetApp.id, t2App.id] } },
  });
  await db.apprenticeship.deleteMany({ where: { id: { in: [targetApp.id, t2App.id] } } });
  await db.pro.deleteMany({ where: { id: { in: [targetPro.id, t2Pro.id] } } });
  await db.user.deleteMany({ where: { id: { in: [targetUser.id, t2User.id] } } });
}

// ─── SECTION G — EDGE CASES & GATING ─────────────────────────────────────────

async function runEdgeCases(f: Fixtures) {
  console.log("\nG — Edge cases & gating");

  // Customer cookie hitting partner endpoint → 401/403.
  await check("G", "customer cookie on /api/partner/profile → 401/403", async () => {
    const { status } = await http("/api/partner/profile", { cookie: f.customerCookie });
    return { ok: status === 401 || status === 403, detail: `status=${status}` };
  });

  // Master tries to invite a phone already in their stable → 409.
  // First, make a fresh apprentice pinned to this master.
  const stamp = Date.now().toString().slice(-6);
  const gatedUser = await db.user.create({
    data: { phone: `+23499${stamp}5`, role: "PRO", name: "Gated Apprentice" },
  });
  const gatedPro = await db.pro.create({
    data: {
      userId: gatedUser.id,
      phone: gatedUser.phone!,
      name: "Gated Apprentice",
      status: "ACTIVE",
      relationship: "APPRENTICE",
      parentProId: f.masterPro.id,
    },
  });
  const gatedApp = await db.apprenticeship.create({
    data: {
      apprenticeId: gatedPro.id,
      masterId: f.masterPro.id,
      status: "PENDING_ACCEPT",
      masterCommission: 0.30,
    },
  });

  await check("G", "invite duplicate phone → conflict", async () => {
    const { status } = await http("/api/partner/apprentices/invite", {
      method: "POST",
      cookie: f.masterCookie,
      body: { phone: gatedUser.phone, masterCommission: 0.30 },
    });
    return { ok: status === 409 || status === 422 || status === 400, detail: `status=${status}` };
  });

  // Non-master tries to view another master's apprentice → 403/404.
  await check("G", "non-master sees another master's apprenticeship → 403/404", async () => {
    const { status } = await http(`/api/partner/apprentices/${gatedApp.id}`, {
      cookie: f.apprenticeCookie,
    });
    return { ok: status === 403 || status === 404, detail: `status=${status}` };
  });

  // Public /api/pros excludes gated apprentices.
  await check("G", "public /api/pros excludes non-independent apprentice", async () => {
    const { status, data } = await http("/api/pros?take=100");
    if (status !== 200) return { ok: false, detail: `status=${status}` };
    const list = data?.data?.pros ?? data?.pros ?? data?.data ?? data ?? [];
    const arr = Array.isArray(list) ? list : list.pros ?? [];
    const found = arr.some((p: any) => p?.id === gatedPro.id);
    return { ok: !found, detail: `found=${found}` };
  });

  // Cleanup
  await db.curriculumModule.deleteMany({ where: { apprenticeshipId: gatedApp.id } });
  await db.apprenticeship.deleteMany({ where: { id: gatedApp.id } });
  await db.pro.deleteMany({ where: { id: gatedPro.id } });
  await db.user.deleteMany({ where: { id: gatedUser.id } });

  // OTP flow: send a phone OTP, then verify with the wrong code.
  await check("G", "verify-otp with bad code → 401", async () => {
    await http("/api/auth/send-otp", {
      method: "POST",
      body: { phone: "+2348011112222" },
    });
    const { status } = await http("/api/auth/verify-otp", {
      method: "POST",
      body: { phone: "+2348011112222", otp: "000000" },
    });
    return { ok: status === 401 || status === 400, detail: `status=${status}` };
  });
}

// ─── SECTION H — DB INTEGRITY ────────────────────────────────────────────────

async function runIntegrity() {
  console.log("\nH — DB integrity");

  await check("H", "No legacy +234_email_* placeholder phones", async () => {
    const n = await db.user.count({ where: { phone: { startsWith: "+234_email_" } } });
    return { ok: n === 0, detail: `${n} rows` };
  });

  await check("H", "No FREED Pros with parentProId set", async () => {
    const n = await db.pro.count({ where: { freedAt: { not: null }, parentProId: { not: null } } });
    return { ok: n === 0, detail: `${n} rows` };
  });

  await check("H", "No APPRENTICE Pros without parentProId", async () => {
    const n = await db.pro.count({ where: { relationship: "APPRENTICE", parentProId: null } });
    return { ok: n === 0, detail: `${n} rows` };
  });

  await check("H", "No paid Earnings without payoutId", async () => {
    const n = await db.earning.count({ where: { paid: true, payoutId: null } });
    return { ok: n === 0, detail: `${n} rows` };
  });

  await check("H", "No APPRENTICE_COMMISSION Earnings missing sourceProId", async () => {
    const n = await db.earning.count({
      where: { type: "APPRENTICE_COMMISSION", sourceProId: null },
    });
    return { ok: n === 0, detail: `${n} rows` };
  });

  await check("H", "No FREED apprenticeships missing certCode", async () => {
    const n = await db.apprenticeship.count({
      where: { status: "FREED", freedomCertCode: null },
    });
    return { ok: n === 0, detail: `${n} rows` };
  });

  await check("H", "No CurriculumModules with signoff but no completion", async () => {
    const n = await db.curriculumModule.count({
      where: { masterSignoffAt: { not: null }, completedAt: null },
    });
    return { ok: n === 0, detail: `${n} rows` };
  });
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Deep test against ${BASE_URL}`);
  const f = await setupFixtures();
  try {
    await runPageReachability(f);
    await runApiContract(f);
    await runApprenticeshipE2E(f);
    await runBookingE2E(f);
    await runRefundClawback(f);
    await runAdminOverrides(f);
    await runEdgeCases(f);
    await runIntegrity();
  } finally {
    if ((f as any).__extraCleanup) await (f as any).__extraCleanup().catch(() => {});
    await f.cleanup().catch(() => {});
    await db.$disconnect();
  }

  // Summary
  console.log("\n" + "═".repeat(70));
  console.log("SUMMARY");
  console.log("═".repeat(70));
  let totalPass = 0, totalFail = 0, totalSkip = 0;
  for (const [section, list] of Object.entries(results)) {
    const pass = list.filter((r) => r.status === "PASS").length;
    const fail = list.filter((r) => r.status === "FAIL").length;
    const skip = list.filter((r) => r.status === "SKIP").length;
    totalPass += pass; totalFail += fail; totalSkip += skip;
    const flag = fail > 0 ? " ← FAIL" : "";
    console.log(`  ${section}  pass=${pass}  fail=${fail}  skip=${skip}${flag}`);
  }
  console.log("═".repeat(70));
  console.log(`Total: ${totalPass} passed, ${totalFail} failed, ${totalSkip} skipped`);
  if (totalFail > 0) {
    console.log("\nFailures:");
    for (const [section, list] of Object.entries(results)) {
      for (const r of list) if (r.status === "FAIL") console.log(`  ${section} · ${r.name} — ${r.detail ?? ""}`);
    }
  }
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Deep test crashed:", err);
  db.$disconnect();
  process.exit(2);
});
