import { Suspense } from "react";
import { db } from "@/lib/db";
import Hero from "@/components/customer/Hero";
import HowItWorks from "@/components/customer/HowItWorks";
import ServiceCategories from "@/components/customer/ServiceCategories";
import TopGroomers from "@/components/customer/TopGroomers";
import TrustBadges from "@/components/customer/TrustBadges";

async function getHomeData() {
  const [services, groomers] = await Promise.all([
    db.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
    db.groomer.findMany({
      where: { status: "ACTIVE", avgRating: { gte: 4.0 } },
      include: {
        services: { include: { service: true }, take: 3 },
        zones: { include: { zone: true }, take: 2 },
      },
      orderBy: [{ avgRating: "desc" }, { reviewCount: "desc" }],
      take: 6,
    }),
  ]);
  return { services, groomers };
}

export default async function HomePage() {
  const { services, groomers } = await getHomeData();

  return (
    <>
      <Hero services={services} />
      <TrustBadges />
      <ServiceCategories services={services} />
      <Suspense fallback={<div className="h-64" />}>
        <TopGroomers groomers={groomers} />
      </Suspense>
      <HowItWorks />
    </>
  );
}
