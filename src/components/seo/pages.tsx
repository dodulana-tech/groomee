import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { getPublicCities } from "@/lib/cities";
import { trackedWhatsAppHref } from "@/lib/whatsapp-channel";
import Footer from "@/components/customer/Footer";
import {
  CATEGORY_LABEL,
  CITY_NAME,
  COMMON_FAQS,
  SERVICES,
  areasIn,
  type CitySlug,
  type SeoArea,
  type SeoService,
} from "@/lib/seo/content";
import {
  Breadcrumbs,
  Faqs,
  HowItWorks,
  ServiceCard,
  WHATSAPP_DISPLAY,
  WhatsAppButton,
  WhatsAppFab,
  duration,
  getPrices,
  priceRange,
} from "./blocks";

import { serviceRating } from "@/lib/reviews";

const BUSINESS_ID = `${SITE_URL}/#business`;

// Lagos books online too; Abuja is WhatsApp-concierge only for now.
const ONLINE_BOOKING: Record<CitySlug, boolean> = { lagos: true, abuja: false };

async function PageFooter() {
  const cities = await getPublicCities();
  return (
    <Footer
      liveCities={cities.filter((c) => c.status === "LIVE")}
      waitlistCities={cities.filter((c) => c.status === "WAITLIST")}
    />
  );
}

function Hero({
  eyebrow,
  title,
  lead,
  crumbs,
  waHref,
  waLabel,
  secondary,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  crumbs: { name: string; href: string }[];
  waHref: string;
  waLabel: string;
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="relative overflow-hidden bg-gray-950 px-4 pb-14 pt-8 sm:pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_20%_40%,rgba(37,211,102,0.18),transparent_60%),radial-gradient(ellipse_40%_60%_at_85%_30%,rgba(1,67,66,0.5),transparent_55%)]" />
      <div className="container relative z-10 max-w-3xl">
        <Breadcrumbs items={crumbs} />
        <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-widest text-[#25D366]">{eyebrow}</p>
        <h1 className="font-display text-3xl font-black text-white sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">{lead}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <WhatsAppButton href={waHref}>{waLabel}</WhatsAppButton>
          {secondary && (
            <Link
              href={secondary.href}
              className="rounded-xl border border-white/20 px-6 py-4 text-sm font-semibold text-white/80 backdrop-blur hover:border-white/40 hover:text-white"
            >
              {secondary.label}
            </Link>
          )}
        </div>
        <p className="mt-3 text-xs text-white/40">WhatsApp {WHATSAPP_DISPLAY} · replies fast, 7 days a week</p>
      </div>
    </section>
  );
}

function AreaChips({ city, areas, service }: { city: CitySlug; areas: SeoArea[]; service?: SeoService }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {areas.map((a) => (
        <Link
          key={a.slug}
          href={`/${city}/${a.slug}`}
          className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:border-[#25D366]/60"
          title={service ? `${service.name} in ${a.name}` : `Beauty at home in ${a.name}`}
        >
          {a.name}
        </Link>
      ))}
    </div>
  );
}

// ─── SERVICE IN A CITY ───────────────────────────────────────────────────────

export function serviceMetadata(city: CitySlug, s: SeoService): Metadata {
  const cityName = CITY_NAME[city];
  const url = `${SITE_URL}/${city}/${s.slug}`;
  const title = `${s.headline} in ${cityName} | Groomee`;
  const description = `${s.headline} in ${cityName} by vetted, rated pros who come to you. Typical price ${priceRange(s.fallback)}. Book on WhatsApp in minutes.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export async function ServiceCityPage({ city, service }: { city: CitySlug; service: SeoService }) {
  const cityName = CITY_NAME[city];
  const [prices, rating] = await Promise.all([getPrices(), serviceRating(service.slug)]);
  const price = prices[service.slug];
  const areas = areasIn(city);
  const waHref = trackedWhatsAppHref(`svc-${service.slug}`, city, { service: service.slug });
  const related = SERVICES.filter((s) => s.category === service.category && s.slug !== service.slug).slice(0, 3);
  const faqs = [...service.faqs, ...COMMON_FAQS.slice(1, 4)];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${service.headline} in ${cityName}`,
    serviceType: service.name,
    description: service.intro,
    url: `${SITE_URL}/${city}/${service.slug}`,
    provider: { "@id": BUSINESS_ID },
    areaServed: [
      { "@type": "City", name: cityName },
      ...areas.map((a) => ({ "@type": "Place", name: `${a.name}, ${cityName}` })),
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "NGN",
      lowPrice: price.min,
      highPrice: price.max,
    },
    // Real Groomee reviews only (3+), never seeded pro ratings.
    ...(rating
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count, bestRating: 5 } }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero
        eyebrow={`Groomee · ${cityName}`}
        title={`${service.headline} in ${cityName}`}
        lead={service.intro}
        crumbs={[
          { name: "Home", href: "/" },
          { name: cityName, href: `/${city}` },
          { name: service.name, href: `/${city}/${service.slug}` },
        ]}
        waHref={waHref}
        waLabel={`Book ${service.name.toLowerCase()} on WhatsApp`}
        secondary={ONLINE_BOOKING[city] ? { href: `/search?service=${service.slug}`, label: "Book online" } : undefined}
      />

      <section className="bg-white px-4 py-12">
        <div className="container grid max-w-4xl gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Typical price</p>
            <p className="mt-1 font-mono text-lg font-bold text-gray-900">{priceRange(price)}</p>
            <p className="mt-1 text-xs text-gray-500">Confirmed before your pro sets off</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Time</p>
            <p className="mt-1 text-lg font-bold text-gray-900">About {duration(price.mins)}</p>
            <p className="mt-1 text-xs text-gray-500">Varies with size and length</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white/80 p-5 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Where</p>
            <p className="mt-1 text-lg font-bold text-gray-900">Your home or office</p>
            <p className="mt-1 text-xs text-gray-500">Across {cityName}</p>
          </div>
        </div>

        <div className="container mt-10 grid max-w-4xl gap-8 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-black text-gray-950">What&apos;s included</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {service.included.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[#25D366]">✓</span>
                  {i}
                </li>
              ))}
            </ul>
          </div>
          {service.prep.length > 0 && (
            <div>
              <h2 className="font-display text-xl font-black text-gray-950">Before your pro arrives</h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {service.prep.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gray-400">•</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="container mt-10 max-w-4xl">
          <h2 className="font-display text-xl font-black text-gray-950">
            {service.name} near you in {cityName}
          </h2>
          <AreaChips city={city} areas={areas} service={service} />
        </div>
      </section>

      {rating && (
        <section className="bg-white px-4 pb-4">
          <div className="container max-w-4xl">
            <h2 className="font-display text-xl font-black text-gray-950">
              Rated {rating.average.toFixed(1)} out of 5 by {rating.count} Groomee customers
            </h2>
            {rating.recent.length > 0 && (
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {rating.recent.map((r, i) => (
                  <li key={i} className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm">
                    <p className="text-[#c8871a]">{"★".repeat(r.rating)}</p>
                    <p className="mt-2 text-gray-700">&ldquo;{r.text}&rdquo;</p>
                    <p className="mt-2 text-xs text-gray-500">{r.author}{r.area ? `, ${r.area}` : ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <HowItWorks />
      <Faqs faqs={faqs} title={`${service.name} in ${cityName}: questions people ask`} />

      {related.length > 0 && (
        <section className="bg-gray-50 px-4 py-12">
          <div className="container max-w-4xl">
            <h2 className="font-display text-xl font-black text-gray-950">Related services</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <ServiceCard key={r.slug} service={r} price={prices[r.slug]} href={`/${city}/${r.slug}`} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-gray-950 px-4 py-12 text-center">
        <h2 className="font-display text-2xl font-black text-white">
          Ready for {service.name.toLowerCase()} in {cityName}?
        </h2>
        <div className="mt-6">
          <WhatsAppButton href={waHref}>Message us on WhatsApp</WhatsAppButton>
        </div>
      </section>

      <WhatsAppFab href={waHref} />
      <PageFooter />
    </>
  );
}

// ─── AREA ────────────────────────────────────────────────────────────────────

export function areaMetadata(area: SeoArea): Metadata {
  const cityName = CITY_NAME[area.city];
  const url = `${SITE_URL}/${area.city}/${area.slug}`;
  const title = `Home Service Beauty in ${area.name}, ${cityName} | Hair, Makeup, Nails | Groomee`;
  const description = `Vetted beauty pros who come to your home in ${area.name}, ${cityName}: braids, makeup, nails, lashes, barbing and facials. See prices and book on WhatsApp.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export async function AreaPage({ area }: { area: SeoArea }) {
  const city = area.city;
  const cityName = CITY_NAME[city];
  const prices = await getPrices();
  const waHref = trackedWhatsAppHref(`area-${area.slug}`, city, { area: area.slug });
  const others = areasIn(city).filter((a) => a.slug !== area.slug);
  const byCat = SERVICES.reduce<Record<string, SeoService[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/${city}/${area.slug}#local`,
    name: `Groomee ${area.name}`,
    parentOrganization: { "@id": BUSINESS_ID },
    url: `${SITE_URL}/${city}/${area.slug}`,
    telephone: WHATSAPP_DISPLAY,
    priceRange: "₦₦",
    address: { "@type": "PostalAddress", addressLocality: cityName, addressCountry: "NG" },
    areaServed: [area.name, ...area.nearby].map((n) => ({ "@type": "Place", name: `${n}, ${cityName}` })),
  };

  const faqs = [
    {
      q: `Do Groomee pros come to ${area.name}?`,
      a: `Yes. We cover ${area.name}${area.nearby.length ? ` including ${area.nearby.join(", ")}` : ""}. Message us your street or estate and the time you want.`,
    },
    ...COMMON_FAQS,
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero
        eyebrow={`Groomee · ${area.name}`}
        title={`Beauty pros at your door in ${area.name}`}
        lead={`${area.blurb} Braids, makeup, nails, lashes, barbing and facials from vetted, rated pros.`}
        crumbs={[
          { name: "Home", href: "/" },
          { name: cityName, href: `/${city}` },
          { name: area.name, href: `/${city}/${area.slug}` },
        ]}
        waHref={waHref}
        waLabel={`Book in ${area.name} on WhatsApp`}
        secondary={ONLINE_BOOKING[city] ? { href: `/search?zone=${area.slug}`, label: "Book online" } : undefined}
      />

      <section className="bg-white px-4 py-12">
        <div className="container max-w-4xl">
          <h2 className="font-display text-2xl font-black text-gray-950">Services and prices in {area.name}</h2>
          <p className="mt-2 text-sm text-gray-500">Typical price ranges. Your pro confirms the final price before they set off.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Object.entries(byCat).map(([cat, list]) => (
              <div key={cat} className="rounded-2xl border border-gray-200 bg-white/80 p-5 backdrop-blur">
                <h3 className="mb-3 font-bold text-gray-900">{CATEGORY_LABEL[cat] ?? cat}</h3>
                <ul className="space-y-2">
                  {list.map((s) => (
                    <li key={s.slug} className="flex justify-between gap-3 text-sm">
                      <Link href={`/${city}/${s.slug}`} className="text-gray-700 hover:text-gray-950 hover:underline">
                        {s.name}
                      </Link>
                      <span className="shrink-0 font-mono text-gray-500">{priceRange(prices[s.slug])}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {area.nearby.length > 0 && (
            <p className="mt-8 text-sm text-gray-600">
              Also covering: {area.nearby.join(", ")} and nearby streets.
            </p>
          )}
        </div>
      </section>

      <HowItWorks />
      <Faqs faqs={faqs} title={`Beauty at home in ${area.name}: questions people ask`} />

      <section className="bg-gray-50 px-4 py-12">
        <div className="container max-w-4xl">
          <h2 className="font-display text-xl font-black text-gray-950">Other areas in {cityName}</h2>
          <AreaChips city={city} areas={others} />
        </div>
      </section>

      <WhatsAppFab href={waHref} />
      <PageFooter />
    </>
  );
}

// ─── CITY HUB ────────────────────────────────────────────────────────────────

export function cityMetadata(city: CitySlug): Metadata {
  const cityName = CITY_NAME[city];
  const url = `${SITE_URL}/${city}`;
  const title = `Home Service Beauty in ${cityName}: Braids, Makeup, Nails & More | Groomee`;
  const description = `Book vetted beauty professionals to your home anywhere in ${cityName}. Braids, makeup, nails, lashes, barbing and facials with clear prices. Message Groomee on WhatsApp.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export async function CityHub({ city }: { city: CitySlug }) {
  const cityName = CITY_NAME[city];
  const prices = await getPrices();
  const waHref = trackedWhatsAppHref(`city-${city}`, city);
  return (
    <>
      <Hero
        eyebrow={`Groomee · ${cityName}`}
        title={`Home service beauty in ${cityName}`}
        lead={`Vetted hair, makeup, nail, lash, barbing and skincare pros who come to your home, hotel or office anywhere in ${cityName}. Clear prices, rated pros, booked in minutes on WhatsApp.`}
        crumbs={[
          { name: "Home", href: "/" },
          { name: cityName, href: `/${city}` },
        ]}
        waHref={waHref}
        waLabel={`Book in ${cityName} on WhatsApp`}
        secondary={ONLINE_BOOKING[city] ? { href: "/search", label: "Browse pros" } : undefined}
      />

      <section className="bg-white px-4 py-12">
        <div className="container max-w-5xl">
          <h2 className="font-display text-2xl font-black text-gray-950">Services in {cityName}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <ServiceCard key={s.slug} service={s} price={prices[s.slug]} href={`/${city}/${s.slug}`} />
            ))}
          </div>
          <h2 className="mt-12 font-display text-2xl font-black text-gray-950">Areas we cover</h2>
          <AreaChips city={city} areas={areasIn(city)} />
          <p className="mt-6 text-sm text-gray-600">
            See every price in one place on our <Link href="/prices" className="font-semibold underline">price list</Link>, or read the{" "}
            <Link href="/faq" className="font-semibold underline">FAQ</Link>.
          </p>
        </div>
      </section>

      <HowItWorks />
      <Faqs faqs={COMMON_FAQS} />
      <WhatsAppFab href={waHref} />
      <PageFooter />
    </>
  );
}
