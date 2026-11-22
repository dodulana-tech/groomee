import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getPublicCities } from "@/lib/cities";
import { formatNaira } from "@/lib/utils";
import { trackedWhatsAppHref } from "@/lib/whatsapp-channel";
import { ACTIVE_PRO_TARGET_PER_ZONE, CATEGORY_LABEL, PRIORITY_ZONES } from "@/lib/pro-onboarding";
import Footer from "@/components/customer/Footer";

export const revalidate = 600;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomeeapp.com";
const APPLY_HREF = "/partner/onboarding?src=become-a-pro";
const PRO_SHARE = 0.8;

export const metadata: Metadata = {
  title: "Become a Beauty Professional in Lagos — Join Groomee",
  description:
    "Hair stylists, makeup artists, nail techs, lash techs and barbers in Lagos: get home-service bookings in Lekki, VI, Ikoyi, Yaba and Surulere. Keep 80% of every booking, get paid fast, and grow with free business tools.",
  alternates: { canonical: "/become-a-pro" },
  openGraph: {
    title: "Join Groomee as a beauty professional in Lagos",
    description:
      "Keep 80% of every booking. Transport money up front. Free wallet, savings, health cover and apprenticeships.",
    url: `${APP_URL}/become-a-pro`,
    type: "website",
  },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "How much does it cost to join Groomee?",
    a: "Nothing. There is no sign-up fee, no monthly fee and no salon rent. Groomee only earns a commission when you complete a booking.",
  },
  {
    q: "How much do I keep from each booking?",
    a: "You keep 80% of the service price on standard bookings, plus 70% of any urgency or after-hours fee. Higher tiers unlock better perks as your rating and job count grow.",
  },
  {
    q: "When and how do I get paid?",
    a: "Your earnings go into your Groomee wallet in stages: transport money when you accept and set off, most of the rest when you finish the job, and the balance when the customer confirms. Payouts go straight to the Nigerian bank account you verify in your portal.",
  },
  {
    q: "How does vetting work?",
    a: "Apply online in about 3 minutes. Our team reviews every application personally, usually within 24 hours on weekdays, and may WhatsApp you for photos of recent work. You complete ID verification before your first booking.",
  },
  {
    q: "Which areas need beauty professionals most?",
    a: `Right now: ${PRIORITY_ZONES.join(", ")}. You choose the areas you can reach and only get offered jobs there.`,
  },
  {
    q: "Do I need my own tools and products?",
    a: "Yes, you bring your own kit. The partner portal includes a free inventory tracker that warns you before you run low on the products your services use.",
  },
  {
    q: "Can I train apprentices through Groomee?",
    a: "Yes. Established pros can take on apprentices, earn a share of the jobs they complete, and guide them to Freedom, our graduation to a fully independent pro.",
  },
  {
    q: "Can I choose when I work?",
    a: "Always. Go online when you want jobs and offline when you don't, from your dashboard or by texting ON or OFF to Groomee on WhatsApp.",
  },
];

const TOOLS = [
  { icon: "👛", title: "Wallet & fast payouts", desc: "Watch every naira land, stage by stage. Transport money arrives before you leave home." },
  { icon: "🏦", title: "Earnings Reserve", desc: "Put a slice of each job aside for rent, school fees or new tools, with a match bonus when you plan ahead." },
  { icon: "🛡️", title: "Health cover", desc: "Affordable cover paid from your wallet, with Groomee subsidising more as you move up tiers." },
  { icon: "📦", title: "Inventory tracker", desc: "Know what each service uses and get a nudge before you run out of stock." },
  { icon: "🎓", title: "Apprenticeships", desc: "Train apprentices under your name, earn from their jobs and graduate them to Freedom." },
  { icon: "📅", title: "Calendar & schedule", desc: "Set your hours and see every booking in one place, on your phone." },
];

const STEPS = [
  { n: "1", t: "Apply in 3 minutes", d: "Your services, the areas you cover and (optionally) your bank. No fee." },
  { n: "2", t: "Quick vetting", d: "We review personally, usually within 24 hours, and may ask for photos of your work." },
  { n: "3", t: "Get approved", d: "You receive a WhatsApp welcome with your partner portal link." },
  { n: "4", t: "Go online, get booked", d: "Add your photo and prices, verify your bank, then go online for your first job." },
];

export default async function BecomeAProPage() {
  const [services, zones, publicCities, abujaZones] = await Promise.all([
    db.service.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { name: true, category: true, basePrice: true },
    }),
    db.zone.findMany({
      where: { name: { in: [...PRIORITY_ZONES] } },
      select: { name: true, _count: { select: { pros: { where: { pro: { status: "ACTIVE" } } } } } },
    }),
    getPublicCities(),
    db.zone.findMany({ where: { cityRel: { slug: "abuja" } }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  // One representative service per category for the "what you keep" table.
  const examples = Object.values(
    services.reduce<Record<string, (typeof services)[number]>>((acc, s) => {
      acc[s.category] ??= s;
      return acc;
    }, {}),
  ).slice(0, 6);

  const openings = PRIORITY_ZONES.map((name) => {
    const active = zones.find((z) => z.name === name)?._count.pros ?? 0;
    return { name, open: Math.max(0, ACTIVE_PRO_TARGET_PER_ZONE - active) };
  });

  const waHref = trackedWhatsAppHref("become-a-pro");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-16 sm:py-24" style={{ background: "#014342" }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_15%_30%,rgba(83,235,100,0.25),transparent_60%),radial-gradient(ellipse_40%_60%_at_90%_20%,rgba(255,254,161,0.14),transparent_55%)]" />
        <div className="container relative z-10 max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#53eb64" }}>
            For beauty professionals · Lagos
          </p>
          <h1 className="font-display text-3xl font-black text-white sm:text-5xl">
            Join Groomee as a beauty professional in Lagos
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/70">
            Hair, makeup, nails, lashes, barbing and skincare pros: get home-service bookings near you,
            keep 80% of every job, and get the money tools a salon never gave you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={APPLY_HREF}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-7 py-4 text-base font-bold transition-all hover:-translate-y-0.5 sm:w-auto"
              style={{ background: "#53eb64", color: "#014342" }}
            >
              Apply in 3 minutes →
            </Link>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-7 py-4 text-base font-bold text-white backdrop-blur transition-all hover:bg-white/20 sm:w-auto"
            >
              💬 Ask us on WhatsApp
            </a>
          </div>
          <p className="mt-4 text-xs text-white/50">No sign-up fee · No monthly charge · Choose your own hours</p>
        </div>
      </section>

      {/* Where we need pros */}
      <section className="bg-white px-4 py-12">
        <div className="container max-w-4xl">
          <h2 className="font-display text-2xl font-black text-gray-950">Where we need beauty professionals now</h2>
          <p className="mt-2 text-sm text-gray-500">
            Customers in these areas are booking. Pick the ones you can reach and we only send you jobs there.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {openings.map((o) => (
              <li key={o.name} className="rounded-2xl border border-gray-200 bg-white/80 p-4 backdrop-blur">
                <p className="font-bold text-gray-900">{o.name}</p>
                <p className="mt-1 text-xs font-semibold" style={{ color: o.open > 0 ? "#014342" : "#6b7280" }}>
                  {o.open > 0 ? `${o.open} spots open` : "Waitlist open"}
                </p>
              </li>
            ))}
          </ul>
          {abujaZones.length > 0 && (
            <p className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <strong>In Abuja?</strong> We&apos;re onboarding pros in {abujaZones.map((z) => z.name).join(", ")} too.
              Apply the same way and pick your Abuja areas.
            </p>
          )}
        </div>
      </section>

      {/* Earnings */}
      <section className="bg-gray-50 px-4 py-12">
        <div className="container max-w-4xl">
          <h2 className="font-display text-2xl font-black text-gray-950">What you earn and keep</h2>
          <p className="mt-2 text-sm text-gray-500">
            You set your price inside a fair range for each service. Here&apos;s what you keep at typical prices.
          </p>
          {examples.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white/80 backdrop-blur">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-4 py-3 text-right font-semibold">Typical price</th>
                    <th className="px-4 py-3 text-right font-semibold">You keep</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {examples.map((s) => (
                    <tr key={s.name}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{s.name}</span>
                        <span className="block text-xs text-gray-400">{CATEGORY_LABEL[s.category] ?? s.category}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-600">{formatNaira(s.basePrice)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: "#014342" }}>
                        {formatNaira(Math.round(s.basePrice * PRO_SHARE))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ul className="mt-6 grid gap-3 text-sm text-gray-700 sm:grid-cols-3">
            <li className="rounded-2xl border border-gray-200 bg-white/80 p-4">
              <strong className="block text-gray-900">80% of the service price</strong>
              Plus 70% of urgency and after-hours fees.
            </li>
            <li className="rounded-2xl border border-gray-200 bg-white/80 p-4">
              <strong className="block text-gray-900">Transport money up front</strong>
              Part of your pay is released when you accept and set off.
            </li>
            <li className="rounded-2xl border border-gray-200 bg-white/80 p-4">
              <strong className="block text-gray-900">No chasing payments</strong>
              Customers pay Groomee; you get paid to your verified bank.
            </li>
          </ul>
        </div>
      </section>

      {/* Vetting */}
      <section className="bg-white px-4 py-12">
        <div className="container max-w-4xl">
          <h2 className="font-display text-2xl font-black text-gray-950">How joining and vetting works</h2>
          <p className="mt-2 text-sm text-gray-500">
            Every Groomee pro is reviewed by a person. That&apos;s why customers trust you before you knock.
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl border border-gray-200 bg-white/80 p-5 backdrop-blur">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black"
                  style={{ background: "#fffea1", color: "#014342" }}
                >
                  {s.n}
                </span>
                <p className="mt-3 font-bold text-gray-900">{s.t}</p>
                <p className="mt-1 text-sm text-gray-500">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tools */}
      <section className="px-4 py-12" style={{ background: "linear-gradient(180deg,#f0fdf4 0%,#ffffff 100%)" }}>
        <div className="container max-w-4xl">
          <h2 className="font-display text-2xl font-black text-gray-950">Free tools in your partner portal</h2>
          <p className="mt-2 text-sm text-gray-500">More than bookings: a business that protects you.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <div key={t.title} className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
                <span className="text-2xl" aria-hidden>{t.icon}</span>
                <p className="mt-2 font-bold text-gray-900">{t.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white px-4 py-12">
        <div className="container max-w-3xl">
          <h2 className="font-display text-2xl font-black text-gray-950">Questions beauty professionals ask</h2>
          <div className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-200">
            {FAQS.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-900">
                  {f.q}
                  <span className="text-gray-400 transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-14" style={{ background: "#014342" }}>
        <div className="container max-w-2xl text-center">
          <h2 className="font-display text-2xl font-black text-white sm:text-3xl">Ready to get booked?</h2>
          <p className="mt-2 text-sm text-white/70">Apply now. Most pros hear back within a day.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={APPLY_HREF}
              className="inline-flex w-full items-center justify-center rounded-xl px-7 py-4 text-base font-bold sm:w-auto"
              style={{ background: "#53eb64", color: "#014342" }}
            >
              Start my application →
            </Link>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/10 px-7 py-4 text-base font-bold text-white sm:w-auto"
            >
              💬 Chat with us first
            </a>
          </div>
          <p className="mt-4 text-xs text-white/50">
            Already a pro? <Link href="/partner/login" className="font-semibold text-white/80 underline">Sign in</Link>
          </p>
        </div>
      </section>

      <Footer
        liveCities={publicCities.filter((c) => c.status === "LIVE")}
        waitlistCities={publicCities.filter((c) => c.status === "WAITLIST")}
      />
    </>
  );
}
