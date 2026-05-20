"use client";

import { useMemo } from "react";

export interface CalendarBlock {
  id: string;
  reference: string;
  status: string;
  start: string | null; // ISO
  end: string | null; // ISO
  durationMins: number;
  service: string;
  // All chained service names — primary first, then BookingItem rows.
  services?: string[];
  customer: string;
  zone: string | null;
  zoneId: string | null;
  travelToNextMins: number;
}

interface Props {
  /** Anchor day in WAT — used to derive the grid's calendar day. */
  date: Date;
  /** Working hours window (from ProSchedule) in UTC instants. */
  workingWindow: { start: string; end: string } | null;
  blocks: CalendarBlock[];
  /** Inclusive view range in WAT hours. Defaults 6→24. */
  startHour?: number;
  endHour?: number;
  pxPerMin?: number;
  /** Optional click handler when an empty slot is clicked. */
  onSlotClick?: (start: Date) => void;
  /** Optional click handler on a block. */
  onBlockClick?: (block: CalendarBlock) => void;
}

// Africa/Lagos is UTC+1 with no DST.
const WAT_OFFSET_MIN = 60;

function watYmd(d: Date): string {
  return new Date(d.getTime() + WAT_OFFSET_MIN * 60_000)
    .toISOString()
    .slice(0, 10);
}

function watInstant(ymd: string, hhmm: string): Date {
  return new Date(`${ymd}T${hhmm}:00+01:00`);
}

function fmtTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(d);
}

function statusColor(status: string) {
  switch (status) {
    case "COMPLETED":
    case "CONFIRMED":
      return { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-900", dot: "bg-emerald-500" };
    case "IN_SERVICE":
    case "ARRIVED":
    case "EN_ROUTE":
      return { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-900", dot: "bg-blue-500" };
    case "ACCEPTED":
      return { bg: "bg-brand-50", border: "border-brand-400", text: "text-brand-900", dot: "bg-brand-600" };
    case "DISPATCHING":
    case "PENDING_PAYMENT":
      return { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-900", dot: "bg-amber-500" };
    default:
      return { bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-800", dot: "bg-gray-400" };
  }
}

export default function DayCalendar({
  date,
  workingWindow,
  blocks,
  startHour = 6,
  endHour = 24,
  pxPerMin = 1.3,
  onSlotClick,
  onBlockClick,
}: Props) {
  const ymd = watYmd(date);
  const viewStart = watInstant(ymd, `${String(startHour).padStart(2, "0")}:00`);
  const viewEnd = watInstant(ymd, `${String(endHour % 24).padStart(2, "0")}:00`);
  // If endHour is 24, treat as next day's 00:00.
  const adjustedViewEnd =
    endHour === 24
      ? new Date(viewEnd.getTime() + 24 * 60 * 60_000)
      : viewEnd;

  const totalMins = (adjustedViewEnd.getTime() - viewStart.getTime()) / 60_000;
  const totalHeight = totalMins * pxPerMin;

  function offsetPx(iso: string | Date | null): number {
    if (!iso) return 0;
    const d = typeof iso === "string" ? new Date(iso) : iso;
    return ((d.getTime() - viewStart.getTime()) / 60_000) * pxPerMin;
  }

  const hourLines = useMemo(() => {
    const lines: { hour: number; offset: number; label: string }[] = [];
    for (let h = startHour; h <= (endHour === 24 ? 24 : endHour); h++) {
      const hourLabel = (() => {
        const hh = h % 24;
        const suffix = hh < 12 ? "AM" : "PM";
        const display = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        return `${display}:00 ${suffix}`;
      })();
      lines.push({
        hour: h,
        offset: (h - startHour) * 60 * pxPerMin,
        label: hourLabel,
      });
    }
    return lines;
  }, [startHour, endHour, pxPerMin]);

  const workingTop = workingWindow ? offsetPx(workingWindow.start) : null;
  const workingBottom = workingWindow ? offsetPx(workingWindow.end) : null;

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[80px_1fr]">
        {/* Hour gutter */}
        <div
          className="relative border-r border-gray-100 bg-gray-50/50"
          style={{ height: totalHeight }}
        >
          {hourLines.map((l) => (
            <div
              key={l.hour}
              className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-gray-400"
              style={{ top: l.offset }}
            >
              {l.label}
            </div>
          ))}
        </div>

        {/* Day column */}
        <div
          className="relative"
          style={{ height: totalHeight }}
          onClick={(e) => {
            if (!onSlotClick) return;
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const y = e.clientY - rect.top;
            const mins = Math.round(y / pxPerMin / 15) * 15;
            const click = new Date(viewStart.getTime() + mins * 60_000);
            onSlotClick(click);
          }}
        >
          {/* Out-of-hours wash */}
          {workingTop !== null && (
            <div
              className="absolute inset-x-0 bg-gray-100/40"
              style={{ top: 0, height: workingTop }}
            />
          )}
          {workingBottom !== null && (
            <div
              className="absolute inset-x-0 bg-gray-100/40"
              style={{ top: workingBottom, height: totalHeight - workingBottom }}
            />
          )}

          {/* Hour grid */}
          {hourLines.map((l) => (
            <div
              key={l.hour}
              className="absolute inset-x-0 border-t border-gray-100"
              style={{ top: l.offset }}
            />
          ))}

          {/* Half-hour faint grid */}
          {hourLines.slice(0, -1).map((l) => (
            <div
              key={`half-${l.hour}`}
              className="absolute inset-x-0 border-t border-dashed border-gray-50"
              style={{ top: l.offset + 30 * pxPerMin }}
            />
          ))}

          {/* Blocks */}
          {blocks.map((b, idx) => {
            if (!b.start || !b.end) return null;
            const top = offsetPx(b.start);
            const height = Math.max(28, b.durationMins * pxPerMin);
            const c = statusColor(b.status);
            const travel = b.travelToNextMins;
            return (
              <div key={b.id} className="absolute inset-x-2" style={{ top }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBlockClick?.(b);
                  }}
                  className={`w-full rounded-xl border-l-4 ${c.border} ${c.bg} ${c.text} px-3 py-2 text-left shadow-sm transition-all hover:shadow-md`}
                  style={{ height }}
                >
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide opacity-75">
                    <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                    {fmtTime(b.start)} – {fmtTime(b.end)}
                  </div>
                  <div className="mt-0.5 text-sm font-bold leading-tight truncate">
                    {b.service}
                    {b.services && b.services.length > 1 && (
                      <span className="ml-1.5 text-[10px] font-bold opacity-60">
                        +{b.services.length - 1}
                      </span>
                    )}
                  </div>
                  {b.services && b.services.length > 1 && (
                    <div
                      className="text-[10px] opacity-60 truncate"
                      title={b.services.join(" · ")}
                    >
                      {b.services.slice(1).join(" · ")}
                    </div>
                  )}
                  <div className="text-xs opacity-75 truncate">
                    {b.customer}
                    {b.zone ? ` · ${b.zone}` : ""}
                  </div>
                </button>
                {/* Travel ghost to the next block (if same day) */}
                {travel > 0 && idx < blocks.length - 1 && blocks[idx + 1]?.start && (
                  <div
                    className="mt-1 rounded-lg border border-dashed border-gray-300 bg-gray-50/70 px-3 py-1 text-[11px] font-medium text-gray-500"
                    style={{ height: Math.max(20, travel * pxPerMin - 4) }}
                  >
                    ↻ Travel · {travel} min
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state when no blocks */}
          {blocks.length === 0 && (
            <div
              className="absolute inset-x-0 flex flex-col items-center justify-center text-center"
              style={{ top: workingTop ?? totalHeight / 2 - 30, height: 60 }}
            >
              <p className="text-sm font-medium text-gray-400">
                Nothing scheduled
              </p>
              <p className="text-xs text-gray-300">
                {workingWindow
                  ? `Working ${fmtTime(workingWindow.start)} – ${fmtTime(workingWindow.end)}`
                  : "Off today"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
