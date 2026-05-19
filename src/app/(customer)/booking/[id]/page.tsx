"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";
import ReviewModal from "@/components/customer/ReviewModal";
import LiveBookingTracker from "@/components/customer/LiveBookingTracker";
import type { BookingWithRelations } from "@/types";
import Link from "next/link";

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<BookingWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const fetchBooking = useCallback(async () => {
    const res = await fetch(`/api/bookings/${id}`);
    if (!res.ok) {
      router.push("/bookings");
      return;
    }
    const data = await res.json();
    setBooking(data.data);
  }, [id, router]);

  useEffect(() => {
    fetchBooking().finally(() => setLoading(false));
  }, [fetchBooking]);

  useEffect(() => {
    if (booking?.status === "CONFIRMED" && !booking.review) setShowReview(true);
  }, [booking?.status, booking?.review]);

  async function confirmService() {
    setConfirming(true);
    try {
      const res = await fetch(`/api/bookings/${id}/confirm`, {
        method: "POST",
      });
      if (res.ok) await fetchBooking();
    } finally {
      setConfirming(false);
    }
  }

  async function cancelBooking() {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setCancelling(true);
    try {
      await fetch(`/api/bookings/${id}/cancel`, { method: "POST" });
      router.push("/bookings");
    } finally {
      setCancelling(false);
    }
  }

  async function retryPayment() {
    setPayLoading(true);
    try {
      const res = await fetch(`/api/bookings/${id}/payment-url`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setPayLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200"
          style={{ borderTopColor: "#1A3A2A" }}
        />
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#F7F3ED" }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          ← My bookings
        </Link>
      </div>

      <div className="px-4 space-y-3">
        {/* Live booking tracker (handles status header, timeline, pro card, location) */}
        <LiveBookingTracker bookingId={id} initialData={booking} />

        {/* Booking details */}
        <div
          className="bg-white rounded-3xl p-5"
          style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
        >
          <p className="font-bold text-sm text-gray-900 mb-3">
            Booking details
          </p>
          {booking.items && booking.items.length > 0 && (
            <ul className="mb-4 space-y-1 rounded-2xl bg-gray-50 p-3 text-sm border border-gray-100">
              <li className="flex justify-between font-semibold text-gray-900">
                <span>{booking.service.name}</span>
                <span className="text-xs text-gray-400">
                  ~{booking.service.durationMins} mins
                </span>
              </li>
              {booking.items.map((it) => (
                <li
                  key={it.id}
                  className="flex justify-between text-gray-700"
                >
                  <span>+ {it.service.name}</span>
                  <span className="text-xs text-gray-400">
                    ~{it.service.durationMins} mins
                  </span>
                </li>
              ))}
              <li className="flex justify-between border-t border-gray-200 pt-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                <span>Total time</span>
                <span>
                  {Math.floor((booking.durationMins ?? booking.service.durationMins) / 60)}h
                  {((booking.durationMins ?? booking.service.durationMins) % 60)
                    ? ` ${(booking.durationMins ?? booking.service.durationMins) % 60}m`
                    : ""}
                </span>
              </li>
            </ul>
          )}
          <dl className="space-y-2.5 text-sm">
            {[
              ...(booking.items && booking.items.length > 0
                ? []
                : [{ label: "Service", value: booking.service.name }]),
              { label: "Address", value: booking.address },
              {
                label: "Type",
                value: booking.isAsap ? "⚡ Emergency / ASAP" : "📅 Scheduled",
              },
              { label: "Reference", value: booking.reference, mono: true },
              {
                label: "Total",
                value: formatNaira(booking.totalAmount),
                bold: true,
              },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-gray-400 shrink-0">{row.label}</dt>
                <dd
                  className={`text-right ${row.mono ? "font-mono text-xs" : ""} ${row.bold ? "font-bold" : "font-medium"} text-gray-900`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── ACTIONS ── */}

        {/* Pending payment */}
        {booking.status === "PENDING_PAYMENT" && (
          <div className="space-y-2">
            <button
              onClick={retryPayment}
              disabled={payLoading}
              className="w-full py-4 rounded-2xl font-bold text-white text-base"
              style={{ background: payLoading ? "#9CA3AF" : "#1A3A2A" }}
            >
              {payLoading
                ? "Loading…"
                : `Pay ${formatNaira(booking.totalAmount)} now →`}
            </button>
            <button
              onClick={cancelBooking}
              disabled={cancelling}
              className="w-full py-3 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500 bg-white"
            >
              {cancelling ? "Cancelling…" : "Cancel booking"}
            </button>
          </div>
        )}

        {/* Completed - awaiting customer confirmation */}
        {booking.status === "COMPLETED" && (
          <div className="space-y-2">
            <div
              className="rounded-2xl p-3 text-sm text-center"
              style={{ background: "#EFF6FF", color: "#1D4ED8" }}
            >
              Your pro has marked this service as done. Please confirm to
              release payment.
            </div>
            <button
              onClick={() => setShowConfirmDialog(true)}
              disabled={confirming}
              className="w-full py-4 rounded-2xl font-bold text-white text-base"
              style={{ background: confirming ? "#9CA3AF" : "#1A3A2A" }}
            >
              {confirming
                ? "Processing…"
                : `✅ Confirm & release ${formatNaira(booking.totalAmount)}`}
            </button>
            <button
              onClick={() => router.push(`/booking/${id}/dispute`)}
              className="w-full py-3 rounded-2xl font-semibold text-sm border text-red-600 bg-white"
              style={{ borderColor: "#FECACA" }}
            >
              ⚠️ Raise a dispute
            </button>
          </div>
        )}

        {/* No pro */}
        {booking.status === "NO_GROOMER" && (
          <div
            className="glass-card rounded-3xl p-5 text-center"
          >
            <p className="text-3xl mb-2">😔</p>
            <p className="font-bold text-gray-900 mb-1">No pro available</p>
            <p className="text-sm text-gray-500 mb-4">
              We couldn't find a pro in your area right now. You have not
              been charged.
            </p>
            <Link
              href="/search"
              className="inline-block w-full py-3 rounded-2xl font-bold text-white text-sm"
              style={{ background: "#1A3A2A" }}
            >
              Try again
            </Link>
          </div>
        )}

        {/* Cancelled */}
        {booking.status === "CANCELLED" && (
          <div
            className="glass-card rounded-3xl p-5 text-center"
          >
            <p className="text-3xl mb-2">❌</p>
            <p className="font-bold text-gray-900 mb-1">Booking cancelled</p>
            <p className="text-sm text-gray-500 mb-4">
              Any payment will be refunded within 24–48 hours.
            </p>
            <Link
              href="/search"
              className="inline-block w-full py-3 rounded-2xl font-bold text-white text-sm"
              style={{ background: "#1A3A2A" }}
            >
              Book again
            </Link>
          </div>
        )}
      </div>

      {/* Confirm payment release dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4">
          <div role="dialog" aria-modal="true" aria-label="Confirm payment release" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-3xl text-center mb-3">💸</p>
            <h3 className="font-display text-lg font-bold text-gray-900 text-center mb-2">
              Release payment?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              This will release {formatNaira(booking.totalAmount)} to {booking.pro?.name ?? "the pro"}. This action cannot be undone.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { setShowConfirmDialog(false); confirmService(); }}
                className="w-full py-3.5 rounded-2xl font-bold text-white text-sm"
                style={{ background: "#1A3A2A" }}
              >
                Yes, release payment
              </button>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="w-full py-3 rounded-2xl font-semibold text-sm border border-gray-200 text-gray-500 bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showReview && booking.pro && (
        <ReviewModal
          bookingId={booking.id}
          proName={booking.pro.name}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}
