import Link from "next/link";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { formatNaira } from "@/lib/utils";
import { GROOMEE_WHATSAPP } from "@/lib/whatsapp-channel";
import { SERVICES, type SeoService } from "@/lib/seo/content";
import { PRICE_RESEARCH } from "@/lib/seo/price-research";

export type LivePrice = { min: number; max: number; mins: number };

/** Live catalogue prices by slug, falling back to the researched ranges. */
export async function getPrices(): Promise<Record<string, LivePrice>> {
  const out: Record<string, LivePrice> = Object.fromEntries(
    SERVICES.map((s) => {
      const r = PRICE_RESEARCH[s.slug];
      return [s.slug, r ? { min: r.min, max: r.max, mins: s.fallback.mins } : s.fallback];
    }),
  );
  try {
    const rows = await db.service.findMany({
      where: { isActive: true, slug: { in: SERVICES.map((s) => s.slug) } },
      select: { slug: true, minPrice: true, maxPrice: true, durationMins: true },
    });
    for (const r of rows) {
      out[r.slug] = { min: r.minPrice, max: r.maxPrice, mins: r.durationMins };
    }
  } catch {
    // DB unavailable at build time: curated ranges are fine.
  }
  return out;
}

/** Full range, for machine-readable places (llms.txt, JSON-LD). */
export function priceRange(p: LivePrice) {
  return `${formatNaira(p.min)} – ${formatNaira(p.max)}`;
}

/** What customers see: the starting price. */
export function fromPrice(p: LivePrice) {
  return `From ${formatNaira(p.min)}`;
}

export function duration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = mins / 60;
  return Number.isInteger(h) ? `${h} hr` : `${h.toFixed(1)} hrs`;
}

export const WHATSAPP_DISPLAY = `+${GROOMEE_WHATSAPP.slice(0, 3)} ${GROOMEE_WHATSAPP.slice(3, 6)} ${GROOMEE_WHATSAPP.slice(6, 9)} ${GROOMEE_WHATSAPP.slice(9)}`;

export function WhatsAppButton({
  href,
  children,
  size = "lg",
}: {
  href: string;
  children: React.ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-gray-950 transition-all hover:-translate-y-0.5 hover:bg-[#3be07a] hover:shadow-[0_8px_24px_rgba(37,211,102,0.35)] ${
        size === "lg" ? "px-7 py-4 text-base" : "px-5 py-3 text-sm"
      }`}
    >
      💬 {children}
    </a>
  );
}

/** Fixed WhatsApp button on marketing pages; sits above the mobile nav. */
export function WhatsAppFab({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Groomee on WhatsApp"
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-2xl shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition-transform hover:scale-105 lg:bottom-6 lg:right-6"
    >
      💬
    </a>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.href}`,
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="text-xs text-white/50">
        {items.map((it, i) => (
          <span key={it.href}>
            {i > 0 && <span className="mx-1.5">/</span>}
            {i < items.length - 1 ? (
              <Link href={it.href} className="hover:text-white/80">
                {it.name}
              </Link>
            ) : (
              <span className="text-white/70">{it.name}</span>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}

export function Faqs({ faqs, title = "Questions people ask" }: { faqs: { q: string; a: string }[]; title?: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <section className="bg-white px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container max-w-3xl">
        <h2 className="font-display text-2xl font-black text-gray-950">{title}</h2>
        <div className="mt-6 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-900">
                {f.q}
                <span className="text-gray-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { t: "Message us", d: "Tell us the service, your area and when. A photo of the style helps." },
    { t: "Get matched", d: "We confirm a vetted pro near you and the price, usually within the hour." },
    { t: "They come to you", d: "Your pro arrives with their tools. You rate them after." },
  ];
  return (
    <section className="bg-gray-50 px-4 py-12">
      <div className="container max-w-4xl">
        <h2 className="font-display text-2xl font-black text-gray-950">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="rounded-2xl border border-gray-200 bg-white/80 p-5 backdrop-blur">
              <span className="text-xs font-bold text-[#25D366]">Step {i + 1}</span>
              <h3 className="mt-1 font-bold text-gray-900">{s.t}</h3>
              <p className="mt-1 text-sm text-gray-600">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ServiceCard({ service, price, href }: { service: SeoService; price: LivePrice; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-gray-200 bg-white/80 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-[#25D366]/60 hover:shadow-md"
    >
      <h3 className="font-bold text-gray-900">{service.name}</h3>
      <p className="mt-1 font-mono text-sm text-gray-500">{fromPrice(price)}</p>
      <p className="mt-2 line-clamp-2 text-sm text-gray-600">{service.intro}</p>
    </Link>
  );
}
