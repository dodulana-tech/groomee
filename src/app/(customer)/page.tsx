import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPublicCities } from "@/lib/cities";
import Hero from "@/components/customer/Hero";
import CityRolloutBanner from "@/components/customer/CityRolloutBanner";
import Browse from "@/components/customer/Browse";
import HowItWorks from "@/components/customer/HowItWorks";
import SurveySection from "@/components/customer/SurveySection";
import AboutSection from "@/components/customer/AboutSection";
import CityWaitlist from "@/components/customer/CityWaitlist";
import Footer from "@/components/customer/Footer";
import { SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import { GROOMEE_WHATSAPP, trackedWhatsAppHref } from "@/lib/whatsapp-channel";
import { AREAS, SERVICES } from "@/lib/seo/content";
import { WhatsAppFab } from "@/components/seo/blocks";

export const revalidate = 300;

// Only the homepage is canonical to the root; other pages set their own.
export const metadata: Metadata = { alternates: { canonical: "/" } };

async function getHomeData() {
  // Apprenticeship gating (Slice 5): apprentices who haven't earned
  // independence don't appear in the top-pros section. Same filter as
  // /api/pros — see comment there.
  const independenceGate: Prisma.ProWhereInput = {
    OR: [
      { relationship: { not: "APPRENTICE" } },
      {
        relationship: "APPRENTICE",
        apprenticeshipsAsApprentice: {
          some: {
            status: { in: ["IN_TRAINING", "READY_FOR_FREEDOM"] },
            masterApprovedIndependence: { not: null },
            modules: {
              none: {
                required: true,
                gatesIndependence: true,
                OR: [{ completedAt: null }, { masterSignoffAt: null }],
              },
            },
          },
        },
      },
    ],
  };

  const [services, pros, cities] = await Promise.all([
    db.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    db.pro.findMany({
      where: {
        AND: [
          { status: "ACTIVE", avgRating: { gte: 4.0 } },
          independenceGate,
        ],
      },
      include: {
        services: { include: { service: true }, take: 3 },
        zones: { include: { zone: true }, take: 2 },
      },
      orderBy: [{ avgRating: "desc" }, { reviewCount: "desc" }],
      take: 6,
    }),
    getPublicCities(),
  ]);
  // Zones grouped by city, used to populate each waitlist's area dropdown.
  const zonesByCity = await db.zone.findMany({
    where: { cityId: { in: cities.map((c) => c.id) } },
    orderBy: { name: "asc" },
    select: { name: true, cityId: true },
  });
  const areasFor = (cityId: string) =>
    zonesByCity.filter((z) => z.cityId === cityId).map((z) => z.name);
  return { services, pros, cities, areasFor };
}

function buildJsonLd(liveCityNames: string[]) {
  const headline = liveCityNames.length
    ? liveCityNames.join(" and ")
    : "Nigeria";
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/#business`,
    name: "Groomee",
    telephone: `+${GROOMEE_WHATSAPP}`,
    email: "hello@groomeeapp.com",
    sameAs: [
      "https://instagram.com/groomeeapp",
      "https://twitter.com/groomeeapp",
      "https://tiktok.com/@groomeeapp",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: `+${GROOMEE_WHATSAPP}`,
      url: `https://wa.me/${GROOMEE_WHATSAPP}`,
      availableLanguage: ["English"],
    },
    hasOfferCatalog: { "@type": "OfferCatalog", name: "Price list", url: `${SITE_URL}/prices` },
    description: `On-demand beauty professionals delivered to your door in ${headline}.`,
    url: SITE_URL,
    logo: `${SITE_URL}/assets/logo/groomee-wordmark-green.png`,
    image: `${SITE_URL}/opengraph-image`,
    address: {
      "@type": "PostalAddress",
      addressLocality: liveCityNames[0] ?? "Lagos",
      addressCountry: "NG",
    },
    // Lagos is served online, Abuja via the WhatsApp concierge.
    areaServed: Array.from(new Set([...liveCityNames, "Lagos", "Abuja"])).map((name) => ({ "@type": "City", name })),
    serviceType: ["Hair Styling", "Makeup", "Nail Care", "Barbing", "Lash Extensions"],
    priceRange: "₦₦",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
      opens: "00:00",
      closes: "23:59",
    },
  };
}

export default async function HomePage() {
  const { services, pros, cities, areasFor } = await getHomeData();
  const liveCities = cities.filter((c) => c.status === "LIVE");
  const waitlistCities = cities.filter((c) => c.status === "WAITLIST");
  const jsonLd = buildJsonLd(liveCities.map((c) => c.name));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero
        services={services}
        liveCity={
          liveCities[0]
            ? { name: liveCities[0].name, slug: liveCities[0].slug }
            : undefined
        }
        waitlistCity={
          waitlistCities[0]
            ? { name: waitlistCities[0].name, slug: waitlistCities[0].slug }
            : undefined
        }
      />
      <CityRolloutBanner liveCities={liveCities} waitlistCities={waitlistCities} />
      <Suspense fallback={<div className="h-64" />}>
        <Browse services={services} pros={pros} />
      </Suspense>
      <HowItWorks />
      <SurveySection />
      <AboutSection />
      {waitlistCities.map((c) => (
        <CityWaitlist
          key={c.id}
          city={{ name: c.name, slug: c.slug, tagline: c.tagline }}
          areas={areasFor(c.id)}
        />
      ))}
      <section className="bg-gray-50 px-4 py-12">
        <div className="container max-w-5xl">
          <h2 className="font-display text-2xl font-black text-gray-950">Popular in Lagos</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <Link key={s.slug} href={`/lagos/${s.slug}`} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:border-[#25D366]/60">
                {s.headline}
              </Link>
            ))}
          </div>
          <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-gray-400">Areas</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <Link key={`${a.city}-${a.slug}`} href={`/${a.city}/${a.slug}`} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:border-[#25D366]/60">
                {a.name}
              </Link>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-600">
            <Link href="/detty-december" className="font-semibold underline">Detty December</Link> ·{" "}
            <Link href="/prices" className="font-semibold underline">Price list</Link> ·{" "}
            <Link href="/faq" className="font-semibold underline">FAQ</Link> ·{" "}
            <Link href="/lagos" className="font-semibold underline">Lagos</Link> ·{" "}
            <Link href="/abuja" className="font-semibold underline">Abuja</Link>
          </p>
        </div>
      </section>
      <WhatsAppFab href={trackedWhatsAppHref("home-fab")} />
      <Footer liveCities={liveCities} waitlistCities={waitlistCities} />
    </>
  );
}
