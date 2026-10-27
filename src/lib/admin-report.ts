/**
 * Weekly admin report — last 7 days vs the 7 before. Sent Monday morning by
 * /api/cron/weekly-report to ADMIN_EMAILS (full HTML) and ADMIN_PHONES
 * (short WhatsApp summary).
 */
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendMessage } from "@/lib/whatsapp";
import { formatNaira } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

interface Window {
  gte: Date;
  lt: Date;
}

async function windowStats(w: Window) {
  const [created, confirmed, noPro, cancelled, newCustomers, newPros, reviews, disputes, waitlist, waClicks, chats] =
    await Promise.all([
      db.booking.findMany({
        where: { createdAt: w },
        select: { zone: { select: { cityRel: { select: { name: true } } } } },
      }),
      db.booking.findMany({
        where: { confirmedAt: w },
        select: { totalAmount: true, proEarning: true },
      }),
      db.booking.count({ where: { createdAt: w, status: "NO_GROOMER" } }),
      db.booking.count({ where: { cancelledAt: w } }),
      db.user.count({ where: { createdAt: w, role: "CUSTOMER" } }),
      db.pro.count({ where: { createdAt: w } }),
      db.review.findMany({ where: { createdAt: w }, select: { rating: true } }),
      db.dispute.count({ where: { createdAt: w } }),
      db.waitlist.groupBy({ by: ["city"], where: { createdAt: w }, _count: true }),
      db.whatsAppClick.groupBy({ by: ["city", "source"], where: { createdAt: w }, _count: true }),
      db.assistantConversation.findMany({
        where: { createdAt: w },
        select: { clickedBooking: true, clickedWhatsApp: true, inputTokens: true, outputTokens: true },
      }),
    ]);

  const bookingsByCity: Record<string, number> = {};
  for (const b of created) {
    const name = b.zone?.cityRel?.name ?? "Unknown";
    bookingsByCity[name] = (bookingsByCity[name] ?? 0) + 1;
  }
  const gmv = confirmed.reduce((sum, b) => sum + b.totalAmount, 0);
  const take = confirmed.reduce((sum, b) => sum + (b.totalAmount - b.proEarning), 0);
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  const waByCity: Record<string, number> = {};
  const waBySource: Record<string, number> = {};
  for (const row of waClicks) {
    const city = row.city ?? "no city";
    waByCity[city] = (waByCity[city] ?? 0) + row._count;
    waBySource[row.source] = (waBySource[row.source] ?? 0) + row._count;
  }

  return {
    bookings: created.length,
    bookingsByCity,
    confirmed: confirmed.length,
    gmv,
    take,
    noPro,
    cancelled,
    newCustomers,
    newPros,
    reviews: reviews.length,
    lowReviews: reviews.filter((r) => r.rating <= 3).length,
    avgRating,
    disputes,
    waitlistByCity: Object.fromEntries(waitlist.map((r) => [r.city, r._count])),
    waClicks: Object.values(waByCity).reduce((a, b) => a + b, 0),
    waByCity,
    waBySource,
    assistantChats: chats.length,
    assistantBookingClicks: chats.filter((c) => c.clickedBooking).length,
    assistantWhatsApp: chats.filter((c) => c.clickedWhatsApp).length,
  };
}

export type WeeklyStats = Awaited<ReturnType<typeof windowStats>>;

function delta(cur: number, prev: number): string {
  if (prev === 0) return cur === 0 ? "–" : "new";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}%`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

function sumValues(o: Record<string, number>) {
  return Object.values(o).reduce((a, b) => a + b, 0);
}

function breakdown(o: Record<string, number>): string {
  const entries = Object.entries(o).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([k, v]) => `${k} ${v}`).join(" · ") : "none";
}

export async function buildWeeklyReport(now = new Date()) {
  const cur = { gte: new Date(now.getTime() - 7 * DAY), lt: now };
  const prev = { gte: new Date(now.getTime() - 14 * DAY), lt: cur.gte };
  const [c, p] = await Promise.all([windowStats(cur), windowStats(prev)]);
  const period = `${fmtDate(cur.gte)} – ${fmtDate(new Date(now.getTime() - DAY))}`;

  const rows: [string, string, string][] = [
    ["Bookings created", String(c.bookings), delta(c.bookings, p.bookings)],
    ["Bookings confirmed", String(c.confirmed), delta(c.confirmed, p.confirmed)],
    ["GMV (confirmed)", formatNaira(Math.round(c.gmv)), delta(c.gmv, p.gmv)],
    ["Groomee take", formatNaira(Math.round(c.take)), delta(c.take, p.take)],
    ["No pro found", String(c.noPro), delta(c.noPro, p.noPro)],
    ["Cancellations", String(c.cancelled), delta(c.cancelled, p.cancelled)],
    ["New customers", String(c.newCustomers), delta(c.newCustomers, p.newCustomers)],
    ["New pro sign-ups", String(c.newPros), delta(c.newPros, p.newPros)],
    ["WhatsApp CTA taps", String(c.waClicks), delta(c.waClicks, p.waClicks)],
    ["Concierge chats", String(c.assistantChats), delta(c.assistantChats, p.assistantChats)],
    ["Concierge → booking link", String(c.assistantBookingClicks), delta(c.assistantBookingClicks, p.assistantBookingClicks)],
    ["Concierge → WhatsApp", String(c.assistantWhatsApp), delta(c.assistantWhatsApp, p.assistantWhatsApp)],
    ["Waitlist sign-ups", String(sumValues(c.waitlistByCity)), delta(sumValues(c.waitlistByCity), sumValues(p.waitlistByCity))],
    ["Reviews", `${c.reviews}${c.avgRating ? ` (avg ${c.avgRating.toFixed(1)}★)` : ""}`, delta(c.reviews, p.reviews)],
    ["Reviews ≤3★", String(c.lowReviews), delta(c.lowReviews, p.lowReviews)],
    ["Disputes opened", String(c.disputes), delta(c.disputes, p.disputes)],
  ];

  const details: [string, string][] = [
    ["Bookings by city", breakdown(c.bookingsByCity)],
    ["WhatsApp taps by city", breakdown(c.waByCity)],
    ["WhatsApp taps by surface", breakdown(c.waBySource)],
    ["Waitlist by city", breakdown(c.waitlistByCity)],
  ];

  const subject = `Groomee weekly report · ${period}`;

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 4px">Groomee weekly report</h2>
    <p style="margin:0 0 20px;color:#666">${period} · vs previous 7 days</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows
        .map(
          ([label, val, d]) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee">${label}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600">${val}</td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid #eee;text-align:right;color:#666;white-space:nowrap">${d}</td>
      </tr>`,
        )
        .join("")}
    </table>
    ${details
      .map(
        ([label, val]) =>
          `<p style="margin:16px 0 0;font-size:13px"><strong>${label}:</strong> <span style="color:#444">${val}</span></p>`,
      )
      .join("")}
  </div>`;

  const whatsapp = [
    `*Groomee weekly · ${period}*`,
    `Bookings: ${c.bookings} (${delta(c.bookings, p.bookings)}) · confirmed ${c.confirmed}`,
    `GMV: ${formatNaira(Math.round(c.gmv))} (${delta(c.gmv, p.gmv)}) · take ${formatNaira(Math.round(c.take))}`,
    `By city: ${breakdown(c.bookingsByCity)}`,
    `WhatsApp taps: ${c.waClicks} (${breakdown(c.waByCity)})`,
    `Waitlist: ${breakdown(c.waitlistByCity)}`,
    `New customers ${c.newCustomers} · new pros ${c.newPros}`,
    `Concierge: ${c.assistantChats} chats → ${c.assistantBookingClicks} booking clicks, ${c.assistantWhatsApp} WhatsApp`,
    `No-pro ${c.noPro} · cancelled ${c.cancelled} · disputes ${c.disputes} · ≤3★ ${c.lowReviews}`,
  ].join("\n");

  return { subject, html, whatsapp, current: c, previous: p };
}

function listEnv(...keys: string[]): string[] {
  return keys
    .flatMap((k) => (process.env[k] ?? "").split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function sendWeeklyReport(now = new Date()) {
  const report = await buildWeeklyReport(now);
  const emails = [...new Set(listEnv("ADMIN_EMAILS", "ADMIN_EMAIL").map((e) => e.toLowerCase()))];
  const phones = listEnv("ADMIN_PHONES");

  let emailed = 0;
  for (const to of emails) {
    try {
      if (await sendEmail({ to, subject: report.subject, html: report.html })) emailed++;
    } catch (err) {
      console.error("[weekly-report] email failed", to, err);
    }
  }

  // Business-initiated WhatsApp outside a 24h session needs an approved
  // template; freeform may be rejected, so email is the source of truth.
  let whatsapped = 0;
  for (const to of phones) {
    const res = await sendMessage(to, report.whatsapp);
    if (res.success) whatsapped++;
  }

  return { emailed, whatsapped, subject: report.subject, stats: report.current };
}
