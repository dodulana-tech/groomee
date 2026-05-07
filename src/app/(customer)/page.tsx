import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import Hero from "@/components/customer/Hero";
import CityRolloutBanner from "@/components/customer/CityRolloutBanner";
import Browse from "@/components/customer/Browse";
import HowItWorks from "@/components/customer/HowItWorks";
import SurveySection from "@/components/customer/SurveySection";
import AboutSection from "@/components/customer/AboutSection";
import AbujaWaitlist from "@/components/customer/AbujaWaitlist";
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

  const [services, pros] = await Promise.all([
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
  ]);
  return { services, pros };
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Groomee",
  description: "On-demand beauty professionals delivered to your door in Lagos and Abuja.",
  url: "https://groomee.ng",
  logo: "https://groomee.ng/assets/logo/groomee-wordmark-green.png",
  image: "https://groomee.ng/opengraph-image",
  address: { "@type": "PostalAddress", addressLocality: "Lagos", addressCountry: "NG" },
  areaServed: [
    { "@type": "City", name: "Lagos" },
    { "@type": "City", name: "Abuja" },
  ],
  serviceType: ["Hair Styling", "Makeup", "Nail Care", "Barbing", "Lash Extensions"],
  priceRange: "₦₦",
  openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], opens: "00:00", closes: "23:59" },
};

export default async function HomePage() {
  const { services, pros } = await getHomeData();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero services={services} />
      <CityRolloutBanner />
      <Suspense fallback={<div className="h-64" />}>
        <Browse services={services} pros={pros} />
      </Suspense>
      <HowItWorks />
      <SurveySection />
      <AboutSection />
      <AbujaWaitlist />
      <Footer />
    </>
  );
}
