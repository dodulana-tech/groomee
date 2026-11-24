import Link from "next/link";
import { CATEGORY_LABEL, SERVICES } from "@/lib/seo/content";
import { getPrices, fromPrice } from "@/components/seo/blocks";
import { bookHref } from "@/lib/booking-mode";

const ICON: Record<string, string> = {
  HAIR: "💇🏿‍♀️", MAKEUP: "💄", NAILS: "💅🏿", BARBING: "✂️", LASHES: "👁️", SKINCARE: "✨", OTHER: "🌿",
};

/**
 * Homepage "Browse" for WhatsApp mode: services and typical prices, each
 * leading to the /book request form. No pro cards.
 */
export default async function ServiceMenu() {
  const prices = await getPrices();
  const groups = new Map<string, typeof SERVICES>();
  for (const s of SERVICES) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);

  return (
    <section id="services" className="section bg-white">
      <div className="container">
        <div className="section-header">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-600">Browse</p>
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            Everything you need,
            <br />
            <span className="text-brand-600">at your doorstep</span>
          </h2>
          <p className="mt-4 max-w-lg text-base text-gray-500">
            Pick a service, tell us when, and our team matches you with a vetted pro on WhatsApp.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...groups.entries()].map(([cat, list]) => (
            <div key={cat} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500">
                <span className="text-lg">{ICON[cat] ?? "✨"}</span> {CATEGORY_LABEL[cat] ?? cat}
              </h3>
              <ul className="mt-3 divide-y divide-gray-100">
                {list.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={bookHref({ service: s.slug })}
                      className="group flex items-center justify-between gap-3 py-2.5"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-gray-900 group-hover:text-brand-700">{s.name}</span>
                        <span className="block text-xs text-gray-500">{fromPrice(prices[s.slug])}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-[#25D366]/15 px-3 py-1 text-xs font-bold text-[#128C4A] group-hover:bg-[#25D366] group-hover:text-gray-950">
                        Book
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/book"
            className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-7 py-4 text-base font-bold text-gray-950 transition-all hover:-translate-y-0.5 hover:bg-[#3be07a]"
          >
            💬 Book on WhatsApp
          </Link>
        </div>
      </div>
    </section>
  );
}
