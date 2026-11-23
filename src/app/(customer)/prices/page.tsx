import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { trackedWhatsAppHref } from "@/lib/whatsapp-channel";
import { CATEGORY_LABEL, SERVICES, type SeoService } from "@/lib/seo/content";
import { WhatsAppButton, WhatsAppFab, duration, getPrices, priceRange } from "@/components/seo/blocks";
import { getPublicCities } from "@/lib/cities";
import Footer from "@/components/customer/Footer";

export const revalidate = 3600;

const title = "Home Service Beauty Prices in Lagos & Abuja (2026) | Groomee";
const description =
  "Typical prices for braids, makeup, nails, lashes, barbing and facials at home in Lagos and Abuja, from vetted Groomee pros. Final price confirmed before your pro sets off.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: `${SITE_URL}/prices` },
  openGraph: { title, description, url: `${SITE_URL}/prices` },
};

export default async function PricesPage() {
  const [prices, cities] = await Promise.all([getPrices(), getPublicCities()]);
  const waHref = trackedWhatsAppHref("prices");
  const byCat = SERVICES.reduce<Record<string, SeoService[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Groomee home service beauty prices",
    url: `${SITE_URL}/prices`,
    itemListElement: SERVICES.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.name, url: `${SITE_URL}/lagos/${s.slug}` },
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "NGN",
        minPrice: prices[s.slug].min,
        maxPrice: prices[s.slug].max,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-gray-950 px-4 py-14">
        <div className="container max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#25D366]">Groomee · Price list</p>
          <h1 className="font-display text-3xl font-black text-white sm:text-5xl">Home service beauty prices</h1>
          <p className="mt-4 max-w-xl text-base text-white/65">
            Typical prices in Lagos and Abuja for a vetted pro who comes to you. Your pro confirms the final
            price before they set off, based on the exact style, length and extras.
          </p>
          <div className="mt-8">
            <WhatsAppButton href={waHref}>Get a quote on WhatsApp</WhatsAppButton>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12">
        <div className="container max-w-4xl space-y-8">
          {Object.entries(byCat).map(([cat, list]) => (
            <div key={cat}>
              <h2 className="font-display text-xl font-black text-gray-950">{CATEGORY_LABEL[cat] ?? cat}</h2>
              <table className="mt-3 w-full overflow-hidden rounded-2xl border border-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Typical price</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map((s) => (
                    <tr key={s.slug}>
                      <td className="px-4 py-3">
                        <Link href={`/lagos/${s.slug}`} className="font-medium text-gray-900 hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">{priceRange(prices[s.slug])}</td>
                      <td className="hidden px-4 py-3 text-gray-500 sm:table-cell">{duration(prices[s.slug].mins)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="text-sm text-gray-500">
            Prices are in Nigerian naira and cover the pro&apos;s labour at your location. Attachments, hair
            and special products may be extra; your pro will tell you before booking.
          </p>
        </div>
      </section>

      <WhatsAppFab href={waHref} />
      <Footer
        liveCities={cities.filter((c) => c.status === "LIVE")}
        waitlistCities={cities.filter((c) => c.status === "WAITLIST")}
      />
    </>
  );
}
