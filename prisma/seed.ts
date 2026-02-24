import {
  PrismaClient,
  ServiceCategory,
  GroomerStatus,
  GroomerAvail,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── ZONES ────────────────────────────────────────────────
  const zones = await Promise.all([
    prisma.zone.upsert({
      where: { slug: "victoria-island" },
      update: {},
      create: {
        name: "Victoria Island",
        slug: "victoria-island",
        city: "Lagos",
      },
    }),
    prisma.zone.upsert({
      where: { slug: "lekki-phase-1" },
      update: {},
      create: { name: "Lekki Phase 1", slug: "lekki-phase-1", city: "Lagos" },
    }),
    prisma.zone.upsert({
      where: { slug: "ikoyi" },
      update: {},
      create: { name: "Ikoyi", slug: "ikoyi", city: "Lagos" },
    }),
    prisma.zone.upsert({
      where: { slug: "ikeja" },
      update: {},
      create: { name: "Ikeja", slug: "ikeja", city: "Lagos" },
    }),
    prisma.zone.upsert({
      where: { slug: "surulere" },
      update: {},
      create: { name: "Surulere", slug: "surulere", city: "Lagos" },
    }),
    prisma.zone.upsert({
      where: { slug: "yaba" },
      update: {},
      create: { name: "Yaba", slug: "yaba", city: "Lagos" },
    }),
    prisma.zone.upsert({
      where: { slug: "ajah" },
      update: {},
      create: { name: "Ajah", slug: "ajah", city: "Lagos" },
    }),
    prisma.zone.upsert({
      where: { slug: "gbagada" },
      update: {},
      create: { name: "Gbagada", slug: "gbagada", city: "Lagos" },
    }),
  ]);
  console.log(`✅ ${zones.length} zones`);

  // ── SERVICES ─────────────────────────────────────────────
  const services = [
    {
      name: "Knotless Braids",
      slug: "knotless-braids",
      category: ServiceCategory.HAIR,
      basePrice: 15000,
      minPrice: 12000,
      maxPrice: 25000,
      durationMins: 180,
      description: "Medium knotless braids, shoulder length",
      sortOrder: 1,
    },
    {
      name: "Box Braids",
      slug: "box-braids",
      category: ServiceCategory.HAIR,
      basePrice: 12000,
      minPrice: 10000,
      maxPrice: 20000,
      durationMins: 150,
      description: "Classic box braids in various sizes",
      sortOrder: 2,
    },
    {
      name: "Locs Styling",
      slug: "locs-styling",
      category: ServiceCategory.HAIR,
      basePrice: 8000,
      minPrice: 6000,
      maxPrice: 15000,
      durationMins: 90,
      description: "Loc retwist and styling",
      sortOrder: 3,
    },
    {
      name: "Weave Installation",
      slug: "weave-installation",
      category: ServiceCategory.HAIR,
      basePrice: 20000,
      minPrice: 15000,
      maxPrice: 35000,
      durationMins: 120,
      description: "Full sew-in weave installation",
      sortOrder: 4,
    },
    {
      name: "Natural Hair Styling",
      slug: "natural-hair-styling",
      category: ServiceCategory.HAIR,
      basePrice: 8000,
      minPrice: 6000,
      maxPrice: 15000,
      durationMins: 60,
      description: "Wash, condition and style natural hair",
      sortOrder: 5,
    },
    {
      name: "Full Glam Makeup",
      slug: "full-glam-makeup",
      category: ServiceCategory.MAKEUP,
      basePrice: 25000,
      minPrice: 20000,
      maxPrice: 50000,
      durationMins: 90,
      description: "Full glam for events and occasions",
      sortOrder: 1,
    },
    {
      name: "Natural Makeup",
      slug: "natural-makeup",
      category: ServiceCategory.MAKEUP,
      basePrice: 15000,
      minPrice: 12000,
      maxPrice: 25000,
      durationMins: 60,
      description: "Soft natural everyday makeup",
      sortOrder: 2,
    },
    {
      name: "Bridal Makeup",
      slug: "bridal-makeup",
      category: ServiceCategory.MAKEUP,
      basePrice: 45000,
      minPrice: 35000,
      maxPrice: 80000,
      durationMins: 120,
      description: "Complete bridal makeup with touch-up kit",
      sortOrder: 3,
    },
    {
      name: "Gel Nails",
      slug: "gel-nails",
      category: ServiceCategory.NAILS,
      basePrice: 8000,
      minPrice: 6000,
      maxPrice: 15000,
      durationMins: 60,
      description: "Gel manicure with nail prep",
      sortOrder: 1,
    },
    {
      name: "Acrylic Nails",
      slug: "acrylic-nails",
      category: ServiceCategory.NAILS,
      basePrice: 12000,
      minPrice: 10000,
      maxPrice: 20000,
      durationMins: 90,
      description: "Full set acrylic nail extensions",
      sortOrder: 2,
    },
    {
      name: "Nail Art",
      slug: "nail-art",
      category: ServiceCategory.NAILS,
      basePrice: 10000,
      minPrice: 8000,
      maxPrice: 18000,
      durationMins: 75,
      description: "Custom nail art designs",
      sortOrder: 3,
    },
    {
      name: "Fade & Shape-up",
      slug: "fade-shape-up",
      category: ServiceCategory.BARBING,
      basePrice: 4000,
      minPrice: 3000,
      maxPrice: 8000,
      durationMins: 45,
      description: "Skin fade with line-up and shape-up",
      sortOrder: 1,
    },
    {
      name: "Classic Haircut",
      slug: "classic-haircut",
      category: ServiceCategory.BARBING,
      basePrice: 3000,
      minPrice: 2500,
      maxPrice: 6000,
      durationMins: 30,
      description: "Classic scissor and clipper cut",
      sortOrder: 2,
    },
    {
      name: "Beard Grooming",
      slug: "beard-grooming",
      category: ServiceCategory.BARBING,
      basePrice: 3000,
      minPrice: 2500,
      maxPrice: 5000,
      durationMins: 30,
      description: "Beard trim, shape and hot towel",
      sortOrder: 3,
    },
    {
      name: "Classic Lash Set",
      slug: "classic-lash-set",
      category: ServiceCategory.LASHES,
      basePrice: 12000,
      minPrice: 10000,
      maxPrice: 20000,
      durationMins: 90,
      description: "Classic eyelash extensions",
      sortOrder: 1,
    },
    {
      name: "Volume Lashes",
      slug: "volume-lashes",
      category: ServiceCategory.LASHES,
      basePrice: 18000,
      minPrice: 15000,
      maxPrice: 30000,
      durationMins: 120,
      description: "Russian volume lash extensions",
      sortOrder: 2,
    },
    {
      name: "Lash Lift & Tint",
      slug: "lash-lift-tint",
      category: ServiceCategory.LASHES,
      basePrice: 10000,
      minPrice: 8000,
      maxPrice: 15000,
      durationMins: 60,
      description: "Lash lift with keratin tint",
      sortOrder: 3,
    },
    {
      name: "Facial Treatment",
      slug: "facial-treatment",
      category: ServiceCategory.SKINCARE,
      basePrice: 15000,
      minPrice: 12000,
      maxPrice: 25000,
      durationMins: 60,
      description: "Deep cleansing facial with extractions",
      sortOrder: 1,
    },
    {
      name: "Glow Treatment",
      slug: "glow-treatment",
      category: ServiceCategory.SKINCARE,
      basePrice: 20000,
      minPrice: 15000,
      maxPrice: 35000,
      durationMins: 75,
      description: "Brightening glow facial",
      sortOrder: 2,
    },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: s,
    });
  }
  console.log(`✅ ${services.length} services`);

  // ── SETTINGS ─────────────────────────────────────────────
  const settings = [
    { key: "platform_commission", value: "0.20" },
    { key: "emergency_surcharge", value: "0.20" },
    { key: "late_night_surcharge", value: "0.25" },
    { key: "early_morning_surcharge", value: "0.20" },
    { key: "dispatch_timeout_mins", value: "3" },
    { key: "auto_confirm_mins", value: "60" },
    { key: "late_night_start", value: "22" },
    { key: "late_night_end", value: "5" },
    { key: "early_morning_start", value: "5" },
    { key: "early_morning_end", value: "7" },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log(`✅ ${settings.length} settings`);

  // ── GROOMERS ─────────────────────────────────────────────
  const allServices = await prisma.service.findMany();
  const allZones = await prisma.zone.findMany();

  const getServiceIds = (...slugs: string[]) =>
    allServices.filter((s) => slugs.includes(s.slug)).map((s) => s.id);
  const getZoneIds = (...slugs: string[]) =>
    allZones.filter((z) => slugs.includes(z.slug)).map((z) => z.id);

  const groomersData = [
    {
      name: "Chidinma Adeyemi",
      phone: "+2348011111101",
      status: GroomerStatus.ACTIVE,
      availability: GroomerAvail.ONLINE,
      avgRating: 4.9,
      reviewCount: 247,
      totalJobs: 312,
      idVerified: true,
      commission: 0.2,
      serviceSlug: [
        "knotless-braids",
        "box-braids",
        "locs-styling",
        "natural-hair-styling",
      ],
      zoneSlug: ["victoria-island", "lekki-phase-1", "ikoyi"],
    },
    {
      name: "Shade Martins",
      phone: "+2348011111102",
      status: GroomerStatus.ACTIVE,
      availability: GroomerAvail.ONLINE,
      avgRating: 4.7,
      reviewCount: 183,
      totalJobs: 241,
      idVerified: true,
      commission: 0.2,
      serviceSlug: [
        "full-glam-makeup",
        "natural-makeup",
        "bridal-makeup",
        "facial-treatment",
      ],
      zoneSlug: ["lekki-phase-1", "victoria-island", "ikoyi"],
    },
    {
      name: "Ngozi Philips",
      phone: "+2348011111103",
      status: GroomerStatus.ACTIVE,
      availability: GroomerAvail.OFFLINE,
      avgRating: 4.8,
      reviewCount: 156,
      totalJobs: 198,
      idVerified: true,
      commission: 0.2,
      serviceSlug: ["gel-nails", "acrylic-nails", "nail-art"],
      zoneSlug: ["ikeja", "surulere", "gbagada"],
    },
    {
      name: "Emeka Okafor",
      phone: "+2348011111104",
      status: GroomerStatus.ACTIVE,
      availability: GroomerAvail.ONLINE,
      avgRating: 4.8,
      reviewCount: 198,
      totalJobs: 267,
      idVerified: true,
      commission: 0.2,
      serviceSlug: ["fade-shape-up", "classic-haircut", "beard-grooming"],
      zoneSlug: ["yaba", "lekki-phase-1", "surulere"],
    },
    {
      name: "Tolu Bankole",
      phone: "+2348011111105",
      status: GroomerStatus.ACTIVE,
      availability: GroomerAvail.BUSY,
      avgRating: 4.6,
      reviewCount: 124,
      totalJobs: 165,
      idVerified: true,
      commission: 0.2,
      serviceSlug: ["classic-lash-set", "volume-lashes", "lash-lift-tint"],
      zoneSlug: ["victoria-island", "lekki-phase-1"],
    },
    {
      name: "Kemi Adesanya",
      phone: "+2348011111106",
      status: GroomerStatus.ACTIVE,
      availability: GroomerAvail.ONLINE,
      avgRating: 4.9,
      reviewCount: 89,
      totalJobs: 112,
      idVerified: true,
      commission: 0.2,
      serviceSlug: ["weave-installation", "knotless-braids", "box-braids"],
      zoneSlug: ["ajah", "lekki-phase-1"],
    },
    {
      name: "Bisi Olawale",
      phone: "+2348011111107",
      status: GroomerStatus.ACTIVE,
      availability: GroomerAvail.ONLINE,
      avgRating: 4.7,
      reviewCount: 143,
      totalJobs: 189,
      idVerified: true,
      commission: 0.2,
      serviceSlug: ["facial-treatment", "glow-treatment", "natural-makeup"],
      zoneSlug: ["ikeja", "gbagada"],
    },
    {
      name: "Rotimi Adebayo",
      phone: "+2348011111108",
      status: GroomerStatus.ACTIVE,
      availability: GroomerAvail.OFFLINE,
      avgRating: 4.5,
      reviewCount: 67,
      totalJobs: 89,
      idVerified: true,
      commission: 0.2,
      serviceSlug: ["fade-shape-up", "beard-grooming", "classic-haircut"],
      zoneSlug: ["yaba", "surulere"],
    },
  ];

  for (const g of groomersData) {
    const { serviceSlug, zoneSlug, ...groomerFields } = g;

    const groomer = await prisma.groomer.upsert({
      where: { phone: groomerFields.phone },
      update: {},
      create: groomerFields,
    });

    // Services
    for (const sid of getServiceIds(...serviceSlug)) {
      await prisma.groomerService.upsert({
        where: {
          groomerId_serviceId: { groomerId: groomer.id, serviceId: sid },
        },
        update: {},
        create: { groomerId: groomer.id, serviceId: sid },
      });
    }

    // Zones
    for (const zid of getZoneIds(...zoneSlug)) {
      await prisma.groomerZone.upsert({
        where: { groomerId_zoneId: { groomerId: groomer.id, zoneId: zid } },
        update: {},
        create: { groomerId: groomer.id, zoneId: zid },
      });
    }
  }
  console.log(`✅ ${groomersData.length} groomers`);
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
