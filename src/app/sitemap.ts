import { db } from "@/lib/db";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng";

  // Static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1.0 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}/subscriptions`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${baseUrl}/gift`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${baseUrl}/auth`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${baseUrl}/partner/login`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.3 },
  ];

  // Dynamic pro profile pages
  let proPages: MetadataRoute.Sitemap = [];
  try {
    const pros = await db.pro.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, updatedAt: true },
    });
    proPages = pros.map((pro) => ({
      url: `${baseUrl}/pro/${pro.id}`,
      lastModified: pro.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // DB may not be available during build
  }

  return [...staticPages, ...proPages];
}
