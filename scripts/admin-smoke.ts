/**
 * Smoke-test every read-only admin route as a super admin.
 *
 * Generates a session JWT directly (no OTP), sets the session cookie, then
 * hits every admin page and GET-only API route on http://localhost:3000.
 * Reports status code + response time for each. Non-2xx is flagged.
 *
 * Usage:
 *   npm run smoke:admin                   # hits localhost:3000
 *   BASE_URL=https://staging... npm run smoke:admin
 */

import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import "../src/lib/env";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_DURATION = parseInt(process.env.SESSION_DURATION ?? "2592000");
const COOKIE_NAME = "groomee_session";

if (!JWT_SECRET) {
  console.error("JWT_SECRET missing");
  process.exit(1);
}

const PAGES = [
  "/admin",
  "/admin/bookings",
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
];

const GET_APIS = [
  "/api/admin/settings",
  "/api/admin/zones",
  "/api/admin/bookings",
  "/api/admin/disputes",
  "/api/admin/roles",
  "/api/admin/team",
  "/api/admin/payouts",
  "/api/admin/stats",
  "/api/admin/pros/list",
  "/api/admin/apprenticeships",
];

async function main() {
  const db = new PrismaClient();
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    include: { adminRole: true },
  });
  if (!admin) {
    console.error("No ADMIN user in DB. Seed first.");
    process.exit(1);
  }

  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT({
    userId: admin.id,
    phone: admin.phone,
    role: "ADMIN",
    adminRoleId: admin.adminRole?.id,
    adminRoleName: admin.adminRole?.name,
    permissions: admin.adminRole?.permissions ?? [],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(secret);

  const cookie = `${COOKIE_NAME}=${token}`;
  console.log(`Smoke-testing as admin "${admin.name ?? admin.id}" against ${BASE_URL}\n`);

  let failures = 0;

  async function hit(path: string, label: string) {
    const url = `${BASE_URL}${path}`;
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        headers: { cookie },
        redirect: "manual",
      });
      const ms = Date.now() - t0;
      const ok = res.status >= 200 && res.status < 400;
      const tag = ok ? "✓" : "✗";
      const flag = !ok ? " ← FAIL" : "";
      console.log(`  ${tag} ${String(res.status).padEnd(3)}  ${ms.toString().padStart(4)}ms  ${label.padEnd(8)}  ${path}${flag}`);
      if (!ok) failures++;
    } catch (err: any) {
      console.log(`  ✗ ERR        ${label.padEnd(8)}  ${path} — ${err.message}`);
      failures++;
    }
  }

  console.log("Pages:");
  for (const p of PAGES) await hit(p, "page");

  console.log("\nGET APIs:");
  for (const p of GET_APIS) await hit(p, "api");

  console.log(`\n${failures === 0 ? "✓ All routes responded 2xx/3xx." : `✗ ${failures} failure(s) — see above.`}`);

  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
