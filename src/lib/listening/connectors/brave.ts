import { createHash } from "crypto";
import type { ListeningTerm } from "@prisma/client";
import type { Connector, RawMention } from "../types";
import { isDue, markRun } from "../state";

// Brave Web Search — $5/1k requests with $5/month free credit. One query per
// BRAND/COMPETITOR term, once a day, past-day freshness: ~10 terms ≈ 300
// requests/month, inside the free credit.
const MAX_QUERIES = 12;

export const braveConnector: Connector = {
  name: "brave",
  async run(terms: ListeningTerm[]) {
    const key = process.env.BRAVE_API_KEY;
    if (!key) return { source: "WEB", mentions: [], skipped: "BRAVE_API_KEY not set" };
    if (!(await isDue("brave", 23))) return { source: "WEB", mentions: [], skipped: "ran <23h ago" };

    const queryTerms = terms
      .filter((t) => t.active && (t.kind === "BRAND" || t.kind === "COMPETITOR"))
      .slice(0, MAX_QUERIES);
    const mentions: RawMention[] = [];

    for (const t of queryTerms) {
      const q = t.kind === "BRAND" ? `"${t.term.replace(/^@/, "")}"` : `"${t.term}" Lagos OR Abuja`;
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", q);
      url.searchParams.set("freshness", "pd");
      url.searchParams.set("country", "NG");
      url.searchParams.set("count", "10");
      const res = await fetch(url, {
        headers: { Accept: "application/json", "X-Subscription-Token": key },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`brave ${res.status}`);
      const data = (await res.json()) as {
        web?: { results?: { url: string; title: string; description?: string; page_age?: string }[] };
      };
      for (const r of data.web?.results ?? []) {
        // Skip our own site.
        if (/groomee(app)?\.(com|ng)/i.test(r.url)) continue;
        mentions.push({
          source: "WEB",
          externalId: createHash("sha1").update(r.url).digest("hex"),
          url: r.url,
          text: `${r.title} — ${(r.description ?? "").replace(/<[^>]+>/g, "")}`.slice(0, 4000),
          postedAt: r.page_age ? new Date(r.page_age) : null,
          matchedTerm: t.term,
          competitor: t.kind === "COMPETITOR" ? t.competitor ?? t.term : null,
        });
      }
    }
    await markRun("brave");
    return { source: "WEB", mentions };
  },
};
