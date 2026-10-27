/**
 * Social listening runner — called hourly by /api/cron/listening.
 *
 * connectors → dedupe insert → Claude classification → WhatsApp alerts for
 * urgent items → 90-day purge of un-actioned rows (NDPA data minimisation).
 */
import type { ListeningTermKind } from "@prisma/client";
import { db } from "@/lib/db";
import { sendMessage } from "@/lib/whatsapp";
import { classifyPending } from "./classify";
import type { Connector, ConnectorResult, RawMention } from "./types";
import { googleAlertsConnector, nairalandConnector } from "./connectors/rss";
import { braveConnector } from "./connectors/brave";
import { instagramConnector } from "./connectors/instagram";
import { xConnector } from "./connectors/x";

export const CONNECTORS: Connector[] = [
  googleAlertsConnector,
  nairalandConnector,
  braveConnector,
  instagramConnector,
  xConnector,
];

const RETENTION_DAYS = 90;

// Seeded on first run so the inbox works out of the box; admins edit them in
// /admin/listening. Competitor handles were not verifiable — add them by hand.
export const DEFAULT_TERMS: { term: string; kind: ListeningTermKind; competitor?: string }[] = [
  { term: "groomee", kind: "BRAND" },
  { term: "@groomeeapp", kind: "BRAND" },
  { term: "groomeeapp", kind: "BRAND" },
  { term: "Beauty Butler", kind: "COMPETITOR", competitor: "Beauty Butler" },
  { term: "Glown", kind: "COMPETITOR", competitor: "Glown" },
  { term: "Kirava", kind: "COMPETITOR", competitor: "Kirava" },
  { term: "TushPlug", kind: "COMPETITOR", competitor: "TushPlug" },
  { term: "need a braider", kind: "LEAD" },
  { term: "home service makeup", kind: "LEAD" },
  { term: "home service braids", kind: "LEAD" },
  { term: "home service nails", kind: "LEAD" },
  { term: "barber home service", kind: "LEAD" },
  { term: "makeup artist in abuja", kind: "LEAD" },
  { term: "lagosbraider", kind: "HASHTAG" },
  { term: "lekkimakeupartist", kind: "HASHTAG" },
  { term: "lagosmakeupartist", kind: "HASHTAG" },
  { term: "lagosnails", kind: "HASHTAG" },
  { term: "abujamakeupartist", kind: "HASHTAG" },
  { term: "abujanails", kind: "HASHTAG" },
  { term: "abujabraids", kind: "HASHTAG" },
  { term: "abujahairstylist", kind: "HASHTAG" },
];

export async function ensureDefaultTerms() {
  if ((await db.listeningTerm.count()) > 0) return;
  await db.listeningTerm.createMany({ data: DEFAULT_TERMS, skipDuplicates: true });
}

export async function insertMentions(mentions: RawMention[]): Promise<number> {
  if (mentions.length === 0) return 0;
  const res = await db.socialMention.createMany({
    data: mentions.map((m) => ({
      source: m.source,
      externalId: m.externalId,
      url: m.url ?? null,
      authorHandle: m.authorHandle ?? null,
      text: m.text,
      postedAt: m.postedAt ?? null,
      matchedTerm: m.matchedTerm ?? null,
      competitor: m.competitor ?? null,
    })),
    skipDuplicates: true,
  });
  return res.count;
}

/** WhatsApp admins once per urgent item: HIGH urgency, or any COMPLAINT about us. */
export async function sendUrgentAlerts(): Promise<number> {
  const urgent = await db.socialMention.findMany({
    where: {
      alertedAt: null,
      relevant: true,
      status: "NEW",
      OR: [{ urgency: "HIGH" }, { intent: "COMPLAINT" }],
      createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    },
    take: 10,
  });
  const phones = (process.env.ADMIN_PHONES ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomeeapp.com";
  for (const m of urgent) {
    const msg = [
      `🔔 *Groomee listening — ${m.intent?.toLowerCase().replace("_", " ")} (${m.urgency})*`,
      `${m.source}${m.authorHandle ? ` · ${m.authorHandle}` : ""}${m.city ? ` · ${m.city}` : ""}`,
      m.summary ?? m.text.slice(0, 200),
      m.url ?? "",
      `Inbox: ${appUrl}/admin/listening`,
    ].filter(Boolean).join("\n");
    for (const to of phones) await sendMessage(to, msg);
    await db.socialMention.update({ where: { id: m.id }, data: { alertedAt: new Date() } });
  }
  return urgent.length;
}

export async function purgeExpired(): Promise<number> {
  const res = await db.socialMention.deleteMany({
    where: {
      status: { in: ["NEW", "IGNORED"] },
      createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000) },
    },
  });
  return res.count;
}

export async function runListening() {
  await ensureDefaultTerms();
  const terms = await db.listeningTerm.findMany({ where: { active: true } });

  const sources: Record<string, { fetched: number; inserted: number; skipped?: string; error?: string }> = {};
  for (const c of CONNECTORS) {
    let result: ConnectorResult;
    try {
      result = await c.run(terms);
    } catch (err) {
      console.error(`[listening] ${c.name} failed`, err);
      sources[c.name] = { fetched: 0, inserted: 0, error: err instanceof Error ? err.message : String(err) };
      continue;
    }
    const inserted = await insertMentions(result.mentions);
    sources[c.name] = { fetched: result.mentions.length, inserted, skipped: result.skipped };
  }

  let classified = 0;
  try {
    classified = await classifyPending();
  } catch (err) {
    console.error("[listening] classification failed", err);
  }
  const alerted = await sendUrgentAlerts();
  const purged = await purgeExpired();

  return { sources, classified, alerted, purged };
}
