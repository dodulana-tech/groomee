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

export const revalidate = 300;

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
    name: "Groomee",
    description: `On-demand beauty professionals delivered to your door in ${headline}.`,
    url: "https://groomee.ng",
    logo: "https://groomee.ng/assets/logo/groomee-wordmark-green.png",
    image: "https://groomee.ng/opengraph-image",
    address: {
      "@type": "PostalAddress",
      addressLocality: liveCityNames[0] ?? "Lagos",
      addressCountry: "NG",
    },
    areaServed: liveCityNames.map((name) => ({ "@type": "City", name })),
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
      <Footer liveCities={liveCities} waitlistCities={waitlistCities} />
    </>
  );
}
