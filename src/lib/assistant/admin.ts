/**
 * Admin ops copilot: read-only lookups + text-only drafting helpers.
 * Every tool re-checks the caller's own permission, so the copilot can never
 * show an admin more than their role already allows. No tool mutates state,
 * and none touches health data.
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { buildWeeklyReport } from "@/lib/admin-report";
import type { SessionPayload } from "@/types";
import { ToolError, type AssistantTool } from "./engine";

export interface AdminCtx {
  session: SessionPayload;
}

const DAY = 24 * 60 * 60 * 1000;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const rangeInput = z.object({ from: dateStr.optional(), to: dateStr.optional() });
const rangeSchema = {
  from: { type: "string", description: "Start date YYYY-MM-DD (Lagos time). Default: 7 days ago." },
  to: { type: "string", description: "End date YYYY-MM-DD inclusive (Lagos time). Default: today." },
};

/** Inclusive Lagos-time date range → [gte, lt). */
function range({ from, to }: { from?: string; to?: string }) {
  const lt = to ? new Date(new Date(`${to}T00:00:00+01:00`).getTime() + DAY) : new Date();
  const gte = from ? new Date(`${from}T00:00:00+01:00`) : new Date(lt.getTime() - 7 * DAY);
  if (gte >= lt) throw new ToolError("'from' must be before 'to'.");
  return { gte, lt };
}

function need(ctx: AdminCtx, permission: string) {
  if (!hasPermission(ctx.session, permission)) {
    throw new ToolError(`Your role doesn't include "${permission}", so I can't look that up for you.`);
  }
}

function digits(s: string) {
  return s.replace(/\D/g, "").replace(/^0/, "").replace(/^234/, "");
}

export function adminSystemPrompt(today: string) {
  return `You are the Groomee ops copilot inside the admin dashboard. Groomee is an on-demand, at-home beauty marketplace in Nigeria (Lagos live; Abuja served via WhatsApp concierge). Today is ${today} (Lagos time).

You help the ops team answer questions fast: look up bookings, pros, customers and disputes, summarise performance, spot problems (no-pro-found bookings, low ratings, strikes), and draft messages or dispute notes.

Rules:
- Use tools for every number and fact. Never estimate or invent figures. If a tool says the admin lacks permission, tell them plainly.
- You are read-only. You cannot change bookings, issue refunds, message anyone, or edit records. When an action is needed, say exactly what to do and link the admin page.
- Drafts are text only — label them "Draft" and remind the admin that nothing has been sent.
- Always call the people who do the work "beauty professionals" or "pros". Never use the word "groomer".
- Do not discuss customers' health, allergies or medical details; point to the Health & care page for authorised staff.
- Money is Naira (₦, thousands separators). Dates in Lagos time.
- Link records with the adminLink values tools return, as markdown links, e.g. [GRM-1234](/admin/bookings/abc).

Style: concise and scannable — short bullets or a compact list, key number first. Offer one useful follow-up when relevant.`;
}

const bookingSelect = {
  id: true,
  reference: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  scheduledFor: true,
  isAsap: true,
  dispatchAttempts: true,
  service: { select: { name: true } },
  pro: { select: { id: true, name: true, phone: true } },
  customer: { select: { id: true, name: true, phone: true, email: true } },
  zone: { select: { name: true, cityRel: { select: { name: true } } } },
  payment: { select: { status: true, amount: true, refundAmount: true } },
  dispute: { select: { status: true, reason: true } },
  review: { select: { rating: true, text: true } },
} as const;

type BookingRow = Awaited<ReturnType<typeof findBookings>>[number];

function findBookings(where: Prisma.BookingWhereInput, take = 5) {
  return db.booking.findMany({ where, select: bookingSelect, orderBy: { createdAt: "desc" }, take });
}

function shapeBooking(b: BookingRow) {
  return {
    reference: b.reference,
    status: b.status,
    service: b.service.name,
    amount: b.totalAmount,
    createdAt: b.createdAt,
    scheduledFor: b.isAsap ? "ASAP" : b.scheduledFor,
    area: [b.zone?.name, b.zone?.cityRel?.name].filter(Boolean).join(", ") || null,
    customer: { name: b.customer.name, phone: b.customer.phone },
    pro: b.pro ? { name: b.pro.name, adminLink: `/admin/pros/${b.pro.id}` } : null,
    dispatchAttempts: b.dispatchAttempts,
    payment: b.payment,
    dispute: b.dispute,
    review: b.review,
    adminLink: `/admin/bookings/${b.id}`,
  };
}

export const adminTools: AssistantTool<AdminCtx>[] = [
  {
    name: "lookup_booking",
    description: "Find bookings by reference (e.g. GRM-1234) or customer/pro phone number. Returns up to 5 most recent matches.",
    input: z.object({ reference: z.string().max(40).optional(), phone: z.string().max(20).optional() }),
    inputSchema: {
      type: "object",
      properties: { reference: { type: "string" }, phone: { type: "string" } },
    },
    run: async ({ reference, phone }: { reference?: string; phone?: string }, ctx) => {
      need(ctx, PERMISSIONS.BOOKINGS_VIEW);
      if (!reference && !phone) throw new ToolError("Give a booking reference or a phone number.");
      const p = phone ? digits(phone) : null;
      const rows = await findBookings({
        OR: [
          ...(reference ? [{ reference: { equals: reference.trim(), mode: "insensitive" as const } }] : []),
          ...(p && p.length >= 7
            ? [{ customer: { phone: { contains: p } } }, { pro: { phone: { contains: p } } }]
            : []),
        ],
      });
      return { bookings: rows.map(shapeBooking) };
    },
  },
  {
    name: "bookings_summary",
    description: "Booking counts by status and by city for a date range (by creation date), plus confirmed GMV and Groomee take.",
    input: rangeInput.extend({ city: z.string().max(40).optional() }),
    inputSchema: { type: "object", properties: { ...rangeSchema, city: { type: "string" } } },
    run: async (input: { from?: string; to?: string; city?: string }, ctx) => {
      need(ctx, PERMISSIONS.BOOKINGS_VIEW);
      const createdAt = range(input);
      const cityFilter = input.city
        ? { zone: { cityRel: { name: { equals: input.city, mode: "insensitive" as const } } } }
        : {};
      const rows = await db.booking.findMany({
        where: { createdAt, ...cityFilter },
        select: { status: true, totalAmount: true, proEarning: true, zone: { select: { cityRel: { select: { name: true } } } } },
      });
      const byStatus: Record<string, number> = {};
      const byCity: Record<string, number> = {};
      let gmv = 0;
      let take = 0;
      for (const r of rows) {
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        const c = r.zone?.cityRel?.name ?? "Unknown";
        byCity[c] = (byCity[c] ?? 0) + 1;
        if (r.status === "CONFIRMED") {
          gmv += r.totalAmount;
          take += r.totalAmount - r.proEarning;
        }
      }
      return { range: createdAt, total: rows.length, byStatus, byCity, confirmedGmv: Math.round(gmv), groomeeTake: Math.round(take) };
    },
  },
  {
    name: "lookup_pro",
    description: "Find beauty pros by name or phone. Returns status, availability, rating, reviews, jobs, acceptance rate, strikes (with recent reasons), areas and services.",
    input: z.object({ query: z.string().min(2).max(60) }),
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    run: async ({ query }: { query: string }, ctx) => {
      need(ctx, PERMISSIONS.PROS_VIEW);
      const p = digits(query);
      const pros = await db.pro.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            ...(p.length >= 7 ? [{ phone: { contains: p } }] : []),
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
          availability: true,
          avgRating: true,
          reviewCount: true,
          totalJobs: true,
          acceptanceRate: true,
          strikeCount: true,
          relationship: true,
          idVerified: true,
          createdAt: true,
          zones: { select: { zone: { select: { name: true } } } },
          services: { select: { service: { select: { name: true } } } },
          strikes: { orderBy: { createdAt: "desc" }, take: 3, select: { reason: true, createdAt: true } },
        },
      });
      return {
        pros: pros.map((pro) => ({
          ...pro,
          avgRating: Number(pro.avgRating.toFixed(2)),
          acceptanceRate: Math.round(pro.acceptanceRate * 100) / 100,
          zones: pro.zones.map((z) => z.zone.name),
          services: pro.services.map((s) => s.service.name),
          adminLink: `/admin/pros/${pro.id}`,
        })),
      };
    },
  },
  {
    name: "lookup_customer",
    description: "Find customers by phone, email or name. Returns booking count, last 3 bookings, points and join date.",
    input: z.object({ query: z.string().min(2).max(80) }),
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    run: async ({ query }: { query: string }, ctx) => {
      need(ctx, PERMISSIONS.CUSTOMERS_VIEW);
      const p = digits(query);
      const users = await db.user.findMany({
        where: {
          role: "CUSTOMER",
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            ...(p.length >= 7 ? [{ phone: { contains: p } }] : []),
          ],
        },
        take: 5,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          points: true,
          createdAt: true,
          _count: { select: { bookings: true } },
          bookings: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { reference: true, status: true, totalAmount: true, createdAt: true, service: { select: { name: true } } },
          },
        },
      });
      return {
        customers: users.map((u) => ({
          name: u.name,
          phone: u.phone,
          email: u.email,
          points: u.points,
          joined: u.createdAt,
          totalBookings: u._count.bookings,
          recentBookings: u.bookings.map((b) => ({ ...b, service: b.service.name })),
          adminLink: `/admin/customers/${u.id}`,
        })),
      };
    },
  },
  {
    name: "open_disputes",
    description: "List open and under-review disputes, oldest first, with booking, amount and reason.",
    input: z.object({ limit: z.number().int().min(1).max(25).optional() }),
    inputSchema: { type: "object", properties: { limit: { type: "integer" } } },
    run: async ({ limit }: { limit?: number }, ctx) => {
      need(ctx, PERMISSIONS.DISPUTES_VIEW);
      const disputes = await db.dispute.findMany({
        where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
        orderBy: { createdAt: "asc" },
        take: limit ?? 10,
        select: {
          status: true,
          reason: true,
          createdAt: true,
          booking: { select: bookingSelect },
        },
      });
      const now = Date.now();
      return {
        disputes: disputes.map((d) => ({
          status: d.status,
          reason: d.reason,
          ageDays: Math.floor((now - d.createdAt.getTime()) / DAY),
          booking: shapeBooking(d.booking),
        })),
      };
    },
  },
  {
    name: "dispatch_failures",
    description: "Bookings that ended NO_GROOMER (no pro accepted) in a date range, grouped by service and area, plus the latest 15.",
    input: rangeInput,
    inputSchema: { type: "object", properties: rangeSchema },
    run: async (input: { from?: string; to?: string }, ctx) => {
      need(ctx, PERMISSIONS.BOOKINGS_VIEW);
      const createdAt = range(input);
      const rows = await findBookings({ createdAt, status: "NO_GROOMER" }, 500);
      const byService: Record<string, number> = {};
      const byArea: Record<string, number> = {};
      for (const b of rows) {
        byService[b.service.name] = (byService[b.service.name] ?? 0) + 1;
        const a = b.zone?.name ?? "Unknown";
        byArea[a] = (byArea[a] ?? 0) + 1;
      }
      return { total: rows.length, byService, byArea, latest: rows.slice(0, 15).map(shapeBooking) };
    },
  },
  {
    name: "waitlist_counts",
    description: "Waitlist sign-ups by city and role (customer/pro) for a date range.",
    input: rangeInput,
    inputSchema: { type: "object", properties: rangeSchema },
    run: async (input: { from?: string; to?: string }, ctx) => {
      need(ctx, PERMISSIONS.ANALYTICS_VIEW);
      const createdAt = range(input);
      const rows = await db.waitlist.groupBy({ by: ["city", "role"], where: { createdAt }, _count: true });
      return { range: createdAt, rows: rows.map((r) => ({ city: r.city, role: r.role, count: r._count })) };
    },
  },
  {
    name: "whatsapp_clicks",
    description: "Taps on the site's 'chat on WhatsApp' CTAs by city and surface (hero, footer, waitlist, assistant…) for a date range.",
    input: rangeInput,
    inputSchema: { type: "object", properties: rangeSchema },
    run: async (input: { from?: string; to?: string }, ctx) => {
      need(ctx, PERMISSIONS.ANALYTICS_VIEW);
      const createdAt = range(input);
      const rows = await db.whatsAppClick.groupBy({ by: ["city", "source"], where: { createdAt }, _count: true });
      return {
        range: createdAt,
        total: rows.reduce((s, r) => s + r._count, 0),
        rows: rows.map((r) => ({ city: r.city ?? "none", source: r.source, count: r._count })),
      };
    },
  },
  {
    name: "weekly_report",
    description: "The weekly admin report numbers (bookings, GMV, take, no-pro, cancellations, sign-ups, WhatsApp taps, waitlist, reviews, disputes, assistant conversions) for the 7 days ending on endDate, with the prior 7 days for comparison.",
    input: z.object({ endDate: dateStr.optional() }),
    inputSchema: {
      type: "object",
      properties: { endDate: { type: "string", description: "Last day YYYY-MM-DD inclusive. Default: today." } },
    },
    run: async ({ endDate }: { endDate?: string }, ctx) => {
      need(ctx, PERMISSIONS.ANALYTICS_VIEW);
      const end = endDate ? new Date(new Date(`${endDate}T00:00:00+01:00`).getTime() + DAY) : new Date();
      const report = await buildWeeklyReport(end);
      return { period: report.subject, current: report.current, previous: report.previous };
    },
  },
  {
    name: "draft_message",
    description:
      "Gather facts for drafting a WhatsApp or email message to a customer or pro (optionally about a booking). Returns the facts and house style; you then write the draft. Nothing is sent.",
    input: z.object({
      recipient: z.enum(["customer", "pro"]),
      channel: z.enum(["whatsapp", "email"]),
      goal: z.string().min(3).max(500),
      bookingReference: z.string().max(40).optional(),
    }),
    inputSchema: {
      type: "object",
      properties: {
        recipient: { type: "string", enum: ["customer", "pro"] },
        channel: { type: "string", enum: ["whatsapp", "email"] },
        goal: { type: "string", description: "What the message should achieve" },
        bookingReference: { type: "string" },
      },
      required: ["recipient", "channel", "goal"],
    },
    run: async (
      input: { recipient: "customer" | "pro"; channel: "whatsapp" | "email"; goal: string; bookingReference?: string },
      ctx,
    ) => {
      let booking: ReturnType<typeof shapeBooking> | null = null;
      if (input.bookingReference) {
        need(ctx, PERMISSIONS.BOOKINGS_VIEW);
        const [row] = await findBookings({ reference: { equals: input.bookingReference.trim(), mode: "insensitive" } }, 1);
        if (!row) throw new ToolError(`No booking with reference ${input.bookingReference}.`);
        booking = shapeBooking(row);
      }
      const name = input.recipient === "customer" ? booking?.customer.name : booking?.pro?.name;
      return {
        sent: false,
        recipientFirstName: name?.split(" ")[0] ?? null,
        booking,
        houseStyle: [
          "Warm, respectful, plain English; Nigerian context.",
          input.channel === "whatsapp"
            ? "WhatsApp: under 600 characters, short paragraphs, at most one emoji, *bold* sparingly."
            : "Email: subject line + 3 short paragraphs max.",
          "Say 'beauty professional' or 'pro' — never 'groomer'.",
          "State facts from the booking only; don't promise refunds or credits unless the admin said so.",
          "Sign off: — Team Groomee",
        ],
      };
    },
  },
  {
    name: "draft_dispute_note",
    description:
      "Gather the full facts of a disputed booking (timeline, payment, review, pro strike history) so you can draft an internal resolution note with a recommended outcome. Nothing is saved or sent.",
    input: z.object({ bookingReference: z.string().min(3).max(40) }),
    inputSchema: {
      type: "object",
      properties: { bookingReference: { type: "string" } },
      required: ["bookingReference"],
    },
    run: async ({ bookingReference }: { bookingReference: string }, ctx) => {
      need(ctx, PERMISSIONS.DISPUTES_VIEW);
      const b = await db.booking.findFirst({
        where: { reference: { equals: bookingReference.trim(), mode: "insensitive" } },
        select: {
          ...bookingSelect,
          acceptedAt: true,
          enRouteAt: true,
          arrivedAt: true,
          completedAt: true,
          confirmedAt: true,
          cancelledAt: true,
          dispute: { select: { status: true, reason: true, notes: true, resolution: true, refundAmount: true, createdAt: true } },
          pro: { select: { id: true, name: true, phone: true, avgRating: true, strikeCount: true, totalJobs: true } },
        },
      });
      if (!b) throw new ToolError(`No booking with reference ${bookingReference}.`);
      return {
        saved: false,
        booking: {
          ...shapeBooking(b as unknown as BookingRow),
          pro: b.pro
            ? { name: b.pro.name, rating: b.pro.avgRating, strikes: b.pro.strikeCount, jobs: b.pro.totalJobs, adminLink: `/admin/pros/${b.pro.id}` }
            : null,
        },
        timeline: {
          accepted: b.acceptedAt,
          enRoute: b.enRouteAt,
          arrived: b.arrivedAt,
          completed: b.completedAt,
          confirmed: b.confirmedAt,
          cancelled: b.cancelledAt,
        },
        dispute: b.dispute,
      };
    },
  },
];
