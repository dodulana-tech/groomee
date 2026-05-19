"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import DayCalendar, { type CalendarBlock } from "@/components/scheduler/DayCalendar";

interface CalendarPayload {
  pro: { id: string; name: string };
  date: string;
  workingWindow: { start: string; end: string } | null;
  blocks: CalendarBlock[];
}

function shiftDate(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00+01:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Date(d.getTime() + 60 * 60_000).toISOString().slice(0, 10);
}

function formatHeading(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00+01:00`);
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lagos",
  }).format(d);
}

export default function PartnerCalendarBoard({
  initialDate,
}: {
  initialDate: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState<string>(initialDate);
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("date", date);
    router.replace(`?${p.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partner/calendar?date=${date}T12:00:00.000Z`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load calendar.");
        setData(null);
      } else {
        setData(json.data);
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const isToday = date === today;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            {isToday ? "Today" : "Day"}
          </p>
          <h2 className="font-display text-lg font-bold text-gray-900">
            {formatHeading(date)}
          </h2>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, -1))}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            ←
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-semibold text-gray-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, 1))}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            →
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(today)}
              className="ml-1 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}
      {loading && !data && (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          Loading…
        </div>
      )}
      {data && (
        <>
          <DayCalendar
            date={new Date(`${date}T12:00:00+01:00`)}
            workingWindow={data.workingWindow}
            blocks={data.blocks}
            onBlockClick={(b) => router.push(`/partner/bookings`)}
          />
          <div className="text-xs text-gray-400 text-center">
            Off this day?{" "}
            <Link href="/partner/schedule" className="font-semibold text-brand-600 hover:underline">
              Update your working hours →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
