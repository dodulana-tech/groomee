import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { getPublicCities } from "@/lib/cities";
import { trackedWhatsAppHref } from "@/lib/whatsapp-channel";
import { serviceBySlug } from "@/lib/seo/content";
import Footer from "@/components/customer/Footer";
import {
  Breadcrumbs,
  Faqs,
  ServiceCard,
  WHATSAPP_DISPLAY,
  WhatsAppButton,
  WhatsAppFab,
  getPrices,
} from "@/components/seo/blocks";

// Seasonal page for December in Lagos (and Abuja): parties, owambe, weddings
// and visitors flying home. Published early so search and assistants have
// it indexed before the rush.
export const revalidate = 3600;

const title = "Detty December Glam in Lagos & Abuja: Makeup, Braids & Nails at Home | Groomee";
const description =
  "Owambe, wedding guest and party-ready glam at your home, hotel or Airbnb in Lagos and Abuja this December. Vetted makeup artists, braiders and nail techs. December fills fast: book ahead on WhatsApp.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: `${SITE_URL}/detty-december` },
  openGraph: { title, description, url: `${SITE_URL}/detty-december`, type: "website" },
};

const FEATURED = ["full-glam-makeup", "bridal-makeup", "knotless-braids", "gel-nails", "volume-lashes", "fade-shape-up"];

const FAQS = [
  {
    q: "How early should I book for December in Lagos?",
    a: "As early as you can. Weekends from mid-December to New Year are the busiest days of the year for makeup artists and braiders. Message us your dates now and we will hold a pro for you.",
  },
  {
    q: "I'm flying in for December. Can a pro come to my hotel or Airbnb?",
    a: "Yes. Pros come to homes, hotels, short-lets and Airbnbs. Send us the address and your gate or reception instructions when you book. You can message us on WhatsApp before you land.",
  },
  {
    q: "Can you do makeup for my whole group or bridal party?",
    a: "Yes. Tell us how many people, the time you need to leave and the venue, and we will send enough artists to keep to your schedule.",
  },
  {
    q: "Can I get braids done before a December trip or event?",
    a: "Yes. Knotless and box braids take 3 to 5 hours, so book a day or two before your event. Share the size and length you want so we send a braider with the right time free.",
  },
  {
    q: "Are prices different in December?",
    a: "Each service page shows the typical price range. Your pro confirms the exact price before they set off, so you know the cost before you agree.",
  },
];

export default async function DettyDecemberPage() {
  const [prices, cities] = await Promise.all([getPrices(), getPublicCities()]);
  const waHref = trackedWhatsAppHref("detty-december");
  const featured = FEATURED.map((s) => serviceBySlug(s)).filter((s): s is NonNullable<typeof s> => !!s);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "December party, owambe and wedding glam at home",
    url: `${SITE_URL}/detty-december`,
    provider: { "@id": `${SITE_URL}/#business` },
    areaServed: [
      { "@type": "City", name: "Lagos" },
      { "@type": "City", name: "Abuja" },
    ],
    serviceType: ["Makeup", "Hair braiding", "Nails", "Lash extensions", "Barbing"],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="relative overflow-hidden bg-gray-950 px-4 pb-16 pt-8 sm:pb-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_20%_40%,rgba(255,254,161,0.16),transparent_60%),radial-gradient(ellipse_50%_70%_at_85%_30%,rgba(37,211,102,0.2),transparent_55%)]" />
        <div className="container relative z-10 max-w-3xl">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Detty December", href: "/detty-december" }]} />
          <p className="mb-3 mt-8 text-xs font-bold uppercase tracking-widest text-[#fffea1]">Detty December · Lagos &amp; Abuja</p>
          <h1 className="font-display text-3xl font-black text-white sm:text-5xl">
            December-ready glam, at your door.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">
            Owambe, weddings, concerts and back-to-back parties. Vetted makeup artists, braiders, nail and lash techs
            come to your home, hotel or Airbnb, so you skip the salon queue and the traffic. December fills
            fast, so lock in your dates now.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <WhatsAppButton href={waHref}>Book my December glam</WhatsAppButton>
            <Link
              href="/prices"
              className="rounded-xl border border-white/20 px-6 py-4 text-sm font-semibold text-white/80 backdrop-blur hover:text-white"
            >
              See prices
            </Link>
          </div>
          <p className="mt-3 text-xs text-white/40">WhatsApp {WHATSAPP_DISPLAY} · flying in? Message us before you land</p>
        </div>
      </section>

      <section className="bg-white px-4 py-12">
        <div className="container grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { t: "Owambe & parties", d: "Full glam with lashes that lasts the whole night, plus a touch-up before you leave." },
            { t: "Weddings & bridal parties", d: "Bride, bridesmaids and family on one booking, timed to your schedule." },
            { t: "Flying in for December", d: "Hotel, short-let and Airbnb visits. Book on WhatsApp before your flight." },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-gray-200 bg-white/80 p-5 backdrop-blur">
              <h2 className="font-bold text-gray-900">{c.t}</h2>
              <p className="mt-1 text-sm text-gray-600">{c.d}</p>
            </div>
          ))}
        </div>
        <div className="container mt-10 max-w-4xl">
          <h2 className="font-display text-2xl font-black text-gray-950">Most booked in December</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => (
              <ServiceCard key={s.slug} service={s} price={prices[s.slug]} href={`/lagos/${s.slug}`} />
            ))}
          </div>
        </div>
      </section>

      <Faqs faqs={FAQS} title="Detty December: questions people ask" />

      <section className="bg-gray-950 px-4 py-12 text-center">
        <h2 className="font-display text-2xl font-black text-white">Got your December dates?</h2>
        <p className="mt-2 text-sm text-white/60">Send them now and we&apos;ll hold a pro for you.</p>
        <div className="mt-6">
          <WhatsAppButton href={waHref}>Message us on WhatsApp</WhatsAppButton>
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
