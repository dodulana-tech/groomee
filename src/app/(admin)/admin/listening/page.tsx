import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { MentionIntent, MentionStatus, ListeningSource, Prisma } from "@prisma/client";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { ensureDefaultTerms } from "@/lib/listening";
import { getState } from "@/lib/listening/state";
import ListeningInbox from "./ListeningInbox";
import TermsBoard from "./TermsBoard";

export const metadata: Metadata = { title: "Social listening" };
export const revalidate = 0;

const INTENTS: MentionIntent[] = ["LEAD", "COMPLAINT", "QUESTION", "PRAISE", "PRO_RECRUIT", "COMPETITOR_COMPLAINT", "UGC", "OTHER"];
const SOURCES: ListeningSource[] = ["INSTAGRAM", "X", "GOOGLE_ALERTS", "WEB", "NAIRALAND", "FACEBOOK", "MANUAL"];

const INTENT_LABEL: Record<MentionIntent, string> = {
  LEAD: "Leads",
  COMPLAINT: "Complaints",
  QUESTION: "Questions",
  PRAISE: "Praise",
  PRO_RECRUIT: "Pro recruits",
  COMPETITOR_COMPLAINT: "Competitor gripes",
  UGC: "UGC",
  OTHER: "Other",
};

const CONNECTOR_ENV: { name: string; label: string; configured: () => boolean; stateKey?: string }[] = [
  { name: "instagram", label: "Instagram", configured: () => !!(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN), stateKey: "instagram" },
  { name: "x", label: "X", configured: () => !!process.env.X_BEARER_TOKEN, stateKey: "x" },
  { name: "brave", label: "Web (Brave)", configured: () => !!process.env.BRAVE_API_KEY, stateKey: "brave" },
  { name: "google-alerts", label: "Google Alerts", configured: () => !!process.env.GOOGLE_ALERTS_FEEDS },
  { name: "nairaland", label: "Nairaland", configured: () => !process.env.NAIRALAND_FEED_DISABLED },
  { name: "claude", label: "Classifier", configured: () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) },
];

export default async function ListeningPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; intent?: string; status?: string; source?: string }>;
}) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, PERMISSIONS.LISTENING_VIEW)) redirect("/admin");
  const canManage = hasPermission(session, PERMISSIONS.LISTENING_MANAGE);

  const sp = await searchParams;
  const tab = sp.tab === "terms" ? "terms" : "inbox";
  await ensureDefaultTerms();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [byIntent, bySentiment, openLeads, openComplaints, competitorCount, terms, lastRuns] = await Promise.all([
    db.socialMention.groupBy({ by: ["intent"], where: { createdAt: { gte: weekAgo }, relevant: true }, _count: true }),
    db.socialMention.groupBy({ by: ["sentiment"], where: { createdAt: { gte: weekAgo }, relevant: true }, _count: true }),
    db.socialMention.count({ where: { intent: "LEAD", status: { in: ["NEW", "IN_PROGRESS"] }, relevant: true } }),
    db.socialMention.count({ where: { intent: "COMPLAINT", status: { in: ["NEW", "IN_PROGRESS"] }, relevant: true } }),
    db.socialMention.count({ where: { createdAt: { gte: weekAgo }, competitor: { not: null } } }),
    db.listeningTerm.findMany({ orderBy: [{ kind: "asc" }, { term: "asc" }] }),
    Promise.all(CONNECTOR_ENV.map((c) => (c.stateKey ? getState(`${c.stateKey}.lastRun`) : Promise.resolve(null)))),
  ]);

  const sentimentTotal = bySentiment.reduce((s, r) => s + r._count, 0);
  const negative = bySentiment.find((r) => r.sentiment === "NEGATIVE")?._count ?? 0;

  const intent = INTENTS.includes(sp.intent as MentionIntent) ? (sp.intent as MentionIntent) : undefined;
  const source = SOURCES.includes(sp.source as ListeningSource) ? (sp.source as ListeningSource) : undefined;
  const statusFilter: MentionStatus[] =
    sp.status === "done" ? ["REPLIED", "IGNORED"] : sp.status === "all" ? ["NEW", "IN_PROGRESS", "REPLIED", "IGNORED"] : ["NEW", "IN_PROGRESS"];

  const where: Prisma.SocialMentionWhereInput = {
    status: { in: statusFilter },
    ...(intent ? { intent } : {}),
    ...(source ? { source } : {}),
    // Irrelevant posts only show under "all". Explicit null branch: SQL
    // NOT (relevant = false) drops unclassified rows.
    ...(sp.status === "all" ? {} : { OR: [{ relevant: true }, { relevant: null }] }),
  };
  const mentions =
    tab === "inbox"
      ? await db.socialMention.findMany({
          where,
          // Urgent first, then newest.
          orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
          take: 100,
        })
      : [];

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { intent: sp.intent, status: sp.status, source: sp.source, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/listening${s ? `?${s}` : ""}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Social listening</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Public posts about Groomee, competitors and people looking for beauty pros. Classified by Claude; urgent
            items are WhatsApped to admins. Replies are always posted by a human.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/listening"
            className={`rounded-xl px-4 py-2 text-sm font-semibold border ${tab === "inbox" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
          >
            Inbox
          </Link>
          <Link
            href="/admin/listening?tab=terms"
            className={`rounded-xl px-4 py-2 text-sm font-semibold border ${tab === "terms" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
          >
            Terms &amp; sources
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Open leads", value: openLeads, href: qs({ intent: "LEAD", status: undefined }) },
          { label: "Open complaints", value: openComplaints, href: qs({ intent: "COMPLAINT", status: undefined }) },
          { label: "Negative (7d)", value: sentimentTotal ? `${Math.round((negative / sentimentTotal) * 100)}%` : "–" },
          { label: "Competitor mentions (7d)", value: competitorCount },
        ].map((t) => {
          const body = (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.label}</p>
              <p className="mt-1 text-2xl font-black text-gray-900">{t.value}</p>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-gray-300">
              {body}
            </Link>
          ) : (
            <div key={t.label} className="rounded-2xl border border-gray-200 bg-white p-4">
              {body}
            </div>
          );
        })}
      </div>

      {tab === "inbox" ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href={qs({ intent: undefined })} className={`rounded-full border px-3 py-1 ${!intent ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600"}`}>
              All
            </Link>
            {INTENTS.map((i) => {
              const count = byIntent.find((r) => r.intent === i)?._count ?? 0;
              return (
                <Link key={i} href={qs({ intent: i })} className={`rounded-full border px-3 py-1 ${intent === i ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600"}`}>
                  {INTENT_LABEL[i]} <span className="opacity-60">{count}</span>
                </Link>
              );
            })}
            <span className="mx-1 h-5 w-px bg-gray-200" />
            {[
              { k: undefined, label: "Open" },
              { k: "done", label: "Handled" },
              { k: "all", label: "Everything" },
            ].map((s) => (
              <Link key={s.label} href={qs({ status: s.k })} className={`rounded-full border px-3 py-1 ${sp.status === s.k ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-600"}`}>
                {s.label}
              </Link>
            ))}
            <span className="mx-1 h-5 w-px bg-gray-200" />
            {SOURCES.map((s) => (
              <Link key={s} href={qs({ source: source === s ? undefined : s })} className={`rounded-full border px-3 py-1 text-xs ${source === s ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-500"}`}>
                {s.replace("_", " ").toLowerCase()}
              </Link>
            ))}
          </div>

          <ListeningInbox
            canManage={canManage}
            mentions={mentions.map((m) => ({
              id: m.id,
              source: m.source,
              url: m.url,
              authorHandle: m.authorHandle,
              text: m.text,
              postedAt: (m.postedAt ?? m.createdAt).toISOString(),
              matchedTerm: m.matchedTerm,
              competitor: m.competitor,
              intent: m.intent,
              sentiment: m.sentiment,
              urgency: m.urgency,
              relevant: m.relevant,
              city: m.city,
              service: m.service,
              summary: m.summary,
              suggestedReply: m.suggestedReply,
              status: m.status,
              note: m.note,
            }))}
          />
        </>
      ) : (
        <TermsBoard
          canManage={canManage}
          terms={terms.map((t) => ({ id: t.id, term: t.term, kind: t.kind, competitor: t.competitor, active: t.active }))}
          connectors={CONNECTOR_ENV.map((c, i) => ({
            label: c.label,
            configured: c.configured(),
            lastRun: lastRuns[i] ? new Date(Number(lastRuns[i])).toISOString() : null,
          }))}
        />
      )}
    </div>
  );
}
