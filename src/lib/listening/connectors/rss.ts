import { createHash } from "crypto";
import type { ListeningSource, ListeningTerm } from "@prisma/client";
import { findTerm, textTerms, type Connector, type RawMention } from "../types";

// Minimal RSS/Atom reader — feeds here are small and well-formed, so a
// dependency-free parser is enough.

function unescape(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

// Feeds carry HTML escaped inside XML (type="html"), so unescape before
// stripping tags, then once more for double-escaped entities (&amp;amp;).
function decode(s: string): string {
  const unwrapped = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return unescape(unescape(unwrapped).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : null;
}

function link(block: string): string | null {
  const href = block.match(/<link[^>]*href="([^"]+)"/i)?.[1];
  const raw = href ?? tag(block, "link");
  if (!raw) return null;
  // Google Alerts wraps targets in a google.com/url?url= redirect.
  try {
    const u = new URL(raw.replace(/&amp;/g, "&"));
    return u.hostname.endsWith("google.com") && u.searchParams.get("url")
      ? u.searchParams.get("url")
      : raw;
  } catch {
    return raw;
  }
}

export interface FeedItem {
  id: string;
  title: string;
  summary: string;
  url: string | null;
  author: string | null;
  postedAt: Date | null;
}

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "GroomeeListening/1.0 (+https://groomeeapp.com)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`feed ${url} → ${res.status}`);
  const xml = await res.text();
  const blocks = xml.match(/<(entry|item)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  return blocks.map((b) => {
    const url = link(b);
    const id = tag(b, "id") ?? tag(b, "guid") ?? url ?? tag(b, "title") ?? "";
    const date = tag(b, "published") ?? tag(b, "updated") ?? tag(b, "pubDate");
    return {
      id,
      title: tag(b, "title") ?? "",
      summary: tag(b, "content") ?? tag(b, "summary") ?? tag(b, "description") ?? "",
      url,
      author: tag(b, "name") ?? tag(b, "author") ?? tag(b, "dc:creator"),
      postedAt: date ? new Date(date) : null,
    };
  });
}

const hash = (s: string) => createHash("sha1").update(s).digest("hex");

function feedConnector(
  name: string,
  source: ListeningSource,
  feeds: () => string[],
  // Google Alerts feeds are already filtered by the alert query; other feeds
  // (Nairaland front page) must contain a tracked term to be kept.
  requireTerm: boolean,
): Connector {
  return {
    name,
    async run(terms: ListeningTerm[]) {
      const urls = feeds();
      if (urls.length === 0) return { source, mentions: [], skipped: "no feeds configured" };
      const candidates = textTerms(terms);
      const mentions: RawMention[] = [];
      for (const feedUrl of urls) {
        for (const item of await fetchFeed(feedUrl)) {
          const text = [item.title, item.summary].filter(Boolean).join(" — ");
          const term = findTerm(text, candidates);
          if (requireTerm && !term) continue;
          mentions.push({
            source,
            externalId: hash(item.id || text),
            url: item.url,
            authorHandle: item.author,
            text: text.slice(0, 4000),
            postedAt: item.postedAt && !isNaN(item.postedAt.getTime()) ? item.postedAt : null,
            matchedTerm: term?.term ?? null,
            competitor: term?.kind === "COMPETITOR" ? term.competitor ?? term.term : null,
          });
        }
      }
      return { source, mentions };
    },
  };
}

const list = (v?: string) =>
  (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Google Alerts → "Deliver to: RSS feed". Comma-separated feed URLs. */
export const googleAlertsConnector = feedConnector(
  "google-alerts",
  "GOOGLE_ALERTS",
  () => list(process.env.GOOGLE_ALERTS_FEEDS),
  false,
);

/** Nairaland publishes only a front-page feed; sections/search are bot-blocked. */
export const nairalandConnector = feedConnector(
  "nairaland",
  "NAIRALAND",
  () => (process.env.NAIRALAND_FEED_DISABLED ? [] : ["https://www.nairaland.com/feed"]),
  true,
);
