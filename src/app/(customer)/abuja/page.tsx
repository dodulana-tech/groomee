import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPublicCities } from "@/lib/cities";
import { formatNaira } from "@/lib/utils";
import { trackedWhatsAppHref } from "@/lib/whatsapp-channel";
import CityWaitlist from "@/components/customer/CityWaitlist";
import Footer from "@/components/customer/Footer";

export const revalidate = 300;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomeeapp.com";

const CATEGORY_LABEL: Record<string, string> = {
  HAIR: "Hair & braids",
  MAKEUP: "Makeup",
  NAILS: "Nails",
  BARBING: "Barbing",
  LASHES: "Lashes",
  SKINCARE: "Skincare",
  OTHER: "More",
};

export const metadata: Metadata = {
  title: "Home Service Beauty in Abuja — Hair, Makeup, Nails",
  description:
    "Book vetted beauty professionals to your home in Abuja — Wuse, Maitama, Asokoro, Garki & more. Braids, makeup, nails, lashes and barbing. Message Groomee on WhatsApp to book now.",
  alternates: { canonical: `${APP_URL}/abuja` },
  openGraph: {
    title: "Groomee Abuja — your beauty pro, at your door",
    description:
      "Hair, makeup, nails, lashes & barbing at home in Abuja. Book on WhatsApp.",
    url: `${APP_URL}/abuja`,
  },
};

export default async function AbujaPage() {
  const city = await db.city.findUnique({
    where: { slug: "abuja" },
    include: { zones: { orderBy: { name: "asc" }, select: { name: true } } },
  });
  if (!city || city.status === "HIDDEN") notFound();

  const [services, publicCities] = await Promise.all([
    db.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { name: true, category: true, minPrice: true, maxPrice: true },
    }),
    getPublicCities(),
  ]);

  const byCategory = services.reduce<Record<string, typeof services>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
  const areas = city.zones.map((z) => z.name);
  const waHref = trackedWhatsAppHref("abuja-page", city.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Groomee Abuja",
    description:
      "On-demand home service beauty professionals in Abuja — hair, makeup, nails, lashes and barbing.",
    url: `${APP_URL}/abuja`,
    telephone: "+234 808 429 6023",
    address: { "@type": "PostalAddress", addressLocality: "Abuja", addressCountry: "NG" },
    areaServed: [
      { "@type": "City", name: "Abuja" },
      ...areas.map((name) => ({ "@type": "Place", name: `${name}, Abuja` })),
    ],
    priceRange: "₦₦",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative overflow-hidden bg-gray-950 px-4 py-16 sm:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_20%_40%,rgba(37,211,102,0.18),transparent_60%),radial-gradient(ellipse_40%_60%_at_85%_30%,rgba(124,58,237,0.18),transparent_55%)]" />
        <div className="container relative z-10 max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#25D366]">
            Groomee · Abuja
          </p>
          <h1 className="font-display text-3xl font-black text-white sm:text-5xl">
            Your beauty pro, at your door in Abuja.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/60">
            Braids, makeup, nails, lashes and barbing — vetted pros who come to you.
            Message us on WhatsApp and we&apos;ll match you with a pro, often the same day.
          </p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-7 py-4 text-base font-bold text-gray-950 transition-all hover:-translate-y-0.5 hover:bg-[#3be07a] hover:shadow-[0_8px_24px_rgba(37,211,102,0.35)]"
          >
            💬 Book on WhatsApp
          </a>
          <p className="mt-3 text-xs text-white/40">+234 808 429 6023 · replies fast, 7 days a week</p>
        </div>
      </section>

      {areas.length > 0 && (
        <section className="bg-white px-4 py-12">
          <div className="container max-w-4xl">
            <h2 className="font-display text-2xl font-black text-gray-950">Areas we cover in Abuja</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {areas.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-gray-50 px-4 py-12">
        <div className="container max-w-4xl">
          <h2 className="font-display text-2xl font-black text-gray-950">Home services &amp; prices</h2>
          <p className="mt-2 text-sm text-gray-500">Typical price ranges. Your pro confirms the final price before they set off.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Object.entries(byCategory).map(([cat, list]) => (
              <div key={cat} className="rounded-2xl border border-gray-200 bg-white/80 p-5 backdrop-blur">
                <h3 className="mb-3 font-bold text-gray-900">{CATEGORY_LABEL[cat] ?? cat}</h3>
                <ul className="space-y-2">
                  {list.map((s) => (
                    <li key={s.name} className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-700">{s.name}</span>
                      <span className="shrink-0 font-mono text-gray-500">
                        {formatNaira(s.minPrice)}–{formatNaira(s.maxPrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-6 py-3.5 text-sm font-bold text-gray-950 transition-all hover:bg-[#3be07a]"
            >
              💬 Book a pro in Abuja
            </a>
          </div>
        </div>
      </section>

      {city.status === "WAITLIST" && (
        <CityWaitlist city={{ name: city.name, slug: city.slug, tagline: city.tagline }} areas={areas} />
      )}

      <Footer
        liveCities={publicCities.filter((c) => c.status === "LIVE")}
        waitlistCities={publicCities.filter((c) => c.status === "WAITLIST")}
      />
    </>
  );
}
