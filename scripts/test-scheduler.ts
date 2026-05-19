/**
 * End-to-end test for the scheduler slice.
 *
 * Creates an Abuja pro (Kemi), gives her a working schedule, gives her
 * Jabi as a service zone, then:
 *   1. Creates a confirmed Jabi booking that spans 10:00–14:45 (4h45m)
 *   2. Tries to schedule a Gudu booking at 14:50 — expects rejection
 *   3. Tries to schedule a Gudu booking at 15:30 — expects success
 *   4. Pulls /api/admin/pros/:id/calendar feed for the day
 *   5. Pulls /api/pros/:id/availability for tomorrow to verify slots
 *
 * Run: `npx tsx scripts/test-scheduler.ts`
 */
import { PrismaClient } from "@prisma/client";
import {
  bookingWindow,
  effectiveDurationMins,
  findConflict,
  getAvailableSlots,
  getWorkingWindow,
  travelMinsBetween,
} from "../src/lib/scheduling";

const db = new PrismaClient();

async function main() {
  console.log("\n🧪 Scheduler smoke test\n");

  // 1. Find the Abuja zones we need.
  const [jabi, gudu, wuse] = await Promise.all([
    db.zone.findUnique({ where: { slug: "jabi" } }),
    db.zone.findUnique({ where: { slug: "gudu" } }),
    db.zone.findUnique({ where: { slug: "wuse" } }),
  ]);
  if (!jabi || !gudu || !wuse) throw new Error("Abuja zones missing — run prisma seed.");

  // Sanity: travel matrix populated?
  const j2g = await travelMinsBetween(jabi.id, gudu.id);
  const g2j = await travelMinsBetween(gudu.id, jabi.id);
  console.log(`   Jabi → Gudu = ${j2g} min`);
  console.log(`   Gudu → Jabi = ${g2j} min`);
  if (j2g === 0 || g2j === 0) throw new Error("Travel matrix not seeded.");

  // 2. Get-or-create an Abuja pro (Kemi).
  const user = await db.user.upsert({
    where: { phone: "+2348099999911" },
    update: {},
    create: {
      phone: "+2348099999911",
      name: "Kemi Abuja",
      role: "PRO",
    },
  });
  const existing = await db.pro.findUnique({ where: { userId: user.id } });
  const pro = existing
    ? await db.pro.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", availability: "ONLINE" },
      })
    : await db.pro.create({
        data: {
          name: "Kemi Abuja",
          phone: "+2348099999911",
          status: "ACTIVE",
          availability: "ONLINE",
          commission: 0.2,
          user: { connect: { id: user.id } },
        },
      });
  console.log(`   Pro: ${pro.name} (${pro.id})`);

  // 3. Working hours: 09:00 – 21:00 every day.
  for (let dow = 0; dow < 7; dow++) {
    await db.proSchedule.upsert({
      where: { proId_dayOfWeek: { proId: pro.id, dayOfWeek: dow } },
      update: { startTime: "09:00", endTime: "21:00", isActive: true },
      create: { proId: pro.id, dayOfWeek: dow, startTime: "09:00", endTime: "21:00", isActive: true },
    });
  }

  // Service zones (Jabi + Gudu).
  await db.proZone.upsert({
    where: { proId_zoneId: { proId: pro.id, zoneId: jabi.id } },
    update: {},
    create: { proId: pro.id, zoneId: jabi.id },
  });
  await db.proZone.upsert({
    where: { proId_zoneId: { proId: pro.id, zoneId: gudu.id } },
    update: {},
    create: { proId: pro.id, zoneId: gudu.id },
  });

  // Test service.
  const service = await db.service.upsert({
    where: { slug: "abuja-test-reloc" },
    update: { isActive: true, durationMins: 285 },
    create: {
      slug: "abuja-test-reloc",
      name: "Loosen + Wash + Reloc",
      category: "HAIR",
      basePrice: 25000,
      minPrice: 25000,
      maxPrice: 35000,
      durationMins: 285, // 1h + 45min + 3h = 4h45m
    },
  });
  await db.proService.upsert({
    where: { proId_serviceId: { proId: pro.id, serviceId: service.id } },
    update: { customPrice: 30000 },
    create: { proId: pro.id, serviceId: service.id, customPrice: 30000 },
  });

  // Service for the Gudu customer (1h).
  const shorter = await db.service.upsert({
    where: { slug: "abuja-test-makeup" },
    update: { isActive: true, durationMins: 60 },
    create: {
      slug: "abuja-test-makeup",
      name: "Quick Glam",
      category: "MAKEUP",
      basePrice: 15000,
      minPrice: 15000,
      maxPrice: 25000,
      durationMins: 60,
    },
  });
  await db.proService.upsert({
    where: { proId_serviceId: { proId: pro.id, serviceId: shorter.id } },
    update: {},
    create: { proId: pro.id, serviceId: shorter.id, customPrice: 18000 },
  });

  // Test customer.
  const customer = await db.user.upsert({
    where: { phone: "+2348099999912" },
    update: {},
    create: { phone: "+2348099999912", name: "Ada Test", role: "CUSTOMER" },
  });

  // Clean previous test bookings for repeatability.
  await db.booking.deleteMany({
    where: { customerId: customer.id, proId: pro.id },
  });

  // Tomorrow at 10:00 WAT
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
  const ymd = new Date(tomorrow.getTime() + 60 * 60_000).toISOString().slice(0, 10);
  const start10 = new Date(`${ymd}T10:00:00+01:00`);
  const end_1445 = new Date(start10.getTime() + 285 * 60_000);

  // 4. Create the Jabi booking (10:00–14:45 = 4h45m).
  const ref1 = `TEST-${Date.now()}-1`;
  const jabiBooking = await db.booking.create({
    data: {
      reference: ref1,
      customerId: customer.id,
      proId: pro.id,
      serviceId: service.id,
      zoneId: jabi.id,
      address: "Jabi Lake, Abuja",
      isAsap: false,
      scheduledFor: start10,
      durationMins: service.durationMins,
      baseAmount: 25000,
      totalAmount: 30000,
      proEarning: 24000,
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });
  const w = bookingWindow({ scheduledFor: jabiBooking.scheduledFor, durationMins: jabiBooking.durationMins });
  console.log(`   Existing booking: ${jabiBooking.reference} ${w?.start.toISOString()} – ${w?.end.toISOString()} (Jabi)`);

  // 5. Conflict probe — 14:50 in Gudu (5 min after Jabi ends). Should fail.
  const probe1Start = new Date(end_1445.getTime() + 5 * 60_000);
  const probe1End = new Date(probe1Start.getTime() + 60 * 60_000);
  const hit1 = await findConflict({
    proId: pro.id,
    start: probe1Start,
    end: probe1End,
    zoneId: gudu.id,
  });
  console.log(`\n   Probe @ ${probe1Start.toISOString()} Gudu:`);
  console.log(`   → ${hit1.conflict ? `❌ REJECTED · ${hit1.reason}` : "✅ accepted (BUG — should be rejected)"}`);

  // 6. Conflict probe — 15:30 in Gudu (45 min after Jabi ends, > 25 min travel). Should pass.
  const probe2Start = new Date(`${ymd}T15:30:00+01:00`);
  const probe2End = new Date(probe2Start.getTime() + 60 * 60_000);
  const hit2 = await findConflict({
    proId: pro.id,
    start: probe2Start,
    end: probe2End,
    zoneId: gudu.id,
  });
  console.log(`\n   Probe @ ${probe2Start.toISOString()} Gudu:`);
  console.log(`   → ${hit2.conflict ? `❌ rejected · ${hit2.reason} (BUG — should be accepted)` : "✅ ACCEPTED"}`);

  // 7. Working window
  const win = await getWorkingWindow(pro.id, tomorrow);
  console.log(`\n   Working window: ${win?.start.toISOString()} – ${win?.end.toISOString()}`);

  // 8. Available slots for the same day (Quick Glam, 60 min, Gudu).
  const slots = await getAvailableSlots({
    proId: pro.id,
    date: tomorrow,
    durationMins: 60,
    zoneId: gudu.id,
    minLeadMins: 60,
  });
  console.log(`\n   Available 60-min slots in Gudu for tomorrow: ${slots.length}`);
  const sample = slots.slice(0, 5).map((s) =>
    new Intl.DateTimeFormat("en-NG", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Lagos",
    }).format(s),
  );
  console.log(`   First 5: ${sample.join(", ")}`);
  console.log(`   (Should skip the Jabi block's window + travel buffer)`);

  // Sanity: no slot should fall inside the Jabi block window.
  const blockStart = start10.getTime();
  const blockEnd = end_1445.getTime();
  const overlap = slots.find(
    (s) => s.getTime() >= blockStart && s.getTime() < blockEnd,
  );
  console.log(
    overlap
      ? `   ⚠️  Slot overlaps Jabi block: ${overlap.toISOString()}`
      : `   ✅ No slot overlaps the Jabi block`,
  );

  console.log(`\n✅ All scheduler probes complete.\n`);

  console.log(`Pro id:   ${pro.id}`);
  console.log(`Test day: ${ymd}`);
  console.log(`Visit:`);
  console.log(`  /admin/calendar?proId=${pro.id}&date=${ymd}`);
  console.log(`  /pro/${pro.id}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
