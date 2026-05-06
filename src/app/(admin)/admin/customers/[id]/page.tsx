import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { db } from "@/lib/db";
import {
  cn,
  formatNaira,
  getBookingStatusLabel,
  getBookingStatusColor,
} from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Customer detail" };
export const revalidate = 0;

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await db.user.findUnique({
    where: { id },
    include: {
      beautyProfile: true,
      _count: { select: { bookings: true } },
      pointsLedger: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!customer) notFound();

  const [bookings, spendAgg, reviews, subscriptions, gifts] = await Promise.all([
    db.booking.findMany({
      where: { customerId: id },
      include: {
        service: { select: { name: true } },
        pro: { select: { name: true } },
        zone: { select: { name: true } },
        payment: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.booking.aggregate({
      where: { customerId: id, status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    db.review.findMany({
      where: { booking: { customerId: id } },
      include: { booking: { include: { pro: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.subscription.findMany({
      where: { userId: id },
      include: { plan: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.giftCard.findMany({
      where: { OR: [{ senderId: id }, { redeemedBy: id }] },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/customers" className="hover:text-gray-700">
          Customers
        </Link>
        <span>/</span>
        <span className="text-gray-600">{customer.name ?? "Unnamed"}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {customer.name ?? <span className="text-gray-400">No name set</span>}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
            {customer.phone && <span>📱 {customer.phone}</span>}
            {customer.email && <span>✉️ {customer.email}</span>}
            <span>
              Joined{" "}
              {format(new Date(customer.createdAt), "dd MMM yyyy")}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold text-gray-900">
            {formatNaira(spendAgg._sum.totalAmount ?? 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Lifetime spend across {spendAgg._count._all} completed bookings
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-4 mb-6">
        <Stat label="Total bookings" value={customer._count.bookings} />
        <Stat label="Completed" value={spendAgg._count._all} />
        <Stat label="Reviews left" value={reviews.length} />
        <Stat label="Points balance" value={customer.points} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bookings (main) */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Recent bookings</h2>
          </div>
          {bookings.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">No bookings yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-2 font-semibold">Service</th>
                  <th className="px-4 py-2 font-semibold">Pro</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Total</th>
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">{b.service.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {b.pro?.name ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("status-pill", getBookingStatusColor(b.status))}>
                        {getBookingStatusLabel(b.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold">{formatNaira(b.totalAmount)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                      {format(new Date(b.createdAt), "dd MMM, HH:mm")}
                    </td>
                    <td className="px-4 py-2.5">
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
          )}
        </div>

        {/* Side rail */}
        <div className="space-y-4">
          {customer.beautyProfile && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-bold text-gray-900 mb-2">Beauty profile</h2>
              <dl className="space-y-1 text-sm">
                {customer.beautyProfile.hairType && (
                  <Row label="Hair type" value={customer.beautyProfile.hairType} />
                )}
                {customer.beautyProfile.skinType && (
                  <Row label="Skin type" value={customer.beautyProfile.skinType} />
                )}
                {customer.beautyProfile.allergies?.length > 0 && (
                  <Row label="Allergies" value={customer.beautyProfile.allergies.join(", ")} />
                )}
                {customer.beautyProfile.styleNotes && (
                  <Row label="Style notes" value={customer.beautyProfile.styleNotes} />
                )}
              </dl>
            </div>
          )}

          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-bold text-gray-900 mb-2">Reviews left</h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-gray-400">No reviews yet.</p>
            ) : (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="border-b border-gray-50 pb-2 last:border-0">
                    <p className="text-yellow-500 text-sm">
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.booking.pro?.name ?? "—"}</p>
                    {r.text && (
                      <p className="text-sm text-gray-600 italic mt-1">"{r.text}"</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {subscriptions.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-bold text-gray-900 mb-2">Subscriptions</h2>
              <ul className="space-y-2 text-sm">
                {subscriptions.map((s) => (
                  <li key={s.id} className="flex justify-between text-gray-600">
                    <span>{s.plan?.name ?? "Pass"}</span>
                    <span className="text-xs text-gray-400">{s.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {gifts.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-bold text-gray-900 mb-2">Gift cards</h2>
              <ul className="space-y-2 text-sm">
                {gifts.map((g) => (
                  <li key={g.id} className="flex justify-between text-gray-600">
                    <span className="font-mono text-xs">{g.code}</span>
                    <span className="font-semibold">{formatNaira(g.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {customer.pointsLedger.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-bold text-gray-900 mb-2">Recent points activity</h2>
              <ul className="space-y-2 text-sm">
                {customer.pointsLedger.map((p) => (
                  <li key={p.id} className="flex justify-between text-gray-600">
                    <span className="text-xs">{p.reason}</span>
                    <span
                      className={cn(
                        "font-bold",
                        p.amount > 0 ? "text-green-600" : "text-red-500",
                      )}
                    >
                      {p.amount > 0 ? "+" : ""}
                      {p.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-gray-50 last:border-0">
      <dt className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{label}</dt>
      <dd className="text-sm text-gray-700 text-right">{value}</dd>
    </div>
  );
}
