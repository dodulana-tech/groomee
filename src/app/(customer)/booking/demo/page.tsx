import BookingTimeline from "@/components/customer/BookingTimeline";
import Link from "next/link";

const MOCK_TIMESTAMPS = {
  createdAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
  acceptedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  enRouteAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
};

export default function BookingDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Demo banner */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex items-start gap-3">
          <span className="text-2xl shrink-0">🎭</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              This is a demo — book a real service to get started!
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Below is a preview of what your booking tracking looks like in
              real-time.
            </p>
            <Link
              href="/search"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
            >
              ⚡ Book now
            </Link>
          </div>
        </div>

        {/* Mock booking card */}
        <div className="glass rounded-2xl border border-white/20 shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                Demo booking
              </p>
              <h2 className="font-display text-xl font-bold text-gray-900 mt-0.5">
                Kemi&apos;s Braiding Studio
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
              🚗 En route
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-0.5">Service</p>
              <p className="font-semibold text-gray-900">Box Braids (medium)</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-0.5">Arriving in</p>
              <p className="font-semibold text-brand-700">~12 mins</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-0.5">Location</p>
              <p className="font-semibold text-gray-900 truncate">
                15 Admiralty Way, Lekki
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400 mb-0.5">Amount</p>
              <p className="font-semibold text-gray-900">₦18,000</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <BookingTimeline
          currentStatus="EN_ROUTE"
          timestamps={MOCK_TIMESTAMPS}
        />

        {/* Pro info card */}
        <div className="glass rounded-2xl border border-white/20 p-5 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-brand-100 flex items-center justify-center text-2xl shrink-0">
            💅
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900">Kemi Adeleke</p>
            <p className="text-xs text-gray-500">Hair · 4.9 ★ · 312 bookings</p>
          </div>
          <a
            href="tel:+2348000000000"
            className="rounded-xl bg-brand-50 border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
          >
            📞 Call
          </a>
        </div>
      </div>
    </div>
  );
}
