/**
 * Idempotent reference-data sync, run on every deploy after sync:roles.
 *
 * Production was never seeded, so it had zones with no city and no cities
 * at all. Booking routes refuse a zone whose city is unknown, so without
 * this every booking would be rejected. This script only ever ADDS:
 *   - creates the Lagos and Abuja city rows if missing (existing status,
 *     tagline and launch date are never changed — ops own those in
 *     Admin > Cities)
 *   - creates any missing zone, linked to its city
 *   - links existing zones that have no cityId, matching on the zone's
 *     legacy `city` name
 *   - adds travel times only for zone pairs that have none (values edited
 *     in Admin are kept)
 *
 * Usage: npm run sync:reference (also runs automatically as npm prebuild)
 */
import { PrismaClient, type CityStatus } from "@prisma/client";

const prisma = new PrismaClient();

const CITIES: { slug: string; name: string; status: CityStatus; sortOrder: number; tagline: string }[] = [
  // Abuja takes bookings (team books them over WhatsApp); Lagos is coming soon.
  { slug: "abuja", name: "Abuja", status: "LIVE", sortOrder: 0, tagline: "Vetted pros who come to you, booked on WhatsApp." },
  { slug: "lagos", name: "Lagos", status: "WAITLIST", sortOrder: 1, tagline: "Coming soon. Join the list and we'll tell you first." },
];

const ZONES: { slug: string; name: string; city: "lagos" | "abuja" }[] = [
  { slug: "lekki-phase-1", name: "Lekki Phase 1", city: "lagos" },
  { slug: "victoria-island", name: "Victoria Island", city: "lagos" },
  { slug: "ikoyi", name: "Ikoyi", city: "lagos" },
  { slug: "ikeja", name: "Ikeja", city: "lagos" },
  { slug: "surulere", name: "Surulere", city: "lagos" },
  { slug: "yaba", name: "Yaba", city: "lagos" },
  { slug: "gbagada", name: "Gbagada", city: "lagos" },
  { slug: "ajah", name: "Ajah", city: "lagos" },
  { slug: "wuse", name: "Wuse", city: "abuja" },
  { slug: "maitama", name: "Maitama", city: "abuja" },
  { slug: "asokoro", name: "Asokoro", city: "abuja" },
  { slug: "garki", name: "Garki", city: "abuja" },
  { slug: "jabi", name: "Jabi", city: "abuja" },
  { slug: "gudu", name: "Gudu", city: "abuja" },
  { slug: "gwarinpa", name: "Gwarinpa", city: "abuja" },
  { slug: "utako", name: "Utako", city: "abuja" },
];

// Same matrix as prisma/seed.ts (minutes, one direction per row).
const TRAVEL: Record<string, Record<string, number>> = {
  jabi: { wuse: 15, maitama: 20, asokoro: 30, garki: 25, gudu: 25, gwarinpa: 15, utako: 8 },
  wuse: { jabi: 15, maitama: 10, asokoro: 15, garki: 12, gudu: 20, gwarinpa: 25, utako: 12 },
  maitama: { jabi: 20, wuse: 10, asokoro: 15, garki: 18, gudu: 30, gwarinpa: 30, utako: 18 },
  asokoro: { jabi: 30, wuse: 15, maitama: 15, garki: 12, gudu: 25, gwarinpa: 40, utako: 25 },
  garki: { jabi: 25, wuse: 12, maitama: 18, asokoro: 12, gudu: 12, gwarinpa: 35, utako: 18 },
  gudu: { jabi: 25, wuse: 20, maitama: 30, asokoro: 25, garki: 12, gwarinpa: 35, utako: 20 },
  gwarinpa: { jabi: 15, wuse: 25, maitama: 30, asokoro: 40, garki: 35, gudu: 35, utako: 20 },
  utako: { jabi: 8, wuse: 12, maitama: 18, asokoro: 25, garki: 18, gudu: 20, gwarinpa: 20 },
  "victoria-island": { ikoyi: 10, "lekki-phase-1": 20, yaba: 30, surulere: 35, ikeja: 60, gbagada: 40, ajah: 45 },
  ikoyi: { "victoria-island": 10, "lekki-phase-1": 20, yaba: 25, surulere: 30, ikeja: 55, gbagada: 35, ajah: 45 },
  "lekki-phase-1": { "victoria-island": 20, ikoyi: 20, yaba: 45, surulere: 50, ikeja: 75, gbagada: 50, ajah: 25 },
  yaba: { "victoria-island": 30, ikoyi: 25, "lekki-phase-1": 45, surulere: 15, ikeja: 30, gbagada: 20, ajah: 60 },
  surulere: { "victoria-island": 35, ikoyi: 30, "lekki-phase-1": 50, yaba: 15, ikeja: 30, gbagada: 25, ajah: 65 },
  ikeja: { "victoria-island": 60, ikoyi: 55, "lekki-phase-1": 75, yaba: 30, surulere: 30, gbagada: 35, ajah: 90 },
  gbagada: { "victoria-island": 40, ikoyi: 35, "lekki-phase-1": 50, yaba: 20, surulere: 25, ikeja: 35, ajah: 60 },
  ajah: { "victoria-island": 45, ikoyi: 45, "lekki-phase-1": 25, yaba: 60, surulere: 65, ikeja: 90, gbagada: 60 },
};

async function main() {
  // Runs as npm "prebuild" too, so it happens whatever build command the
  // host is configured with. No database (e.g. a CI typecheck build): skip.
  if (!process.env.DATABASE_URL) {
    console.log("🗺  sync-reference-data: no DATABASE_URL, skipping");
    return;
  }
  console.log("🗺  Syncing reference data (cities, zones, travel)…");

  const cityIds: Record<string, string> = {};
  for (const c of CITIES) {
    const existing = await prisma.city.findUnique({ where: { slug: c.slug } });
    if (existing) {
      cityIds[c.slug] = existing.id;
      continue;
    }
    const created = await prisma.city.create({
      data: { ...c, launchedAt: c.status === "LIVE" ? new Date() : null },
    });
    cityIds[c.slug] = created.id;
    console.log(`   ➕ city ${c.name} (${c.status})`);
  }

  let zonesCreated = 0;
  for (const z of ZONES) {
    const existing = await prisma.zone.findUnique({ where: { slug: z.slug } });
    if (existing) continue;
    await prisma.zone.create({
      data: { slug: z.slug, name: z.name, city: z.city === "lagos" ? "Lagos" : "Abuja", cityId: cityIds[z.city] },
    });
    zonesCreated++;
    console.log(`   ➕ zone ${z.name}`);
  }

  // Link legacy zones (cityId null) by their city name.
  const byName = Object.fromEntries(
    (await prisma.city.findMany({ select: { id: true, name: true } })).map((c) => [c.name.toLowerCase(), c.id]),
  );
  const orphans = await prisma.zone.findMany({ where: { cityId: null }, select: { id: true, name: true, city: true } });
  let linked = 0;
  for (const z of orphans) {
    const id = byName[(z.city ?? "").toLowerCase()];
    if (!id) {
      console.warn(`   ⚠ zone ${z.name} has city "${z.city}" with no matching city row — link it in Admin > Cities`);
      continue;
    }
    await prisma.zone.update({ where: { id: z.id }, data: { cityId: id } });
    linked++;
  }

  const zoneIds = Object.fromEntries(
    (await prisma.zone.findMany({ select: { id: true, slug: true } })).map((z) => [z.slug, z.id]),
  );
  const rows = Object.entries(TRAVEL).flatMap(([from, edges]) =>
    Object.entries(edges)
      .filter(([to]) => zoneIds[from] && zoneIds[to])
      .map(([to, travelMins]) => ({ fromZoneId: zoneIds[from], toZoneId: zoneIds[to], travelMins })),
  );
  const travel = await prisma.zoneTravel.createMany({ data: rows, skipDuplicates: true });

  console.log(
    `✅ Reference data: ${zonesCreated} zone(s) created, ${linked} zone(s) linked to a city, ${travel.count} travel time(s) added.`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ sync-reference-data failed:", err);
  process.exit(1);
});
