import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL } from "@/lib/site";
import { getPublicCities } from "@/lib/cities";
import { trackedWhatsAppHref } from "@/lib/whatsapp-channel";
import { GUIDES, guideBySlug } from "@/lib/seo/guides";
import { serviceBySlug } from "@/lib/seo/content";
import Footer from "@/components/customer/Footer";
import {
  Breadcrumbs,
  Faqs,
  WhatsAppButton,
  WhatsAppFab,
  duration,
  getPrices,
  priceRange,
} from "@/components/seo/blocks";
import { formatNaira } from "@/lib/utils";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  const url = `${SITE_URL}/guides/${g.slug}`;
  return {
    title: { absolute: `${g.title} | Groomee` },
    description: g.description,
    alternates: { canonical: url },
    openGraph: { title: g.title, description: g.description, url, type: "article" },
  };
}

export default async function GuidePage({ params }: Props) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const [prices, cities] = await Promise.all([getPrices(), getPublicCities()]);
  const rows = g.services
    .map((slug) => ({ s: serviceBySlug(slug), p: prices[slug] }))
    .filter((r): r is { s: NonNullable<typeof r.s>; p: (typeof r)["p"] } => !!r.s && !!r.p);
  const low = Math.min(...rows.map((r) => r.p.min));
  const high = Math.max(...rows.map((r) => r.p.max));
  const primary = rows[0];
  const waHref = trackedWhatsAppHref(`guide-${g.slug}`, "abuja", { service: primary?.s.slug });
  const answer = `${g.question.replace(/\?$/, "")}: typically ${formatNaira(low)} to ${formatNaira(high)} for a vetted pro at your home with Groomee. ${g.intro}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.description,
    url: `${SITE_URL}/guides/${g.slug}`,
    publisher: { "@id": `${SITE_URL}/#business` },
    about: rows.map((r) => ({ "@type": "Service", name: r.s.name, url: `${SITE_URL}/abuja/${r.s.slug}` })),
    dateModified: new Date().toISOString().slice(0, 10),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-gray-950 px-4 pb-12 pt-8">
        <div className="container max-w-3xl">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Guides", href: "/guides" }, { name: g.title.split("?")[0] + "?", href: `/guides/${g.slug}` }]} />
          <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-widest text-[#25D366]">Groomee price guide</p>
          <h1 className="font-display text-3xl font-black text-white sm:text-4xl">{g.title}</h1>
          <p className="mt-5 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-5 text-base leading-relaxed text-white/80 backdrop-blur">
            <strong className="text-white">Short answer: </strong>
            {answer}
          </p>
          <div className="mt-6">
            <WhatsAppButton href={waHref}>Get an exact quote on WhatsApp</WhatsAppButton>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12">
        <div className="container max-w-3xl space-y-10">
          <div>
            <h2 className="font-display text-2xl font-black text-gray-950">Typical prices at home</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr><th className="px-4 py-3">Service</th><th className="px-4 py-3">Typical price</th><th className="px-4 py-3">Time</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.s.slug}>
                      <td className="px-4 py-3"><Link href={`/abuja/${r.s.slug}`} className="font-medium text-gray-900 hover:underline">{r.s.name}</Link></td>
                      <td className="px-4 py-3 font-mono text-gray-700">{priceRange(r.p)}</td>
                      <td className="px-4 py-3 text-gray-500">{duration(r.p.mins)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Prices in naira for labour at your location, from Groomee&apos;s current price list. Your pro confirms the final price before they set off.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-black text-gray-950">What changes the price</h2>
            <dl className="mt-4 space-y-3">
              {g.factors.map((f) => (
                <div key={f.name} className="rounded-2xl border border-gray-200 bg-white/80 p-4">
                  <dt className="font-semibold text-gray-900">{f.name}</dt>
                  <dd className="mt-1 text-sm text-gray-600">{f.detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="font-display text-2xl font-black text-gray-950">How long it takes</h2>
            <p className="mt-3 text-gray-700">{g.time}</p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-black text-gray-950">Tips to get the best price and result</h2>
            <ul className="mt-3 space-y-2 text-gray-700">
              {g.tips.map((t) => (
                <li key={t} className="flex gap-2"><span className="text-[#25D366]">✓</span>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Faqs faqs={g.faqs} title="Questions people ask" />

      <section className="bg-gray-50 px-4 py-12">
        <div className="container max-w-3xl">
          <h2 className="font-display text-xl font-black text-gray-950">More price guides</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {GUIDES.filter((o) => o.slug !== g.slug).map((o) => (
              <li key={o.slug}><Link href={`/guides/${o.slug}`} className="text-sm text-gray-700 underline hover:text-gray-950">{o.title}</Link></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-gray-950 px-4 py-12 text-center">
        <h2 className="font-display text-2xl font-black text-white">Want an exact price?</h2>
        <p className="mt-2 text-sm text-white/60">Send us a photo of the style and your area. We&apos;ll reply with a quote, usually within the hour.</p>
        <div className="mt-6"><WhatsAppButton href={waHref}>Message us on WhatsApp</WhatsAppButton></div>
      </section>

      <WhatsAppFab href={waHref} />
      <Footer liveCities={cities.filter((c) => c.status === "LIVE")} waitlistCities={cities.filter((c) => c.status === "WAITLIST")} />
    </>
  );
}
