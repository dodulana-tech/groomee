import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ASSISTANT_MODEL, assistantEnabled } from "@/lib/assistant/engine";

export const metadata: Metadata = { title: "Concierge chats" };
export const revalidate = 0;

const DAY = 24 * 60 * 60 * 1000;

export default async function AdminAssistantPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, PERMISSIONS.ANALYTICS_VIEW)) redirect("/admin");

  const since = new Date(Date.now() - 30 * DAY);
  const [recent, monthly, userMessages, services, zones] = await Promise.all([
    db.assistantConversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      include: {
        messages: { where: { role: "user" }, orderBy: { createdAt: "asc" }, take: 1, select: { content: true } },
      },
    }),
    db.assistantConversation.findMany({
      where: { createdAt: { gte: since } },
      select: { clickedBooking: true, clickedWhatsApp: true, refused: true, inputTokens: true, outputTokens: true, cacheReadTokens: true },
    }),
    db.assistantMessage.findMany({
      where: { role: "user", createdAt: { gte: since } },
      select: { content: true },
    }),
    db.service.findMany({ where: { isActive: true }, select: { name: true } }),
    db.zone.findMany({ select: { name: true } }),
  ]);

  // "What people ask for" — match last-30-day user messages against service
  // and area names. Simple, but grounded in real catalog terms.
  const texts = userMessages.map((m) => m.content.toLowerCase());
  const countMentions = (names: string[]) =>
    names
      .map((name) => ({ name, count: texts.filter((t) => t.includes(name.toLowerCase())).length }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  const topServices = countMentions(services.map((s) => s.name));
  const topZones = countMentions(zones.map((z) => z.name));

  const chats = monthly.length;
  const booking = monthly.filter((c) => c.clickedBooking).length;
  const whatsapp = monthly.filter((c) => c.clickedWhatsApp).length;
  const pct = (n: number) => (chats ? `${Math.round((n / chats) * 100)}%` : "–");
  // Opus 5.5 list prices: $4 / $20 per MTok, cache reads $0.20.
  const usd =
    monthly.reduce(
      (s, c) => s + ((c.inputTokens - c.cacheReadTokens) * 4 + c.cacheReadTokens * 0.2 + c.outputTokens * 20) / 1e6,
      0,
    );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Concierge chats</h1>
        <p className="mt-1 text-sm text-gray-500">
          What visitors ask the on-site concierge and whether it got them to a pro or to WhatsApp. Last 30 days ·{" "}
          {assistantEnabled() ? `live on ${ASSISTANT_MODEL}` : "assistant is OFF (no ANTHROPIC_API_KEY)"}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Conversations", String(chats)],
          ["→ Booking link", `${booking} (${pct(booking)})`],
          ["→ WhatsApp", `${whatsapp} (${pct(whatsapp)})`],
          ["Declined", String(monthly.filter((c) => c.refused).length)],
          ["Est. model cost", `$${usd.toFixed(2)}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {[
          ["Most-asked services", topServices],
          ["Most-asked areas", topZones],
        ].map(([title, rows]) => (
          <div key={title as string} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-gray-900">{title as string}</h2>
            {(rows as { name: string; count: number }[]).length === 0 ? (
              <p className="text-sm text-gray-400">No mentions yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {(rows as { name: string; count: number }[]).map((r) => (
                  <li key={r.name} className="flex justify-between">
                    <span className="text-gray-700">{r.name}</span>
                    <span className="font-mono text-gray-500">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Last message</th>
              <th className="px-4 py-3">First question</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3 text-right">Msgs</th>
              <th className="px-4 py-3">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No conversations yet.
                </td>
              </tr>
            )}
            {recent.map((c) => (
              <tr key={c.id}>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">{format(c.lastMessageAt, "d MMM, HH:mm")}</td>
                <td className="max-w-md px-4 py-3 text-gray-800">
                  <span className="line-clamp-2">{c.messages[0]?.content ?? "—"}</span>
                </td>
                <td className="px-4 py-3 capitalize text-gray-600">{c.city ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">{c.messageCount}</td>
                <td className="space-x-1 whitespace-nowrap px-4 py-3">
                  {c.clickedBooking && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Booking</span>}
                  {c.clickedWhatsApp && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">WhatsApp</span>}
                  {c.refused && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Declined</span>}
                  {!c.clickedBooking && !c.clickedWhatsApp && !c.refused && <span className="text-xs text-gray-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
