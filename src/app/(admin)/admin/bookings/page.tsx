import { db } from "@/lib/db";
import Link from "next/link";
import { format } from "date-fns";
import {
  cn,
  formatNaira,
  getBookingStatusLabel,
  getBookingStatusColor,
} from "@/lib/utils";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { getSession, hasPermission } from "@/lib/auth";
import { conciergeStats } from "@/lib/concierge";
import { isPaymentWindowClosed } from "@/lib/booking-payment";
import ResendPayLinkButton from "./ResendPayLinkButton";

export const metadata: Metadata = { title: "Bookings" };
export const revalidate = 0;

interface Props {
  searchParams: Promise<{
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
    source?: string;
  }>;
}

const PAGE_SIZE = 50;

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Awaiting payment", value: "PENDING_PAYMENT" },
  { label: "Live", value: "DISPATCHING,ACCEPTED,EN_ROUTE,ARRIVED,IN_SERVICE" },
  { label: "Pending", value: "DISPATCHING" },
  { label: "Complete", value: "CONFIRMED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Disputed", value: "DISPUTED" },
];

const SOURCE_TABS = [
  { label: "All channels", value: "" },
  { label: "WhatsApp concierge", value: "WHATSAPP_CONCIERGE" },
  { label: "App", value: "APP" },
];

function buildQuery(params: {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  source?: string;
}) {
  const out = new URLSearchParams();
  if (params.status) out.set("status", params.status);
  if (params.source) out.set("source", params.source);
  if (params.q) out.set("q", params.q);
  if (params.from) out.set("from", params.from);
  if (params.to) out.set("to", params.to);
  return out.toString();
}

export default async function AdminBookingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status;
  const q = sp.q?.trim();
  const from = sp.from;
  const to = sp.to;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const source =
    sp.source === "WHATSAPP_CONCIERGE" || sp.source === "APP" ? sp.source : undefined;
  const session = await getSession();
  const canManage = hasPermission(session, "bookings.manage");

  const statusFilter = status?.split(",") ?? undefined;

  const where: Prisma.BookingWhereInput = {};
  if (statusFilter) where.status = { in: statusFilter as never[] };
  if (source) where.source = source;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
      { pro: { name: { contains: q, mode: "insensitive" } } },
      { service: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [bookings, total, concierge] = await Promise.all([
    db.booking.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        pro: { select: { name: true } },
        service: { select: { name: true } },
        zone: { select: { name: true } },
        payment: { select: { status: true } },
        dispute: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.booking.count({ where }),
    conciergeStats(7),
  ]);
  const now = new Date();
  const resendable = (b: (typeof bookings)[number]) =>
    canManage && b.status === "PENDING_PAYMENT" && b.source === "WHATSAPP_CONCIERGE";

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseQs = buildQuery({ status, q, from, to, source });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} total · showing {bookings.length} (page {page} of {totalPages})
          </p>
        </div>
        {canManage && (
          <Link
            href="/admin/bookings/new"
            className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            + New concierge booking
          </Link>
        )}
      </div>

      {/* WhatsApp concierge funnel, last 7 days. GMV / revenue count paid
          bookings not since cancelled; revenue = totalAmount − proEarning,
          as in the weekly report. */}
      <div className="mb-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            WhatsApp concierge · last 7 days
          </p>
          <Link
            href="/admin/bookings?source=WHATSAPP_CONCIERGE"
            className="text-xs font-semibold text-brand-deep hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-2xl font-bold text-gray-900">{concierge.created}</p>
            <p className="text-xs text-gray-400">created</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {concierge.paid}
              {concierge.created > 0 && (
                <span className="ml-1 text-sm font-semibold text-gray-400">
                  {Math.round((concierge.paid / concierge.created) * 100)}%
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400">paid · {concierge.awaitingPayment} awaiting</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatNaira(Math.round(concierge.gmv))}</p>
            <p className="text-xs text-gray-400">GMV (paid)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-700">{formatNaira(Math.round(concierge.revenue))}</p>
            <p className="text-xs text-gray-400">Groomee revenue</p>
          </div>
        </div>
      </div>

      {/* Filters: search + date range */}
      <form
        method="GET"
        className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl bg-white border border-gray-100 p-3"
      >
        {status && <input type="hidden" name="status" value={status} />}
        {source && <input type="hidden" name="source" value={source} />}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Search
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Customer, phone, ref, pro, service…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-deep/20 focus:border-brand-deep"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            From
          </label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-deep/20 focus:border-brand-deep"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            To
          </label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-deep/20 focus:border-brand-deep"
          />
        </div>
        <button
          type="submit"
          className="bg-brand-deep text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90"
        >
          Apply
        </button>
        {(q || from || to) && (
          <Link
            href={(() => {
              const qs = buildQuery({ status, source });
              return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
            })()}
            className="text-sm font-semibold text-gray-500 px-3 py-2 rounded-xl hover:bg-gray-100"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Status tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const tabQs = buildQuery({ status: tab.value, q, from, to, source });
          return (
            <Link
              key={tab.label}
              href={tabQs ? `/admin/bookings?${tabQs}` : "/admin/bookings"}
              className={cn(
                "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                (tab.value === "" && !status) || status === tab.value
                  ? "bg-brand-deep text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Channel filter */}
      <div className="mb-5 -mt-2 flex gap-1 overflow-x-auto pb-1">
        {SOURCE_TABS.map((tab) => {
          const tabQs = buildQuery({ status, q, from, to, source: tab.value });
          const active = (tab.value === "" && !source) || source === tab.value;
          return (
            <Link
              key={tab.label}
              href={tabQs ? `/admin/bookings?${tabQs}` : "/admin/bookings"}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border",
                active
                  ? "bg-[#25D366]/10 border-[#25D366] text-[#128C7E]"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile card layout */}
      <div className="space-y-3 lg:hidden">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
          <Link
            href={`/admin/bookings/${b.id}`}
            className="block active:scale-[0.99] transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-semibold text-sm text-gray-900">{b.customer.name ?? "Customer"}</p>
                <p className="text-xs text-gray-400">{b.service.name}</p>
              </div>
              <span className={cn("status-pill shrink-0", getBookingStatusColor(b.status))}>
                {getBookingStatusLabel(b.status)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{b.pro?.name ?? "Unassigned"} {b.zone?.name ? `· ${b.zone.name}` : ""}</span>
              <span className="font-bold text-gray-900">{formatNaira(b.totalAmount)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {format(new Date(b.createdAt), "dd MMM, HH:mm")}
              {b.source === "WHATSAPP_CONCIERGE" && <SourceBadge />}
            </p>
          </Link>
            {resendable(b) && (
              <div className="mt-3 border-t border-gray-50 pt-3">
                {isPaymentWindowClosed(b, now) ? (
                  <p className="text-xs text-gray-400">Slot has passed, so cancel and rebook.</p>
                ) : (
                  <ResendPayLinkButton bookingId={b.id} />
                )}
              </div>
            )}
          </div>
        ))}
        {bookings.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p>No bookings found</p>
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="card overflow-hidden hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Ref</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Service</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Pro</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Zone</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Value</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {b.reference}
                    {b.source === "WHATSAPP_CONCIERGE" && (
                      <span className="block">
                        <SourceBadge />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.customer.name ?? "-"}</p>
                    <p className="text-xs text-gray-400">{b.customer.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{b.service.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.pro?.name ?? <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{b.zone?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("status-pill", getBookingStatusColor(b.status))}>
                      {getBookingStatusLabel(b.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold">{formatNaira(b.totalAmount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {format(new Date(b.createdAt), "dd MMM, HH:mm")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="text-xs font-medium text-brand-deep hover:underline"
                    >
                      View
                    </Link>
                    {resendable(b) && (
                      <div className="mt-2 min-w-[180px]">
                        {isPaymentWindowClosed(b, now) ? (
                          <p className="text-xs text-gray-400">Slot passed</p>
                        ) : (
                          <ResendPayLinkButton bookingId={b.id} />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    No bookings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={
              page > 1
                ? `/admin/bookings?${baseQs}${baseQs ? "&" : ""}page=${page - 1}`
                : "#"
            }
            aria-disabled={page <= 1}
            className={cn(
              "rounded-xl px-4 py-2 font-semibold border border-gray-200",
              page <= 1
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-50",
            )}
          >
            ← Previous
          </Link>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <Link
            href={
              page < totalPages
                ? `/admin/bookings?${baseQs}${baseQs ? "&" : ""}page=${page + 1}`
                : "#"
            }
            aria-disabled={page >= totalPages}
            className={cn(
              "rounded-xl px-4 py-2 font-semibold border border-gray-200",
              page >= totalPages
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-50",
            )}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}

function SourceBadge() {
  return (
    <span className="ml-1 inline-block rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-bold text-[#128C7E]">
      WhatsApp
    </span>
  );
}
