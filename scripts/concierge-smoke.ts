/**
 * End-to-end smoke test for the WhatsApp concierge booking flow.
 *
 * Creates its own admins / customer / pro / bookings, drives the real API on
 * a dev server (create → pay link → signed Paystack webhook → pro WhatsApp
 * replies → customer confirm), compares wallet effects with a normal app
 * booking, then deletes every row it made. Needs a Paystack TEST key.
 *
 * Run the dev server with outbound messaging disabled so no real person is
 * messaged, e.g.:
 *   TWILIO_ACCOUNT_SID=ACdisabled SMTP_HOST=127.0.0.1 SMTP_PORT=1 \
 *   NEXT_PUBLIC_APP_URL=http://localhost:3600 npx next dev -p 3600
 *   npx tsx scripts/concierge-smoke.ts
 */
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import crypto from "crypto";
import "../src/lib/env";

const BASE = process.env.BASE_URL ?? "http://localhost:3600";
const db = new PrismaClient();
const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
const TAG = "E2E-CONCIERGE";
const created: { users: string[]; pros: string[]; bookings: string[] } = { users: [], pros: [], bookings: [] };

async function tok(u: { id: string; phone: string | null; role: string }) {
  return new SignJWT({ userId: u.id, phone: u.phone, role: u.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}
async function call(method: string, path: string, token: string | null, body?: unknown, raw?: { body: string; headers: Record<string, string> }) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: {
      ...(token ? { Cookie: `groomee_session=${token}` } : {}),
      ...(raw ? raw.headers : body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: raw ? raw.body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, location: res.headers.get("location"), text };
}
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}
async function webhook(reference: string, amountKobo: number, bookingId: string) {
  const payload = JSON.stringify({ event: "charge.success", data: { reference, amount: amountKobo, status: "success", metadata: { bookingId } } });
  const sig = crypto.createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY!).update(payload).digest("hex");
  return call("POST", "/api/webhooks/paystack", null, undefined, { body: payload, headers: { "Content-Type": "application/json", "x-paystack-signature": sig } });
}
async function proSays(phone: string, text: string) {
  return call("POST", "/api/webhooks/whatsapp", null, { from: phone, text });
}
async function ledger(bookingId: string) {
  return db.walletLedger.findMany({ where: { bookingId }, select: { type: true, amount: true, proId: true }, orderBy: { createdAt: "asc" } });
}

async function main() {
  if (!process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Refusing to run without a Paystack TEST key.");
  const superRole = await db.adminRole.findFirstOrThrow({ where: { permissions: { has: "*" } } });
  const supportRole = await db.adminRole.findFirstOrThrow({ where: { name: "Support" } });
  const rnd = () => String(Math.floor(Math.random() * 9e6) + 1e6);

  const mkUser = async (data: any) => { const u = await db.user.create({ data }); created.users.push(u.id); return u; };
  const superAdmin = await mkUser({ phone: `+234700${rnd()}`, name: `${TAG} super`, role: "ADMIN", adminRoleId: superRole.id });
  const supportAdmin = await mkUser({ phone: `+234700${rnd()}`, name: `${TAG} support`, role: "ADMIN", adminRoleId: supportRole.id });
  const plainCustomer = await mkUser({ phone: `+234700${rnd()}`, name: `${TAG} cust`, role: "CUSTOMER" });

  const lagosZone = await db.zone.findFirstOrThrow({ where: { slug: "lekki-phase-1" } });
  const abujaZone = await db.zone.findFirstOrThrow({ where: { cityRel: { slug: "abuja" } } });
  const services = await db.service.findMany({ where: { isActive: true, maxPrice: { gt: 0 } }, orderBy: { sortOrder: "asc" }, take: 2 });
  const [svcA, svcB] = services;

  const pro = await db.pro.create({
    data: {
      name: `${TAG} Pro`, phone: `+234701${rnd()}`, status: "ACTIVE", availability: "ONLINE",
      services: { create: [{ serviceId: svcA.id }, { serviceId: svcB.id }] },
      zones: { create: [{ zoneId: lagosZone.id }] },
    },
  });
  created.pros.push(pro.id);

  const tSuper = await tok(superAdmin), tSupport = await tok(supportAdmin), tCust = await tok(plainCustomer);

  // ── Permissions ──
  for (const [label, t] of [["non-admin", tCust], ["admin without bookings.manage", tSupport]] as const) {
    const o = await call("GET", "/api/admin/concierge/options", t);
    const c = await call("POST", "/api/admin/concierge/bookings", t, {});
    const r = await call("POST", `/api/admin/bookings/x/payment-link`, t, {});
    check(`${label} refused (options/create/resend)`, [o.status, c.status, r.status].every((s) => s === 401 || s === 403), `${o.status}/${c.status}/${r.status}`);
  }
  const pageSupport = await call("GET", "/admin/bookings/new", tSupport);
  check("support admin sees No access on /admin/bookings/new", pageSupport.status === 200 && pageSupport.text.includes("No access"));
  const pageSuper = await call("GET", "/admin/bookings/new", tSuper);
  check("super admin page renders form", pageSuper.status === 200 && pageSuper.text.includes("New concierge booking") && !pageSuper.text.includes("No access"));

  const opts = await call("GET", "/api/admin/concierge/options", tSuper);
  check("options lists Lagos + Abuja", opts.status === 200 && opts.json.data.cities.map((c: any) => c.slug).sort().join() === "abuja,lagos", JSON.stringify(opts.json?.data?.cities?.map((c: any) => `${c.slug}:${c.status}`)));

  // ── Quote parity with customer pricing ──
  const quote = await call("POST", "/api/admin/concierge/quote", tSuper, { serviceIds: [svcA.id, svcB.id], isAsap: true, proId: pro.id });
  console.log("      quote:", JSON.stringify({ base: quote.json?.data?.baseAmount, surcharge: quote.json?.data?.surcharge, total: quote.json?.data?.totalAmount, platformFee: quote.json?.data?.platformFee, proEarning: quote.json?.data?.proEarning, range: quote.json?.data?.priceRange }));
  check("quote = base + surcharge, platform fee + pro = total", quote.status === 200 &&
    Math.abs(quote.json.data.totalAmount - (quote.json.data.baseAmount + quote.json.data.surcharge.amount)) < 0.01 &&
    Math.abs(quote.json.data.platformFee + quote.json.data.proEarning - quote.json.data.totalAmount) < 0.01);
  const range = quote.json.data.priceRange;
  const bad = await call("POST", "/api/admin/concierge/quote", tSuper, { serviceIds: [svcA.id], isAsap: true, priceOverride: range.max * 10 });
  check("override above max refused", bad.status === 400 && bad.json.code === "PRICE_OUT_OF_RANGE", bad.json?.error);

  // ── Lagos concierge: new customer, pre-assigned pro, override with reason ──
  const lagosPhoneLocal = `0809${rnd()}`;
  const override = Math.round((range.min + range.max) / 2);
  const noReason = await call("POST", "/api/admin/concierge/bookings", tSuper, {
    phone: lagosPhoneLocal, name: `${TAG} Amaka`, zoneId: lagosZone.id, address: "12 Admiralty Way, by Mega Plaza",
    isAsap: true, serviceIds: [svcA.id, svcB.id], proId: pro.id, priceOverride: override,
  });
  check("override without reason refused", noReason.status === 400 && noReason.json.code === "OVERRIDE_REASON_REQUIRED");
  const lagos = await call("POST", "/api/admin/concierge/bookings", tSuper, {
    phone: lagosPhoneLocal, name: `${TAG} Amaka`, zoneId: lagosZone.id, address: "12 Admiralty Way, by Mega Plaza",
    isAsap: true, serviceIds: [svcA.id, svcB.id], proId: pro.id, notes: "Gate code 1234",
    priceOverride: override, overrideReason: "Waist length",
  });
  check("Lagos concierge created 201 with Paystack link", lagos.status === 201 && /^https:\/\/checkout\.paystack\.com\//.test(lagos.json.data.payUrl), `${lagos.status} ${lagos.json?.data?.payUrl ?? lagos.json?.error}`);
  const L = lagos.json.data;
  created.bookings.push(L.bookingId);
  created.users.push(L.customer.id);
  console.log("      wa.me:", L.whatsappUrl.slice(0, 80) + "…");
  console.log("      message:\n" + L.message.split("\n").map((l: string) => "        " + l).join("\n"));
  check("new customer created with normalised phone", L.customer.created === true && L.customer.phone === "+234" + lagosPhoneLocal.slice(1));
  const lb = await db.booking.findUniqueOrThrow({ where: { id: L.bookingId }, include: { payment: true, items: true, customer: true } });
  check("booking PENDING_PAYMENT, source WHATSAPP_CONCIERGE, items, override stored",
    lb.status === "PENDING_PAYMENT" && lb.source === "WHATSAPP_CONCIERGE" && lb.items.length === 1 && lb.baseAmount === override && lb.priceOverrideReason === "Waist length" && lb.createdByAdminId === superAdmin.id && lb.customer.role === "CUSTOMER",
    `base=${lb.baseAmount} list=${lb.listBaseAmount} total=${lb.totalAmount} pro=${lb.proEarning}`);
  check("callback uses SITE_URL", lb.payment?.authorizationUrl === L.payUrl);
  const fb = await db.notification.findFirst({ where: { recipient: L.customer.phone }, orderBy: { createdAt: "desc" } });
  check("fallback WhatsApp went through transactional sender (logged)", !!fb && fb.message.includes(L.payUrl), `status=${fb?.status}`);

  // Existing ADMIN phone is not downgraded
  const adminPhoneBooking = await call("POST", "/api/admin/concierge/bookings", tSuper, {
    phone: supportAdmin.phone, zoneId: lagosZone.id, address: "Admin's own house, Lekki", isAsap: true, serviceIds: [svcA.id],
  });
  if (adminPhoneBooking.json?.data?.bookingId) created.bookings.push(adminPhoneBooking.json.data.bookingId);
  const sa = await db.user.findUniqueOrThrow({ where: { id: supportAdmin.id } });
  check("existing ADMIN phone reused, role kept", adminPhoneBooking.status === 201 && adminPhoneBooking.json.data.customer.created === false && sa.role === "ADMIN");

  // Resend reuses the same link
  const resend = await call("POST", `/api/admin/bookings/${L.bookingId}/payment-link`, tSuper, { send: true });
  check("resend returns same pay link while pending", resend.status === 200 && resend.json.data.payUrl === L.payUrl && resend.json.data.reused === true);

  // ── Abuja concierge (WAITLIST city), scheduled, no pro ──
  const when = new Date(Date.now() + 26 * 3600_000);
  when.setUTCMinutes(0, 0, 0);
  const abujaPhone = `+234 81${rnd()}0`.slice(0, 18);
  const abuja = await call("POST", "/api/admin/concierge/bookings", tSuper, {
    phone: abujaPhone, name: `${TAG} Zainab`, zoneId: abujaZone.id, address: "Plot 5, Aminu Kano Crescent, Wuse 2",
    isAsap: false, scheduledFor: when.toISOString(), serviceIds: [svcA.id],
  });
  check("Abuja concierge created despite WAITLIST", abuja.status === 201 && abuja.json.data.city.status === "WAITLIST", `${abuja.status} ${abuja.json?.error ?? abuja.json?.data?.payUrl}`);
  const A = abuja.json.data;
  created.bookings.push(A.bookingId);
  created.users.push(A.customer.id);

  // Customer self-serve still blocked in Abuja
  const custAbuja = await call("POST", "/api/bookings", tCust, { serviceId: svcA.id, address: "Wuse 2, Abuja", isAsap: true, zoneId: abujaZone.id });
  check("customer self-serve in Abuja still refused (CITY_NOT_LIVE)", custAbuja.status === 409 && custAbuja.json.code === "CITY_NOT_LIVE");

  // ── Normal APP booking for comparison: same pro, same services, ASAP ──
  const app = await call("POST", "/api/bookings", tCust, { serviceId: svcA.id, additionalServiceIds: [svcB.id], proId: pro.id, address: "4 Admiralty Road, Lekki", isAsap: true, zoneId: lagosZone.id });
  check("customer APP booking still works via shared helpers", app.status === 201 && /checkout\.paystack\.com/.test(app.json.data.authorizationUrl), `${app.status} ${app.json?.error ?? ""}`);
  created.bookings.push(app.json.data.bookingId);
  const appB = await db.booking.findUniqueOrThrow({ where: { id: app.json.data.bookingId }, include: { payment: true } });
  check("APP booking source=APP, payment link stored", appB.source === "APP" && !!appB.payment?.authorizationUrl);
  const custPayUrl = await call("GET", `/api/bookings/${appB.id}/payment-url`, tCust);
  check("customer Pay-now reuses pending link", custPayUrl.status === 200 && custPayUrl.json.url === appB.payment!.authorizationUrl);

  // ── Simulate payment via signed webhook ──
  for (const [label, b] of [["concierge Lagos", lb], ["APP", appB]] as const) {
    const pay = await db.payment.findUniqueOrThrow({ where: { bookingId: b.id } });
    const w = await webhook(pay.paystackRef!, Math.round(pay.amount * 100), b.id);
    const w2 = await webhook(pay.paystackRef!, Math.round(pay.amount * 100), b.id); // duplicate delivery
    await new Promise((r) => setTimeout(r, 1500));
    const after = await db.booking.findUniqueOrThrow({ where: { id: b.id }, include: { payment: true, dispatchLog: true } });
    check(`${label}: webhook → payment AUTHORISED, booking DISPATCHING, offered to pre-assigned pro once`,
      w.status === 200 && w2.status === 200 && after.payment?.status === "AUTHORISED" && after.status === "DISPATCHING" && after.dispatchLog.length === 1 && after.dispatchLog[0].proId === pro.id,
      `status=${after.status} pay=${after.payment?.status} offers=${after.dispatchLog.map((d) => d.proName).join(",")}`);
    const offer = await db.notification.findFirst({ where: { recipient: pro.phone }, orderBy: { createdAt: "desc" } });
    check(`${label}: job offer notification to pro went through sender`, !!offer, `"${offer?.message.slice(0, 50).replace(/\n/g, " ")}…" (${offer?.status})`);

    // Pro lifecycle via WhatsApp replies
    await proSays(pro.phone, "YES");
    const acc = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    await proSays(pro.phone, "OTWAY");
    await proSays(pro.phone, "ARRIVED");
    await proSays(pro.phone, "DONE");
    const done = await db.booking.findUniqueOrThrow({ where: { id: b.id } });
    // Customer confirms from their booking page
    const owner = await db.user.findUniqueOrThrow({ where: { id: b.customerId } });
    const tOwner = await tok(owner);
    const view = await call("GET", `/api/bookings/${b.id}`, tOwner);
    const conf = await call("POST", `/api/bookings/${b.id}/confirm`, tOwner, {});
    const fin = await db.booking.findUniqueOrThrow({ where: { id: b.id }, include: { payment: true } });
    const led = await ledger(b.id);
    const earn = await db.earning.findMany({ where: { bookingId: b.id }, select: { type: true, amount: true } });
    const total = led.reduce((s, m) => s + m.amount, 0);
    console.log(`      ${label}: accept=${acc.status} done=${done.status} view=${view.status} confirm=${conf.status} final=${fin.status} pay=${fin.payment?.status}`);
    console.log(`      ${label}: proEarning=${fin.proEarning} wallet=${JSON.stringify(led.map((m) => [m.type, m.amount]))} sum=${total.toFixed(2)} earnings=${JSON.stringify(earn)}`);
    check(`${label}: full lifecycle to CONFIRMED, wallet releases sum to proEarning`, fin.status === "CONFIRMED" && Math.abs(total - fin.proEarning) < 0.02 && view.status === 200);
    await db.pro.update({ where: { id: pro.id }, data: { availability: "ONLINE", currentBookingId: null } });
  }

  // ── Abuja: paid, no pro pre-assigned, no Abuja pro online → normal dispatch outcome ──
  {
    const pay = await db.payment.findUniqueOrThrow({ where: { bookingId: A.bookingId } });
    const w = await webhook(pay.paystackRef!, Math.round(pay.amount * 100), A.bookingId);
    await new Promise((r) => setTimeout(r, 1500));
    const after = await db.booking.findUniqueOrThrow({ where: { id: A.bookingId }, include: { payment: true, dispatchLog: true } });
    check("Abuja: webhook → AUTHORISED and dispatch ran (offer or NO_GROOMER)", w.status === 200 && after.payment?.status === "AUTHORISED" && ["DISPATCHING", "NO_GROOMER"].includes(after.status), `status=${after.status} offers=${after.dispatchLog.length}`);
    const conf = await db.notification.findFirst({ where: { recipient: A.customer.phone, message: { contains: "received your payment" } } });
    check("Abuja: customer WhatsApp payment confirmation queued", !!conf, conf?.status);
  }

  // Amount mismatch is rejected
  const mm = await call("POST", "/api/admin/concierge/bookings", tSuper, { phone: L.customer.phone, zoneId: lagosZone.id, address: "Same customer again, Lekki", isAsap: true, serviceIds: [svcA.id] });
  created.bookings.push(mm.json.data.bookingId);
  check("same phone reuses customer", mm.json.data.customer.created === false && mm.json.data.customer.id === L.customer.id);
  const mmPay = await db.payment.findUniqueOrThrow({ where: { bookingId: mm.json.data.bookingId } });
  await webhook(mmPay.paystackRef!, Math.round(mmPay.amount * 100) - 100, mm.json.data.bookingId);
  const mmAfter = await db.booking.findUniqueOrThrow({ where: { id: mm.json.data.bookingId }, include: { payment: true } });
  check("underpaid webhook does not move booking", mmAfter.status === "PENDING_PAYMENT" && mmAfter.payment?.status === "PENDING");

  // Expired slot: resend refused
  await db.booking.update({ where: { id: mm.json.data.bookingId }, data: { createdAt: new Date(Date.now() - 48 * 3600_000) } });
  const exp = await call("POST", `/api/admin/bookings/${mm.json.data.bookingId}/payment-link`, tSuper, { send: false });
  check("resend refused once the slot has passed", exp.status === 409 && exp.json.code === "EXPIRED", exp.json?.error);

  // Return URL reachable without a session (old verify path is 401 in middleware)
  const vr = await call("GET", `/api/webhooks/paystack/return?bookingId=${L.bookingId}&reference=${lb.payment!.paystackRef}`, null);
  check("return URL (already paid, no session) → sign-in, then booking", vr.status === 307 && (vr.location ?? "").includes("/auth?redirect=%2Fbooking%2F" + L.bookingId), vr.location ?? "");

  // Real Paystack test-mode charge, then the anonymous return → verifyTransaction
  {
    const r = await call("POST", "/api/admin/concierge/bookings", tSuper, { phone: `0907${rnd()}`, name: `${TAG} Real`, zoneId: lagosZone.id, address: "Real charge test, Lekki", isAsap: true, serviceIds: [svcA.id] });
    created.bookings.push(r.json.data.bookingId); created.users.push(r.json.data.customer.id);
    const bk = await db.booking.findUniqueOrThrow({ where: { id: r.json.data.bookingId }, include: { customer: true } });
    const ref = `E2E-${Date.now()}`;
    const ps = async (path: string, body: unknown) => (await fetch("https://api.paystack.co" + path, { method: "POST", headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
    let ch: any = await ps("/charge", { email: "e2e@example.com", amount: Math.round(bk.totalAmount * 100), reference: ref, metadata: { bookingId: bk.id }, card: { number: "4084084084084081", cvv: "408", expiry_month: "12", expiry_year: "30" } });
    if (ch?.data?.status === "send_pin") ch = await ps("/charge/submit_pin", { pin: "0000", reference: ref });
    if (ch?.data?.status === "send_otp") ch = await ps("/charge/submit_otp", { otp: "123456", reference: ref });
    console.log("      paystack test charge:", ch?.data?.status ?? ch?.message);
    if (ch?.data?.status === "success") {
      const ret = await call("GET", `/api/webhooks/paystack/return?bookingId=${bk.id}&reference=${ref}`, null);
      const after = await db.booking.findUniqueOrThrow({ where: { id: bk.id }, include: { payment: true } });
      check("real Paystack charge + anonymous return → verified, booking moved forward", ["DISPATCHING", "NO_GROOMER", "ACCEPTED"].includes(after.status) && after.payment?.status === "AUTHORISED" && after.payment.paystackRef === ref && (ret.location ?? "").includes("/auth?redirect="), `status=${after.status} pay=${after.payment?.status} → ${ret.location}`);
    } else {
      console.log("      (skipped real-charge check: Paystack test charge not successful)");
    }
  }

  // List page
  const list = await call("GET", "/admin/bookings?source=WHATSAPP_CONCIERGE", tSuper);
  check("bookings list filters concierge + shows funnel", list.status === 200 && list.text.includes("WhatsApp concierge · last 7 days") && list.text.includes(lb.reference));
  const stats = await (await import("../src/lib/concierge")).conciergeStats(7).catch((e) => String(e));
  console.log("      7d concierge stats:", JSON.stringify(stats));
}

async function cleanup() {
  const ids = created.bookings.filter(Boolean);
  const phones = (await db.user.findMany({ where: { id: { in: created.users } }, select: { phone: true } })).map((u) => u.phone!).filter(Boolean);
  const proPhones = (await db.pro.findMany({ where: { id: { in: created.pros } }, select: { phone: true } })).map((p) => p.phone);
  await db.walletLedger.deleteMany({ where: { OR: [{ bookingId: { in: ids } }, { proId: { in: created.pros } }] } });
  await db.earning.deleteMany({ where: { OR: [{ bookingId: { in: ids } }, { proId: { in: created.pros } }] } });
  await db.savingsMovement.deleteMany({ where: { proId: { in: created.pros } } }).catch(() => {});
  await db.proSavingsAccount.deleteMany({ where: { proId: { in: created.pros } } }).catch(() => {});
  await db.proWallet.deleteMany({ where: { proId: { in: created.pros } } }).catch(() => {});
  await db.pointsLedger.deleteMany({ where: { userId: { in: created.users } } });
  await db.review.deleteMany({ where: { bookingId: { in: ids } } });
  await db.dispatchLog.deleteMany({ where: { bookingId: { in: ids } } });
  await db.booking.deleteMany({ where: { id: { in: ids } } }); // cascades items + payment
  await db.activityLog.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { adminId: { in: created.users } }] } });
  await db.notification.deleteMany({ where: { recipient: { in: [...phones, ...proPhones] } } });
  await db.pro.deleteMany({ where: { id: { in: created.pros } } });
  await db.user.deleteMany({ where: { id: { in: created.users }, role: { not: "ADMIN" } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
  console.log("cleanup done:", { bookings: ids.length, users: created.users.length, pros: created.pros.length });
}

main()
  .catch((e) => { console.error("ERROR", e); process.exitCode = 1; })
  .finally(async () => { try { await cleanup(); } catch (e) { console.error("CLEANUP ERROR", e); } await db.$disconnect(); });
