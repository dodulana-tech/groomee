import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSession, hasPermission } from "@/lib/auth";
import { AREAS, serviceBySlug } from "@/lib/seo/content";
import { AI_CHANNELS, CHANNEL_LABEL, type Channel } from "@/lib/attribution";

export const metadata: Metadata = { title: "Growth | Admin" };
export const revalidate = 0;

const TARGET_PER_DAY = 10;
const DAYS = 14;
// Days are counted in Lagos time (WAT, UTC+1, no daylight saving).
const WAT_OFFSET_MS = 60 * 60 * 1000;

const dayKey = (d: Date) => new Date(d.getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10);

function sourceLabel(src: string): string {
  if (src.startsWith("svc-")) return "Service pages";
  if (src.startsWith("area-")) return "Area pages";
  if (src.startsWith("city-") || src === "abuja-page") return "City pages";
  const named: Record<string, string> = {
    "home-fab": "Homepage",
    footer: "Footer (any page)",
    prices: "Price list",
    faq: "FAQ",
    "become-a-pro": "Become a pro",
    rebook: "Rebooking reminders",
  };
  return named[src] ?? src;
}

function tally<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Ranked({ title, rows, empty }: { title: string; rows: [string, number][]; empty: string }) {
  const max = rows[0]?.[1] ?? 1;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 8).map(([label, n]) => (
            <li key={label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="truncate text-gray-700">{label}</span>
                <span className="font-mono text-gray-500">{n}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function GrowthPage() {
  const session = await getSession();
  if (!hasPermission(session, "analytics.view")) redirect("/admin");

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const clicks = await db.whatsAppClick.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { source: true, city: true, service: true, area: true, channel: true, firstChannel: true, createdAt: true },
  });

  // Daily series, oldest first, including empty days.
  const days: { key: string; label: string; count: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = dayKey(d);
    days.push({
      key,
      label: new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
      count: 0,
    });
  }
  const byDay = new Map(days.map((d) => [d.key, d]));
  for (const c of clicks) {
    const d = byDay.get(dayKey(c.createdAt));
    if (d) d.count++;
  }

  const today = days[days.length - 1].count;
  const last7 = days.slice(-7).reduce((s, d) => s + d.count, 0);
  const prev7 = days.slice(0, 7).reduce((s, d) => s + d.count, 0);
  const avg7 = last7 / 7;
  const daysAtTarget = days.slice(-7).filter((d) => d.count >= TARGET_PER_DAY).length;
  const chartMax = Math.max(TARGET_PER_DAY * 1.5, ...days.map((d) => d.count));

  const week = clicks.filter((c) => c.createdAt.getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000);
  const bySource = tally(week, (c) => sourceLabel(c.source));
  const byService = tally(week, (c) => (c.service ? serviceBySlug(c.service)?.name ?? c.service : null));
  const byArea = tally(week, (c) => (c.area ? AREAS.find((a) => a.slug === c.area)?.name ?? c.area : null));
  const byCity = tally(week, (c) => (c.city ? c.city.charAt(0).toUpperCase() + c.city.slice(1) : "Not specified"));
  const channelName = (ch: string | null) => (ch ? CHANNEL_LABEL[ch as Channel] ?? ch : "Not recorded yet");
  const byChannel = tally(week, (c) => channelName(c.channel));
  const byFirstChannel = tally(week, (c) => channelName(c.firstChannel));
  const aiWeek = week.filter((c) => c.channel && AI_CHANNELS.includes(c.channel as Channel)).length;
  const searchWeek = week.filter((c) => c.channel === "google" || c.channel === "bing" || c.channel === "other-search").length;

  const change = prev7 === 0 ? null : Math.round(((last7 - prev7) / prev7) * 100);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Growth</h1>
        <p className="mt-1 text-sm text-gray-500">
          WhatsApp enquiries from the website: every tap on a WhatsApp button that opened a chat with us.
          Target {TARGET_PER_DAY} a day. Days in Lagos time.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Today</p>
          <p className={`mt-1 text-3xl font-bold ${today >= TARGET_PER_DAY ? "text-green-600" : "text-gray-900"}`}>
            {today}
            <span className="text-base font-medium text-gray-400"> / {TARGET_PER_DAY}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Daily average, 7 days</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{avg7.toFixed(1)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Last 7 days</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{last7}</p>
          <p className="mt-1 text-xs text-gray-500">
            {change === null ? "no data for the week before" : `${change >= 0 ? "+" : ""}${change}% on the week before`}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Days at target, 7 days</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {daysAtTarget}
            <span className="text-base font-medium text-gray-400"> / 7</span>
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Enquiries per day, last {DAYS} days</h2>
        <div className="relative mt-4 h-48">
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-green-500/60"
            style={{ bottom: `${(TARGET_PER_DAY / chartMax) * 100}%` }}
          >
            <span className="absolute -top-5 right-0 text-[11px] font-medium text-green-700">target {TARGET_PER_DAY}</span>
          </div>
          <div className="flex h-full items-end gap-1.5">
            {days.map((d) => (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-[11px] text-gray-500">{d.count || ""}</span>
                <div
                  className={`w-full rounded-t ${d.count >= TARGET_PER_DAY ? "bg-green-500" : "bg-gray-300"}`}
                  style={{ height: `${(d.count / chartMax) * 100}%` }}
                  title={`${d.label}: ${d.count}`}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-1.5">
          {days.map((d) => (
            <span key={d.key} className="flex-1 truncate text-center text-[10px] text-gray-400">
              {d.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">From AI assistants, 7 days</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{aiWeek}</p>
          <p className="mt-1 text-xs text-gray-500">ChatGPT, Perplexity, Gemini, Claude, Copilot</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">From search, 7 days</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{searchWeek}</p>
          <p className="mt-1 text-xs text-gray-500">Google, Bing and others</p>
        </div>
        <Ranked title="Channel that brought them (latest)" rows={byChannel} empty="No taps yet" />
        <Ranked title="Channel that first found us" rows={byFirstChannel} empty="No taps yet" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Ranked title="Where they tapped (7 days)" rows={bySource} empty="No taps yet" />
        <Ranked title="Services asked about" rows={byService} empty="No service-page taps yet" />
        <Ranked title="Areas asked about" rows={byArea} empty="No area-page taps yet" />
        <Ranked title="City" rows={byCity} empty="No taps yet" />
      </div>

      <p className="mt-6 text-xs text-gray-400">
        A tap opens WhatsApp with a prefilled message; a few people close it without sending. Compare with the
        chats in the Groomee WhatsApp Business app to see how many taps become real conversations.
      </p>
    </div>
  );
}
