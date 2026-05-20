"use client";

import type { ContraindicationHit } from "@/lib/health";

interface Props {
  hits: ContraindicationHit[];
  /**
   * Overall level (highest severity in `hits`). If undefined, computed from
   * the hits themselves.
   */
  level?: "INFO" | "WARN" | "BLOCK" | null;
  /**
   * Optional tighter wording for context. e.g. on the success screen we say
   * "your pro will be briefed on the following…", on the booking panel we
   * say "heads up — this affects your booking".
   */
  context?: "preview" | "post-booking";
  className?: string;
}

const STYLE: Record<
  "INFO" | "WARN" | "BLOCK",
  {
    container: string;
    title: string;
    icon: string;
    heading: string;
  }
> = {
  BLOCK: {
    container: "border-red-200 bg-red-50 text-red-900",
    title: "text-red-800",
    icon: "🚫",
    heading: "We can't safely take this booking",
  },
  WARN: {
    container: "border-amber-200 bg-amber-50 text-amber-900",
    title: "text-amber-800",
    icon: "⚠️",
    heading: "Heads up for your pro",
  },
  INFO: {
    container: "border-sky-200 bg-sky-50 text-sky-900",
    title: "text-sky-800",
    icon: "ℹ️",
    heading: "Good to know",
  },
};

export default function HealthWarningNotice({
  hits,
  level,
  context = "preview",
  className,
}: Props) {
  if (!hits || hits.length === 0) return null;

  // Compute level if caller didn't provide one.
  const computed: "INFO" | "WARN" | "BLOCK" =
    level ??
    (hits.some((h) => h.level === "BLOCK")
      ? "BLOCK"
      : hits.some((h) => h.level === "WARN")
        ? "WARN"
        : "INFO");

  const style = STYLE[computed];
  const subtitle =
    computed === "BLOCK"
      ? context === "preview"
        ? "Based on what's on your health profile, this pro can't safely perform one or more of the services you picked. Pick a different service or a different pro."
        : "Something on your health profile blocks one of these services. Please contact support."
      : context === "post-booking"
        ? "Your pro will be briefed on the following before they arrive:"
        : "These items on your health profile affect this booking. Your pro will be briefed.";

  return (
    <div
      role="alert"
      className={`rounded-2xl border p-4 text-sm ${style.container} ${className ?? ""}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-lg leading-none mt-0.5" aria-hidden>
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-bold ${style.title}`}>{style.heading}</p>
          <p className="mt-0.5 text-xs opacity-90">{subtitle}</p>
          <ul className="mt-2.5 space-y-2">
            {hits.map((h, idx) => {
              const itemStyle = STYLE[h.level];
              return (
                <li
                  key={`${h.conditionCode}-${h.serviceId ?? "any"}-${idx}`}
                  className="flex items-start gap-2"
                >
                  <span
                    className={`shrink-0 mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${itemStyle.container}`}
                  >
                    {h.level}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {h.conditionLabel}
                      {h.serviceName ? (
                        <span className="font-normal opacity-70">
                          {" "}
                          · {h.serviceName}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs opacity-90 leading-snug">
                      {h.message}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
