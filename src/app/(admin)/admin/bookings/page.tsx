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

export const metadata: Metadata = { title: "Bookings" };
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ status?: string }>;
}

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Live", value: "DISPATCHING,ACCEPTED,EN_ROUTE,ARRIVED,IN_SERVICE" },
  { label: "Pending", value: "DISPATCHING" },
  { label: "Complete", value: "CONFIRMED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Disputed", value: "DISPUTED" },
];

export default async function AdminBookingsPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const statusFilter = status?.split(",") ?? undefined;

  const bookings = await db.booking.findMany({
    where: statusFilter
      ? { status: { in: statusFilter as never[] } }
      : undefined,
    include: {
      customer: { select: { name: true, phone: true } },
      groomer: { select: { name: true } },
      service: { select: { name: true } },
      zone: { select: { name: true } },
      payment: { select: { status: true } },
      dispute: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="mt-1 text-sm text-gray-500">
          {bookings.length} bookings shown
        </p>
      </div>

      {/* Status tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.label}
            href={
              tab.value
                ? `/admin/bookings?status=${tab.value}`
                : "/admin/bookings"
            }
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              (tab.value === "" && !status) || status === tab.value
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Ref
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Customer
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Service
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Groomer
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Zone
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Value
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {b.reference}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.customer.name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{b.customer.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{b.service.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {b.groomer?.name ?? (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {b.zone?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "status-pill",
                        getBookingStatusColor(b.status),
                      )}
                    >
                      {getBookingStatusLabel(b.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold">
                    {formatNaira(b.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {format(new Date(b.createdAt), "dd MMM, HH:mm")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
