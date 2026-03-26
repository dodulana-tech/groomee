import { Suspense } from "react";
import { db } from "@/lib/db";
import Hero from "@/components/customer/Hero";
import TrustBadges from "@/components/customer/TrustBadges";
import CityRolloutBanner from "@/components/customer/CityRolloutBanner";
import ServiceCategories from "@/components/customer/ServiceCategories";
import TopPros from "@/components/customer/TopPros";
import HowItWorks from "@/components/customer/HowItWorks";
import SurveySection from "@/components/customer/SurveySection";
import AboutSection from "@/components/customer/AboutSection";
import AbujaWaitlist from "@/components/customer/AbujaWaitlist";
import Footer from "@/components/customer/Footer";

async function getHomeData() {
  const [services, pros] = await Promise.all([
    db.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    db.pro.findMany({
      where: { status: "ACTIVE", avgRating: { gte: 4.0 } },
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

export default async function HomePage() {
  const { services, pros } = await getHomeData();

  return (
    <>
      <Hero services={services} />
      <TrustBadges />
      <CityRolloutBanner />
      <ServiceCategories services={services} />
      <Suspense fallback={<div className="h-64" />}>
        <TopPros pros={pros} />
      </Suspense>
      <HowItWorks />
      <SurveySection />
      <AboutSection />
      <AbujaWaitlist />
      <Footer />
    </>
  );
}
