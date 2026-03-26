import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  formatNaira,
  getBookingStatusLabel,
  getBookingStatusColor,
  cn,
} from "@/lib/utils";
import { format } from "date-fns";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Bookings" };

const STATUS_TOOLTIP: Record<string, string> = {
  PENDING_PAYMENT: "Waiting for your payment to complete",
  DISPATCHING: "We're finding a beauty pro near you",
  ACCEPTED: "A pro has accepted your booking",
  EN_ROUTE: "Your pro is on the way",
  ARRIVED: "Your pro has arrived at your location",
  IN_SERVICE: "Your service is in progress",
  COMPLETED: "Service completed — please confirm",
  CONFIRMED: "All done! Thanks for using Groomee",
  CANCELLED: "This booking was cancelled",
  NO_GROOMER: "We couldn't find a pro for this booking",
};

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) redirect("/auth?redirect=/bookings");

  const bookings = await db.booking.findMany({
    where: { customerId: session.userId },
    include: {
      service: true,
      pro: true,
      zone: true,
      review: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <h1 className="mb-6 font-display text-2xl font-bold">My Bookings</h1>

      {bookings.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <p className="text-4xl mb-3">💅🏿</p>
          <p className="font-semibold text-gray-700">No bookings yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Time to book your first beauty pro!
          </p>
          <Link href="/search" className="btn-primary btn-md mt-6 inline-flex">
            Find a pro
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Link key={b.id} href={`/booking/${b.id}`}>
              <div className="card-hover p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "status-pill text-xs",
                          getBookingStatusColor(b.status),
                        )}
                        title={STATUS_TOOLTIP[b.status] ?? ""}
                      >
                        {getBookingStatusLabel(b.status)}
                      </span>
                      {b.isAsap && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                          ⚡ Emergency
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">
                      {b.service.name}
                    </p>
                    {b.pro && (
                      <p className="text-sm text-gray-500">
                        with {b.pro.name}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {format(new Date(b.createdAt), "dd MMM yyyy, h:mm aaa")} ·{" "}
                      {b.reference}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-gray-900">
                      {formatNaira(b.totalAmount)}
                    </p>
                    {b.status === "CONFIRMED" && !b.review && (
                      <p className="mt-1 text-xs text-brand-600 font-medium">
                        Leave a review →
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
