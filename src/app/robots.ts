import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomeeapp.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/partner", "/profile", "/bookings", "/booking/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
