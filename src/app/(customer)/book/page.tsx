import type { Metadata } from "next";
import { db } from "@/lib/db";
import { AREAS, CATEGORY_LABEL, SERVICES, serviceBySlug } from "@/lib/seo/content";
import { getPrices, priceRange, WHATSAPP_DISPLAY } from "@/components/seo/blocks";
import BookRequestForm from "./BookRequestForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a beauty pro at home | Groomee",
  description:
    "Tell us what you need and when. Our team matches you with a vetted beauty pro in Abuja and confirms on WhatsApp. Lagos is coming soon.",
  alternates: { canonical: "/book" },
  robots: { index: false, follow: true },
};

/** Map any incoming service slug (SEO or catalogue) to an SEO service slug. */
async function resolveService(slug?: string): Promise<string | null> {
  if (!slug) return null;
  if (serviceBySlug(slug)) return slug;
  try {
    const row = await db.service.findUnique({ where: { slug }, select: { category: true } });
    return SERVICES.find((s) => s.category === row?.category)?.slug ?? null;
  } catch {
    return null;
  }
}

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const prices = await getPrices();
  const service = await resolveService(sp.service);
  const city = sp.city === "abuja" ? "abuja" : sp.city === "lagos" ? "lagos" : null;
  const area = sp.area && AREAS.some((a) => a.slug === sp.area) ? sp.area : null;

  const services = SERVICES.map((s) => ({
    slug: s.slug,
    name: s.name,
    group: CATEGORY_LABEL[s.category] ?? "More",
    price: priceRange(prices[s.slug]),
  }));

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-[#f7f5f0] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Book on WhatsApp</p>
        <h1 className="mt-2 font-display text-3xl font-black leading-tight text-gray-950 sm:text-4xl">
          Tell us what you need.
          <br />
          We&apos;ll send the right pro.
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          Fill this in, tap the button, and WhatsApp opens with your request ready to send. Our team replies
          with an available pro, the price and a secure Groomee payment link to confirm.
        </p>

        <BookRequestForm
          services={services}
          areas={AREAS.map((a) => ({ slug: a.slug, name: a.name, city: a.city }))}
          initial={{ service, city: city ?? (area ? AREAS.find((a) => a.slug === area)!.city : "abuja"), area, when: sp.when === "asap" ? "asap" : null }}
        />

        <ul className="mt-8 grid gap-3 text-sm text-gray-600 sm:grid-cols-3">
          <li className="rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur">✅ Vetted, rated pros</li>
          <li className="rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur">🏠 Home, hotel or office</li>
          <li className="rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur">🔒 Pay securely via Groomee</li>
        </ul>
        <p className="mt-6 text-center text-xs text-gray-500">
          Prefer to just chat? Message us on WhatsApp at {WHATSAPP_DISPLAY}.
        </p>
      </div>
    </div>
  );
}
