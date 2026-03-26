"use client";

const TIMELINE_STEPS = [
  { status: "PENDING_PAYMENT", label: "Awaiting payment", icon: "💳" },
  { status: "DISPATCHING", label: "Finding your pro", icon: "🔍" },
  { status: "ACCEPTED", label: "Pro assigned", icon: "✅" },
  { status: "EN_ROUTE", label: "En route to you", icon: "🚗" },
  { status: "ARRIVED", label: "Pro arrived", icon: "📍" },
  { status: "IN_SERVICE", label: "Service in progress", icon: "✨" },
  { status: "COMPLETED", label: "Awaiting confirmation", icon: "⏳" },
  { status: "CONFIRMED", label: "Complete", icon: "🎉" },
];

interface Props {
  currentStatus: string;
  timestamps?: Record<string, string | null>;
}

export default function BookingTimeline({ currentStatus, timestamps = {} }: Props) {
  const currentIndex = TIMELINE_STEPS.findIndex(
    (s) => s.status === currentStatus,
  );

  // Terminal statuses
  if (currentStatus === "CANCELLED") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 p-4">
        <span className="text-2xl">❌</span>
        <div>
          <p className="font-semibold text-red-700">Booking cancelled</p>
          <p className="text-xs text-red-500">
            {timestamps.cancelledAt
              ? `at ${new Date(timestamps.cancelledAt).toLocaleString("en-NG")}`
              : ""}
          </p>
        </div>
      </div>
    );
  }

  if (currentStatus === "DISPUTED") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
        <span className="text-2xl">⚠️</span>
        <div>
          <p className="font-semibold text-amber-700">Dispute opened</p>
          <p className="text-xs text-amber-500">Our team is reviewing this booking.</p>
        </div>
      </div>
    );
  }

  if (currentStatus === "NO_GROOMER") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 p-4">
        <span className="text-2xl">😔</span>
        <div>
          <p className="font-semibold text-red-700">No pro available</p>
          <p className="text-xs text-red-500">
            We couldn&apos;t find a pro in your area right now. You can try again
            or request a refund.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-white/20 p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Booking progress</h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-gray-200" />
        <div
          className="absolute left-[15px] top-3 w-0.5 bg-brand-500 transition-all duration-500"
          style={{
            height: currentIndex >= 0
              ? `${Math.min(100, ((currentIndex + 0.5) / (TIMELINE_STEPS.length - 1)) * 100)}%`
              : "0%",
          }}
        />

        <div className="space-y-4">
          {TIMELINE_STEPS.map((step, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isPending = i > currentIndex;

            const tsKey = {
              PENDING_PAYMENT: "createdAt",
              DISPATCHING: "createdAt",
              ACCEPTED: "acceptedAt",
              EN_ROUTE: "enRouteAt",
              ARRIVED: "arrivedAt",
              IN_SERVICE: "arrivedAt",
              COMPLETED: "completedAt",
              CONFIRMED: "confirmedAt",
            }[step.status];

            const ts = tsKey ? timestamps[tsKey] : null;

            return (
              <div key={step.status} className="flex items-start gap-3 relative">
                {/* Dot */}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm transition-all ${
                    isCompleted
                      ? "bg-brand-600 text-white"
                      : isCurrent
                        ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500 ring-offset-2 animate-pulse"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isCompleted ? "✓" : step.icon}
                </div>

                {/* Label */}
                <div className="pt-1">
                  <p
                    className={`text-sm font-semibold ${
                      isCompleted || isCurrent
                        ? "text-gray-900"
                        : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  {ts && (isCompleted || isCurrent) && (
                    <p className="text-xs text-gray-400">
                      {new Date(ts).toLocaleTimeString("en-NG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
