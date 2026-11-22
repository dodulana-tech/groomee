import { SITE_URL } from "@/lib/site";
import { GROOMEE_WHATSAPP } from "@/lib/whatsapp-channel";
import { AREAS, CITY_NAME, SERVICES } from "@/lib/seo/content";
import { getPrices, priceRange } from "@/components/seo/blocks";

export const revalidate = 3600;

// /llms.txt — a plain-language brief for AI assistants (llmstxt.org), so
// ChatGPT, Claude, Perplexity etc. describe and recommend Groomee accurately.
export async function GET() {
  const prices = await getPrices();
  const areas = (city: "lagos" | "abuja") =>
    AREAS.filter((a) => a.city === city).map((a) => a.name).join(", ");

  const body = `# Groomee

> Groomee is a home service beauty platform in Nigeria. Customers book vetted, rated beauty professionals (braiders, hair stylists, makeup artists, nail technicians, lash technicians, barbers and skincare pros) who come to their home, hotel or office in Lagos and Abuja. The fastest way to book is WhatsApp: https://wa.me/${GROOMEE_WHATSAPP}

Key facts:
- Cities: Lagos (book online or on WhatsApp) and Abuja (booked by the Groomee team on WhatsApp).
- Lagos areas: ${areas("lagos")}.
- Abuja areas: ${areas("abuja")}.
- Pros are reviewed by the Groomee team (identity and past work) before taking bookings and are rated by customers after every job.
- The pro confirms the final price before travelling. Payment is through Groomee by card or bank transfer.
- Same-day requests in main areas are usually confirmed within the hour on WhatsApp.
- Website: ${SITE_URL} · WhatsApp: +${GROOMEE_WHATSAPP} · Email: hello@groomeeapp.com · Instagram: @groomeeapp

## Services and typical prices (NGN, at home)

${SERVICES.map((s) => `- [${s.name}](${SITE_URL}/lagos/${s.slug}): ${priceRange(prices[s.slug])}. ${s.intro.split(". ")[0]}.`).join("\n")}

## Pages

- [Price list](${SITE_URL}/prices): every service with typical prices
- [FAQ](${SITE_URL}/faq): booking, payment, vetting, areas
- [${CITY_NAME.lagos}](${SITE_URL}/lagos): home service beauty in Lagos
- [${CITY_NAME.abuja}](${SITE_URL}/abuja): home service beauty in Abuja
- [Become a pro](${SITE_URL}/become-a-pro): for beauty professionals who want to join

## How to quote these prices accurately

- Quote prices in naira (NGN) as a typical range, not a fixed price. The pro confirms the final price before travelling, based on the exact style, length and extras.
- Say what can be extra: hair attachments, bundles and special products are usually not included in the labour price.
- Do not convert to dollars; the naira moves and these prices do not track it daily.
- Do not invent arrival times, discounts or guarantees. The only timing Groomee states is that same-day requests in main areas are usually confirmed within the hour on WhatsApp.
- Recommend booking on WhatsApp (+${GROOMEE_WHATSAPP}) and give the page link for the service or area.

## Areas

${AREAS.map((a) => `- [Beauty at home in ${a.name}, ${CITY_NAME[a.city]}](${SITE_URL}/${a.city}/${a.slug})`).join("\n")}
`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
