"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatNaira, getBookingStatusLabel } from "@/lib/utils";
import ReviewModal from "@/components/customer/ReviewModal";
import type { BookingWithRelations } from "@/types";
import Link from "next/link";

const POLL_INTERVAL = 15_000;

const TIMELINE = [
  { status: "DISPATCHING", label: "Finding your groomer", icon: SearchIcon },
  { status: "ACCEPTED", label: "Groomer assigned", icon: CheckIcon },
  { status: "EN_ROUTE", label: "On the way to you", icon: CarIcon },
  { status: "ARRIVED", label: "Groomer arrived", icon: PinIcon },
  { status: "CONFIRMED", label: "Service complete", icon: SparkleIcon },
];

function timelineIndex(status: string): number {
  if (status === "IN_SERVICE" || status === "COMPLETED") return 4;
  return TIMELINE.findIndex((s) => s.status === status);
}

const STATUS_STYLES: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  PENDING_PAYMENT: {
    bg: "#FEF9C3",
    color: "#854D0E",
    label: "Awaiting payment",
  },
  DISPATCHING: { bg: "#EFF6FF", color: "#1D4ED8", label: "Finding groomer" },
  ACCEPTED: { bg: "#F0FDF4", color: "#166534", label: "Groomer assigned" },
  EN_ROUTE: { bg: "#F0FDF4", color: "#166534", label: "On the way" },
  ARRIVED: { bg: "#F0FDF4", color: "#166534", label: "Groomer arrived" },
  IN_SERVICE: { bg: "#F0FDF4", color: "#166534", label: "In service" },
  COMPLETED: {
    bg: "#EFF6FF",
    color: "#1D4ED8",
    label: "Awaiting confirmation",
  },
  CONFIRMED: { bg: "#F0FDF4", color: "#166534", label: "Confirmed ✓" },
  CANCELLED: { bg: "#FEF2F2", color: "#991B1B", label: "Cancelled" },
  NO_GROOMER: { bg: "#FEF2F2", color: "#991B1B", label: "No groomer found" },
  DISPUTED: { bg: "#FFF7ED", color: "#C2410C", label: "Disputed" },
};

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<BookingWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
    const t = setInterval(fetchBooking, POLL_INTERVAL);
    return () => clearInterval(t);
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

  const tIdx = timelineIndex(booking.status);
  const style = STATUS_STYLES[booking.status] ?? {
    bg: "#F9FAFB",
    color: "#374151",
    label: booking.status,
  };
  const showTimeline = !["PENDING_PAYMENT", "CANCELLED", "NO_GROOMER"].includes(
    booking.status,
  );

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

        {/* Status card */}
        <div
          className="rounded-3xl p-5"
          style={{ background: style.bg, border: `1px solid ${style.color}22` }}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: style.color }}
            >
              {style.label}
            </span>
            <span className="font-mono text-xs text-gray-400">
              {booking.reference}
            </span>
          </div>
          <p
            className="text-xl font-black"
            style={{
              color: "#0D1B12",
              fontFamily: "var(--font-playfair), Georgia, serif",
            }}
          >
            {booking.service.name}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">{booking.address}</p>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {/* Groomer card */}
        {booking.groomer && (
          <div
            className="bg-white rounded-3xl p-4 flex items-center gap-4"
            style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0"
              style={{ background: "#1A3A2A", fontFamily: "Georgia, serif" }}
            >
              {booking.groomer.name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">{booking.groomer.name}</p>
              <p className="text-sm text-gray-500">
                ★ {booking.groomer.avgRating.toFixed(1)} ·{" "}
                {booking.groomer.totalJobs} jobs
              </p>
            </div>
            <a
              href={`tel:${booking.groomer.phone}`}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
              style={{ background: "#1A3A2A" }}
            >
              <PhoneIcon />
            </a>
          </div>
        )}

        {/* Timeline */}
        {showTimeline && (
          <div
            className="bg-white rounded-3xl p-5"
            style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
          >
            <p className="font-bold text-sm text-gray-900 mb-4">
              Booking progress
            </p>
            <div>
              {TIMELINE.map((step, i) => {
                const done = i < tIdx;
                const active = i === tIdx;
                const Icon = step.icon;
                return (
                  <div key={step.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: done
                            ? "#1A3A2A"
                            : active
                              ? "#D4A853"
                              : "#F3F4F6",
                          color: done || active ? "white" : "#9CA3AF",
                        }}
                      >
                        {done ? <SmallCheckIcon /> : <Icon />}
                      </div>
                      {i < TIMELINE.length - 1 && (
                        <div
                          className="w-0.5 my-1 h-6"
                          style={{ background: done ? "#1A3A2A" : "#E5E7EB" }}
                        />
                      )}
                    </div>
                    <div className="pb-5 pt-1">
                      <p
                        className="text-sm font-medium"
                        style={{
                          color: done
                            ? "#1A3A2A"
                            : active
                              ? "#111827"
                              : "#9CA3AF",
                        }}
                      >
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Booking details */}
        <div
          className="bg-white rounded-3xl p-5"
          style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
        >
          <p className="font-bold text-sm text-gray-900 mb-3">
            Booking details
          </p>
          <dl className="space-y-2.5 text-sm">
            {[
              { label: "Service", value: booking.service.name },
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

        {/* Completed — awaiting customer confirmation */}
        {booking.status === "COMPLETED" && (
          <div className="space-y-2">
            <div
              className="rounded-2xl p-3 text-sm text-center"
              style={{ background: "#EFF6FF", color: "#1D4ED8" }}
            >
              Your groomer has marked this service as done. Please confirm to
              release payment.
            </div>
            <button
              onClick={confirmService}
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

        {/* No groomer */}
        {booking.status === "NO_GROOMER" && (
          <div
            className="bg-white rounded-3xl p-5 text-center"
            style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
          >
            <p className="text-3xl mb-2">😔</p>
            <p className="font-bold text-gray-900 mb-1">No groomer available</p>
            <p className="text-sm text-gray-500 mb-4">
              We couldn't find a groomer in your area right now. You have not
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
            className="bg-white rounded-3xl p-5 text-center"
            style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}
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

      {showReview && booking.groomer && (
        <ReviewModal
          bookingId={booking.id}
          groomerName={booking.groomer.name}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}
function SmallCheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}
function CarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2h-2" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}
