"use client";

import { useEffect, useState, useCallback } from "react";
import BookingTimeline from "./BookingTimeline";
import { formatNaira, getBookingStatusLabel } from "@/lib/utils";

interface Props {
  bookingId: string;
  initialData: any;
}

export default function LiveBookingTracker({ bookingId, initialData }: Props) {
  const [booking, setBooking] = useState(initialData);
  const [polling, setPolling] = useState(true);

  const ACTIVE_STATUSES = [
    "PENDING_PAYMENT",
    "DISPATCHING",
    "ACCEPTED",
    "EN_ROUTE",
    "ARRIVED",
    "IN_SERVICE",
    "COMPLETED",
  ];

  const isActive = ACTIVE_STATUSES.includes(booking?.status);

  const fetchBooking = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`);
      const data = await res.json();
      if (data.success) {
        setBooking(data.data);
        if (!ACTIVE_STATUSES.includes(data.data.status)) {
          setPolling(false);
        }
      }
    } catch {
      /* ignore */
    }
  }, [bookingId]);

  useEffect(() => {
    if (!polling || !isActive) return;
    const interval = setInterval(fetchBooking, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [polling, isActive, fetchBooking]);

  if (!booking) return null;

  const timestamps = {
    createdAt: booking.createdAt,
    acceptedAt: booking.acceptedAt,
    enRouteAt: booking.enRouteAt,
    arrivedAt: booking.arrivedAt,
    completedAt: booking.completedAt,
    confirmedAt: booking.confirmedAt,
    cancelledAt: booking.cancelledAt,
  };

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl font-bold text-gray-900">
            {getBookingStatusLabel(booking.status)}
          </h2>
          {isActive && (
            <div className="flex items-center gap-1.5 text-xs text-brand-600 font-semibold">
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
              Live
            </div>
          )}
        </div>

        {/* Service info */}
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>{booking.service?.name ?? "Service"}</span>
          <span className="font-mono font-bold text-gray-900">
            {formatNaira(booking.totalAmount)}
          </span>
        </div>

        {/* Booking ref */}
        <p className="text-xs text-gray-400">
          Ref: {booking.reference}
        </p>
      </div>

      {/* Timeline */}
      <BookingTimeline
        currentStatus={booking.status}
        timestamps={timestamps}
      />

      {/* Pro card — when assigned */}
      {booking.pro && (
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Your beauty professional
          </p>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center text-lg font-bold text-white font-display">
              {booking.pro.name?.charAt(0) ?? "P"}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{booking.pro.name}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>★ {booking.pro.avgRating?.toFixed(1) ?? "—"}</span>
                <span>·</span>
                <span>{booking.pro.totalJobs ?? 0} jobs done</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location */}
      {booking.address && (
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Service location
          </p>
          <p className="text-sm text-gray-700">{booking.address}</p>
          {booking.zone?.name && (
            <p className="text-xs text-gray-400 mt-1">📍 {booking.zone.name}</p>
          )}
        </div>
      )}

      {/* Polling indicator */}
      {isActive && (
        <p className="text-center text-[10px] text-gray-400">
          Updates automatically every 10 seconds
        </p>
      )}
    </div>
  );
}
