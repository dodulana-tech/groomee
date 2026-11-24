import { db } from "@/lib/db";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { AREAS, SERVICES } from "@/lib/seo/content";
import { GUIDES } from "@/lib/seo/guides";
import { isWhatsAppMode } from "@/lib/booking-mode";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  const staticPages = [
    page("", 1.0, "daily"),
    page("/abuja", 0.95),
    page("/lagos", 0.7),
    page("/prices", 0.9),
    page("/detty-december", 0.9),
    page("/faq", 0.8),
    page("/become-a-pro", 0.7),
    page("/subscriptions", 0.6),
    page("/gift", 0.5, "monthly"),
  ];

  // Service x city and area landing pages
  const landing = [
    ...SERVICES.map((s) => page(`/abuja/${s.slug}`, 0.85)),
    ...SERVICES.map((s) => page(`/lagos/${s.slug}`, 0.6)),
    ...AREAS.map((a) => page(`/${a.city}/${a.slug}`, a.city === "abuja" ? 0.8 : 0.55)),
    page("/guides", 0.8),
    ...GUIDES.map((g) => page(`/guides/${g.slug}`, 0.85)),
  ];

  // Dynamic pro profile pages
  let proPages: MetadataRoute.Sitemap = [];
  try {
    // WhatsApp mode: profiles redirect to /book, so don't list them.
    if (await isWhatsAppMode()) throw new Error("whatsapp mode");
    const pros = await db.pro.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, updatedAt: true },
    });
    proPages = pros.map((pro) => ({
      url: `${SITE_URL}/pro/${pro.id}`,
      lastModified: pro.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // DB may not be available during build
  }

  return [...staticPages, ...landing, ...proPages];
}
