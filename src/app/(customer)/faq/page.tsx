import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import { trackedWhatsAppHref } from "@/lib/whatsapp-channel";
import { AREAS, COMMON_FAQS } from "@/lib/seo/content";
import { Faqs, WhatsAppButton, WhatsAppFab } from "@/components/seo/blocks";
import { getPublicCities } from "@/lib/cities";
import Footer from "@/components/customer/Footer";

export const revalidate = 3600;

const title = "Groomee FAQ: Home Service Beauty in Abuja";
const description =
  "How Groomee works: booking a vetted beauty pro to your home on WhatsApp, prices, payment, areas covered in Abuja, Lagos (coming soon), and becoming a pro.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: { title, description, url: `${SITE_URL}/faq` },
};

const lagosAreas = AREAS.filter((a) => a.city === "lagos").map((a) => a.name);
const abujaAreas = AREAS.filter((a) => a.city === "abuja").map((a) => a.name);

const FAQS = [
  {
    q: "What is Groomee?",
    a: "Groomee is a home service beauty platform in Nigeria. We connect you with vetted hair stylists, braiders, makeup artists, nail technicians, lash technicians, barbers and skincare professionals who come to your home, hotel or office.",
  },
  ...COMMON_FAQS,
  {
    q: "Which areas do you cover?",
    a: `Abuja: ${abujaAreas.join(", ")} and nearby, booked by our team on WhatsApp. Lagos (${lagosAreas.slice(0, 4).join(", ")} and more) is coming soon; message us to join the launch list.`,
  },
  {
    q: "What services can I book?",
    a: "Knotless and box braids, locs, weave installation, natural hair styling, full glam, natural and bridal makeup, gel and acrylic nails, nail art, barbing and beard grooming, lash extensions and lifts, and facials.",
  },
  {
    q: "Can I book Groomee as a gift?",
    a: "Yes. You can buy a Groomee gift from our website, or message us on WhatsApp and we will arrange it.",
  },
  {
    q: "How do I become a Groomee beauty pro?",
    a: "Apply online on our website. Our team reviews your identity and work, and once you are approved you get bookings, a wallet, savings and growth tools in the Groomee pro portal.",
  },
];

export default async function FaqPage() {
  const cities = await getPublicCities();
  const waHref = trackedWhatsAppHref("faq");
  return (
    <>
      <section className="bg-gray-950 px-4 py-14">
        <div className="container max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#25D366]">Groomee · FAQ</p>
          <h1 className="font-display text-3xl font-black text-white sm:text-5xl">Questions, answered</h1>
          <p className="mt-4 max-w-xl text-base text-white/65">
            Everything about booking a vetted beauty pro to your door in Abuja (Lagos coming soon). Can&apos;t find your
            answer? Ask us on WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <WhatsAppButton href={waHref}>Ask on WhatsApp</WhatsAppButton>
            <Link href="/prices" className="rounded-xl border border-white/20 px-6 py-4 text-sm font-semibold text-white/80 hover:text-white">
              See prices
            </Link>
          </div>
        </div>
      </section>
      <Faqs faqs={FAQS} title="Frequently asked questions" />
      <WhatsAppFab href={waHref} />
      <Footer
        liveCities={cities.filter((c) => c.status === "LIVE")}
        waitlistCities={cities.filter((c) => c.status === "WAITLIST")}
      />
    </>
  );
}
