import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { getPublicCities } from "@/lib/cities";
import { trackedWhatsAppHref } from "@/lib/whatsapp-channel";
import { GUIDES } from "@/lib/seo/guides";
import Footer from "@/components/customer/Footer";
import { Breadcrumbs, WhatsAppFab } from "@/components/seo/blocks";

export const revalidate = 3600;

const title = "Beauty Price Guides for Lagos & Abuja (2026) | Groomee";
const description = "What braids, makeup, nails, lashes and barbing cost at home in Lagos and Abuja, what changes the price, and how long each takes.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: { title, description, url: `${SITE_URL}/guides` },
};

export default async function GuidesIndex() {
  const cities = await getPublicCities();
  return (
    <>
      <section className="bg-gray-950 px-4 pb-12 pt-8">
        <div className="container max-w-3xl">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Guides", href: "/guides" }]} />
          <h1 className="mt-8 font-display text-3xl font-black text-white sm:text-5xl">Beauty price guides</h1>
          <p className="mt-4 max-w-xl text-white/65">Straight answers on what home service beauty costs in Lagos and Abuja, from our live price list.</p>
        </div>
      </section>
      <section className="bg-white px-4 py-12">
        <ul className="container grid max-w-3xl gap-4">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="block rounded-2xl border border-gray-200 bg-white/80 p-5 transition hover:border-[#25D366]/60 hover:shadow-md">
                <h2 className="font-bold text-gray-900">{g.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{g.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <WhatsAppFab href={trackedWhatsAppHref("guides")} />
      <Footer liveCities={cities.filter((c) => c.status === "LIVE")} waitlistCities={cities.filter((c) => c.status === "WAITLIST")} />
    </>
  );
}
