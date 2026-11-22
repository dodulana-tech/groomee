import type { Metadata } from "next";
import Link from "next/link";
import { getSession, hasPermission } from "@/lib/auth";
import ConciergeBookingForm from "./ConciergeBookingForm";

export const metadata: Metadata = { title: "New concierge booking | Admin" };
export const revalidate = 0;

export default async function NewConciergeBookingPage() {
  const session = await getSession();
  if (!hasPermission(session, "bookings.manage")) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h1 className="text-lg font-bold text-gray-900">No access</h1>
          <p className="mt-1 text-sm text-gray-500">
            Creating bookings needs the &ldquo;Manage bookings&rdquo; permission. Ask an admin to add it to your role.
          </p>
          <Link href="/admin/bookings" className="mt-4 inline-block text-sm font-semibold text-brand-deep">
            ← Back to bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      <div className="mb-5">
        <Link href="/admin/bookings" className="text-xs font-semibold text-gray-400 hover:text-gray-600">
          ← Bookings
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">New concierge booking</h1>
        <p className="mt-1 text-sm text-gray-500">
          Turn a WhatsApp chat into a paid booking. The customer gets a Paystack link; once they pay, it runs like any other booking.
        </p>
      </div>
      <ConciergeBookingForm />
    </div>
  );
}
