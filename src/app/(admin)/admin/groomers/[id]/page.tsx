import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { formatNaira } from "@/lib/utils";
import GroomerActions from "./GroomerActions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Groomer Profile" };
export const revalidate = 0;

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: "#DCFCE7", color: "#166534" },
  PENDING: { bg: "#FEF9C3", color: "#854D0E" },
  SUSPENDED: { bg: "#FEF2F2", color: "#991B1B" },
  REMOVED: { bg: "#F3F4F6", color: "#6B7280" },
};
const AVAIL_STYLE: Record<string, { bg: string; color: string }> = {
  ONLINE: { bg: "#DCFCE7", color: "#166534" },
  BUSY: { bg: "#FFF7ED", color: "#C2410C" },
  OFFLINE: { bg: "#F3F4F6", color: "#6B7280" },
};

export default async function AdminGroomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const groomer = await db.groomer.findUnique({
    where: { id },
    include: {
      services: { include: { service: true } },
      zones: { include: { zone: true } },
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { service: true },
      },
      earnings: {
        where: { paid: false },
        select: { amount: true },
      },
    },
  });

  if (!groomer) notFound();

  // Reviews via bookings relation
  const reviews = await db.review.findMany({
    where: { booking: { groomerId: id } },
    include: {
      booking: {
        include: { service: true, customer: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const pendingEarnings = groomer.earnings.reduce(
    (sum, e) => sum + e.amount,
    0,
  );
  const ss = STATUS_STYLE[groomer.status] ?? STATUS_STYLE.PENDING;
  const as = AVAIL_STYLE[groomer.availability] ?? AVAIL_STYLE.OFFLINE;

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/groomers" className="hover:text-gray-700">
          Groomers
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{groomer.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
        <div className="flex items-start gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0"
            style={{ background: "#1A3A2A" }}
          >
            {groomer.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {groomer.name}
                </h1>
                <p className="text-sm text-gray-400 mt-0.5 font-mono">
                  {groomer.phone}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: ss.bg, color: ss.color }}
                  >
                    {groomer.status}
                  </span>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: as.bg, color: as.color }}
                  >
                    {groomer.availability}
                  </span>
                  {groomer.idVerified && (
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "#DBEAFE", color: "#1E40AF" }}
                    >
                      ✓ ID Verified
                    </span>
                  )}
                  {groomer.strikes > 0 && (
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "#FEF2F2", color: "#991B1B" }}
                    >
                      ⚠ {groomer.strikes}/3 strikes
                    </span>
                  )}
                </div>
              </div>
              <GroomerActions
                groomerId={groomer.id}
                currentStatus={groomer.status}
              />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-5 grid grid-cols-4 gap-3 border-t border-gray-100 pt-5">
          {[
            {
              label: "Rating",
              value:
                groomer.avgRating > 0
                  ? `★ ${groomer.avgRating.toFixed(1)}`
                  : "—",
            },
            { label: "Jobs done", value: groomer.totalJobs.toString() },
            {
              label: "Commission",
              value: `${Math.round(groomer.commission * 100)}%`,
            },
            { label: "Pending pay", value: formatNaira(pendingEarnings) },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Services & Zones */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">Services</h2>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {groomer.services.length === 0 && (
              <p className="text-sm text-gray-400">No services assigned</p>
            )}
            {groomer.services.map((gs) => (
              <span
                key={gs.serviceId}
                className="rounded-lg px-2.5 py-1 text-xs font-medium"
                style={{ background: "#F0FDF4", color: "#166534" }}
              >
                {gs.service.name}
                {gs.customPrice && (
                  <span className="ml-1 opacity-60">
                    ₦{gs.customPrice.toLocaleString()}
                  </span>
                )}
              </span>
            ))}
          </div>
          <h2 className="font-bold text-gray-900 mb-3">Coverage zones</h2>
          <div className="flex flex-wrap gap-1.5">
            {groomer.zones.length === 0 && (
              <p className="text-sm text-gray-400">No zones assigned</p>
            )}
            {groomer.zones.map((gz) => (
              <span
                key={gz.zoneId}
                className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
              >
                📍 {gz.zone.name}
              </span>
            ))}
          </div>
        </div>

        {/* Banking details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">Banking details</h2>
          {groomer.bankAccount ? (
            <dl className="space-y-2.5 text-sm">
              {[
                { label: "Bank", value: groomer.bankName },
                {
                  label: "Account",
                  value: (
                    <span className="font-mono">{groomer.bankAccount}</span>
                  ),
                },
                { label: "Code", value: groomer.bankCode },
              ].map(
                (row) =>
                  row.value && (
                    <div key={row.label} className="flex justify-between">
                      <dt className="text-gray-400">{row.label}</dt>
                      <dd className="font-medium text-gray-800">{row.value}</dd>
                    </div>
                  ),
              )}
            </dl>
          ) : (
            <p className="text-sm font-medium" style={{ color: "#991B1B" }}>
              ⚠ Banking details not provided — cannot process payouts
            </p>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm mb-2">Strikes</h3>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: i <= groomer.strikes ? "#FEF2F2" : "#F3F4F6",
                    color: i <= groomer.strikes ? "#991B1B" : "#9CA3AF",
                    border:
                      i <= groomer.strikes
                        ? "2px solid #FECACA"
                        : "2px solid transparent",
                  }}
                >
                  {i <= groomer.strikes ? "✕" : i}
                </div>
              ))}
              <span className="text-sm text-gray-400 ml-1">
                {groomer.strikes}/3
              </span>
            </div>
          </div>
        </div>

        {/* Recent bookings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">Recent bookings</h2>
          <div className="space-y-2">
            {groomer.bookings.length === 0 && (
              <p className="text-sm text-gray-400">No bookings yet</p>
            )}
            {groomer.bookings.map((b) => (
              <Link key={b.id} href={`/admin/bookings/${b.id}`}>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm hover:bg-gray-100 transition-colors">
                  <span className="font-medium text-gray-800">
                    {b.service.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(b.createdAt), "dd MMM")}
                  </span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        b.status === "CONFIRMED" ? "#DCFCE7" : "#F3F4F6",
                      color: b.status === "CONFIRMED" ? "#166534" : "#6B7280",
                    }}
                  >
                    {b.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Reviews */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">
            Reviews{" "}
            {groomer.reviewCount > 0 && (
              <span className="text-gray-400 font-normal text-sm">
                ({groomer.reviewCount} total)
              </span>
            )}
          </h2>
          <div className="space-y-3">
            {reviews.length === 0 && (
              <p className="text-sm text-gray-400">No reviews yet</p>
            )}
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl bg-gray-50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800">
                    {r.booking.customer.name ?? "Customer"} ·{" "}
                    {r.booking.service.name}
                  </span>
                  <span className="text-yellow-400 text-xs font-bold">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </span>
                </div>
                {r.text && (
                  <p className="text-xs text-gray-500 italic">"{r.text}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
