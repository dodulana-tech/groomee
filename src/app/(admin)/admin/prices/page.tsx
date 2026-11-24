import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSession, hasPermission } from "@/lib/auth";
import { CATEGORY_LABEL, SERVICES } from "@/lib/seo/content";
import { FEE_KEYS, PRICE_RESEARCH } from "@/lib/seo/price-research";
import PriceReview from "./PriceReview";

export const metadata: Metadata = { title: "Prices" };
export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const session = await getSession();
  if (!hasPermission(session, "catalog.view") && !hasPermission(session, "catalog.manage")) redirect("/admin");

  const [rows, settings] = await Promise.all([
    db.service.findMany({
      where: { slug: { in: SERVICES.map((s) => s.slug) } },
      select: { id: true, slug: true, minPrice: true, maxPrice: true, basePrice: true },
    }),
    db.setting.findMany({ where: { key: { in: Object.values(FEE_KEYS) } } }),
  ]);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const fee = (k: string) => settings.find((s) => s.key === k)?.value ?? "";

  const services = SERVICES.map((s) => {
    const r = bySlug.get(s.slug);
    return {
      slug: s.slug,
      name: s.name,
      group: CATEGORY_LABEL[s.category] ?? "More",
      id: r?.id ?? null,
      current: r ? { min: r.minPrice, max: r.maxPrice } : null,
      suggested: PRICE_RESEARCH[s.slug] ?? null,
    };
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Prices</h1>
        <p className="mt-1 text-sm text-gray-500">
          These ranges show on every service page, the price list and the guides, and they&apos;re what Google and
          ChatGPT quote. For each service, use the suggested range or type your own. Saving updates the website
          straight away. Prices are for a home visit, labour only (hair and attachments extra).
        </p>
      </div>
      <PriceReview
        services={services}
        canEdit={hasPermission(session, "catalog.manage")}
        canEditFees={hasPermission(session, "settings.manage_ops") || hasPermission(session, "settings.manage_finance")}
        fees={{ homeVisit: fee(FEE_KEYS.homeVisit), earlyMorning: fee(FEE_KEYS.earlyMorning), depositPercent: fee(FEE_KEYS.depositPercent) }}
      />
    </div>
  );
}
