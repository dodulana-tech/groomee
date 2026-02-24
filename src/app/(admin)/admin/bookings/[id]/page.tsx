import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { formatNaira } from "@/lib/utils";
import AssignGroomerButton from "./AssignGroomerButton";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Booking Detail" };
export const revalidate = 0;

const STATUS_STYLE: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  PENDING_PAYMENT: {
    bg: "#FEF9C3",
    color: "#854D0E",
    label: "Awaiting payment",
  },
  DISPATCHING: { bg: "#FEF3C7", color: "#B45309", label: "Finding groomer" },
  ACCEPTED: { bg: "#DCFCE7", color: "#166534", label: "Accepted" },
  EN_ROUTE: { bg: "#DCFCE7", color: "#166534", label: "En route" },
  ARRIVED: { bg: "#EDE9FE", color: "#6D28D9", label: "Arrived" },
  IN_SERVICE: { bg: "#DBEAFE", color: "#1E40AF", label: "In service" },
  COMPLETED: {
    bg: "#E0E7FF",
    color: "#3730A3",
    label: "Awaiting confirmation",
  },
  CONFIRMED: { bg: "#DCFCE7", color: "#166534", label: "Confirmed ✓" },
  CANCELLED: { bg: "#FEF2F2", color: "#991B1B", label: "Cancelled" },
  NO_GROOMER: { bg: "#FEF2F2", color: "#991B1B", label: "No groomer found" },
  DISPUTED: { bg: "#FFF7ED", color: "#C2410C", label: "Disputed" },
};

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      groomer: true,
      service: true,
      zone: true,
      payment: true,
      dispute: true,
      review: true,
    },
  });

  if (!booking) notFound();

  // Only groomers who can do THIS service AND cover THIS zone
  const availableGroomers = await db.groomer.findMany({
    where: {
      status: "ACTIVE",
      availability: { in: ["ONLINE", "BUSY"] },
      services: { some: { serviceId: booking.serviceId } },
      ...(booking.zoneId
        ? { zones: { some: { zoneId: booking.zoneId } } }
        : {}),
    },
    include: { zones: { include: { zone: true }, take: 1 } },
    orderBy: [{ availability: "asc" }, { avgRating: "desc" }],
  });

  const s = STATUS_STYLE[booking.status] ?? {
    bg: "#F3F4F6",
    color: "#374151",
    label: booking.status,
  };

  function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="flex justify-between items-start gap-4 text-sm py-1.5 border-b border-gray-50 last:border-0">
        <dt className="text-gray-400 shrink-0">{label}</dt>
        <dd className="font-medium text-gray-800 text-right">{value}</dd>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/bookings" className="hover:text-gray-700">
          Bookings
        </Link>
        <span>/</span>
        <span className="font-mono text-gray-600">{booking.reference}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {booking.service.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: s.bg, color: s.color }}
            >
              {s.label}
            </span>
            {booking.isAsap && (
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#FFF0EB", color: "#C2410C" }}
              >
                ⚡ Emergency
              </span>
            )}
            {booking.surchargeType && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-50 text-orange-600">
                {booking.surchargeType} surcharge
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-extrabold text-gray-900">
            {formatNaira(booking.totalAmount)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Groomer earns {formatNaira(booking.groomerEarning)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Customer */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">Customer</h2>
          <dl>
            <Row
              label="Name"
              value={
                booking.customer.name ?? (
                  <span className="text-gray-400">No name</span>
                )
              }
            />
            <Row
              label="Phone"
              value={
                <span className="font-mono text-xs">
                  {booking.customer.phone}
                </span>
              }
            />
            <Row label="Address" value={booking.address} />
            {booking.zone && <Row label="Zone" value={booking.zone.name} />}
            {booking.customerNotes && (
              <Row
                label="Notes"
                value={
                  <span className="italic text-gray-500">
                    {booking.customerNotes}
                  </span>
                }
              />
            )}
          </dl>
        </div>

        {/* Groomer */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Groomer</h2>
            {!booking.groomer &&
              ["PENDING_PAYMENT", "DISPATCHING", "NO_GROOMER"].includes(
                booking.status,
              ) && (
                <AssignGroomerButton
                  bookingId={booking.id}
                  serviceName={booking.service.name}
                  groomers={availableGroomers}
                />
              )}
          </div>
          {booking.groomer ? (
            <dl>
              <Row label="Name" value={booking.groomer.name} />
              <Row
                label="Phone"
                value={
                  <span className="font-mono text-xs">
                    {booking.groomer.phone}
                  </span>
                }
              />
              <Row
                label="Rating"
                value={`★ ${booking.groomer.avgRating.toFixed(1)}`}
              />
              <Row
                label="Earning"
                value={
                  <span className="font-bold">
                    {formatNaira(booking.groomerEarning)}
                  </span>
                }
              />
              <Row
                label="Strikes"
                value={
                  <span
                    className={
                      booking.groomer.strikes > 0
                        ? "text-red-500 font-bold"
                        : "text-gray-400"
                    }
                  >
                    {booking.groomer.strikes}/3
                  </span>
                }
              />
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No groomer assigned yet</p>
          )}
          {booking.groomer && (
            <Link
              href={`/admin/groomers/${booking.groomer.id}`}
              className="mt-3 inline-block text-xs font-bold"
              style={{ color: "#1A3A2A" }}
            >
              View groomer profile →
            </Link>
          )}
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">Payment</h2>
          {booking.payment ? (
            <dl>
              <Row
                label="Reference"
                value={
                  <span className="font-mono text-xs">
                    {booking.payment.paystackRef ?? booking.payment.reference}
                  </span>
                }
              />
              <Row
                label="Status"
                value={
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background:
                        booking.payment.status === "CAPTURED"
                          ? "#DCFCE7"
                          : "#F3F4F6",
                      color:
                        booking.payment.status === "CAPTURED"
                          ? "#166534"
                          : "#374151",
                    }}
                  >
                    {booking.payment.status}
                  </span>
                }
              />
              <Row
                label="Amount"
                value={
                  <span className="font-bold">
                    {formatNaira(booking.payment.amount)}
                  </span>
                }
              />
              {booking.payment.authorisedAt && (
                <Row
                  label="Authorised"
                  value={format(
                    new Date(booking.payment.authorisedAt),
                    "dd MMM, HH:mm",
                  )}
                />
              )}
              {booking.payment.capturedAt && (
                <Row
                  label="Captured"
                  value={format(
                    new Date(booking.payment.capturedAt),
                    "dd MMM, HH:mm",
                  )}
                />
              )}
              {booking.payment.refundAmount && (
                <Row
                  label="Refunded"
                  value={
                    <span className="text-red-600 font-bold">
                      {formatNaira(booking.payment.refundAmount)}
                    </span>
                  }
                />
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No payment record</p>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-3">Timeline</h2>
          <dl>
            <Row
              label="Created"
              value={format(new Date(booking.createdAt), "dd MMM, HH:mm")}
            />
            {booking.acceptedAt && (
              <Row
                label="Accepted"
                value={format(new Date(booking.acceptedAt), "dd MMM, HH:mm")}
              />
            )}
            {booking.enRouteAt && (
              <Row
                label="En route"
                value={format(new Date(booking.enRouteAt), "dd MMM, HH:mm")}
              />
            )}
            {booking.arrivedAt && (
              <Row
                label="Arrived"
                value={format(new Date(booking.arrivedAt), "dd MMM, HH:mm")}
              />
            )}
            {booking.completedAt && (
              <Row
                label="Completed"
                value={format(new Date(booking.completedAt), "dd MMM, HH:mm")}
              />
            )}
            {booking.confirmedAt && (
              <Row
                label="Confirmed"
                value={format(new Date(booking.confirmedAt), "dd MMM, HH:mm")}
              />
            )}
            {booking.cancelledAt && (
              <Row
                label="Cancelled"
                value={format(new Date(booking.cancelledAt), "dd MMM, HH:mm")}
              />
            )}
            <Row label="Dispatch attempts" value={booking.dispatchAttempts} />
          </dl>
        </div>
      </div>

      {/* Dispute */}
      {booking.dispute && (
        <div
          className="bg-white rounded-2xl border mt-4 p-5"
          style={{ borderColor: "#FECACA" }}
        >
          <h2 className="font-bold mb-3" style={{ color: "#991B1B" }}>
            ⚠️ Dispute
          </h2>
          <dl>
            <Row
              label="Status"
              value={
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                  {booking.dispute.status}
                </span>
              }
            />
            <Row label="Reason" value={booking.dispute.reason} />
            {booking.dispute.notes && (
              <Row label="Notes" value={booking.dispute.notes} />
            )}
            {booking.dispute.resolution && (
              <Row label="Resolution" value={booking.dispute.resolution} />
            )}
            {booking.dispute.refundAmount && (
              <Row
                label="Refund"
                value={formatNaira(booking.dispute.refundAmount)}
              />
            )}
          </dl>
        </div>
      )}

      {/* Review */}
      {booking.review && (
        <div className="bg-white rounded-2xl border border-gray-100 mt-4 p-5">
          <h2 className="font-bold text-gray-900 mb-3">Customer Review</h2>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-lg">
              {"★".repeat(booking.review.rating)}
              {"☆".repeat(5 - booking.review.rating)}
            </span>
            <span className="text-sm text-gray-500">
              {booking.review.rating}/5
            </span>
          </div>
          {booking.review.text && (
            <p className="text-sm text-gray-600 italic">
              "{booking.review.text}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}
