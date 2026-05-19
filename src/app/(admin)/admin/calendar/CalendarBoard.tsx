"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import DayCalendar, { type CalendarBlock } from "@/components/scheduler/DayCalendar";

interface ProRow {
  id: string;
  name: string;
  city: string;
}

interface Props {
  pros: ProRow[];
  initialProId: string | null;
  initialDate: string;
}

interface CalendarPayload {
  pro: { id: string; name: string; status: string; availability: string };
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

export default function CalendarBoard({
  pros,
  initialProId,
  initialDate,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [proId, setProId] = useState<string | null>(initialProId);
  const [date, setDate] = useState<string>(initialDate);
  const [data, setData] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep URL in sync so the admin can deep-link.
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (proId) p.set("proId", proId);
    p.set("date", date);
    router.replace(`?${p.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proId, date]);

  const load = useCallback(async () => {
    if (!proId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/pros/${proId}/calendar?date=${date}T12:00:00.000Z`,
      );
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
  }, [proId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const isToday = date === today;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Beauty pro
          </label>
          <select
            value={proId ?? ""}
            onChange={(e) => setProId(e.target.value || null)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-brand-400 focus:outline-none"
          >
            {pros.length === 0 && <option value="">No active pros</option>}
            {pros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.city}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, -1))}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Prev
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
            Next →
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

      {/* Header strip */}
      {data && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <div>
            <h2 className="font-display text-xl font-bold text-gray-900">
              {data.pro.name}
            </h2>
            <p className="text-xs text-gray-500">
              {formatHeading(date)} · {data.blocks.length}{" "}
              {data.blocks.length === 1 ? "booking" : "bookings"}
              {data.workingWindow ? "" : " · off today"}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${
              data.pro.availability === "ONLINE"
                ? "bg-emerald-50 text-emerald-700"
                : data.pro.availability === "BUSY"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {data.pro.availability}
          </span>
        </div>
      )}

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
        <DayCalendar
          date={new Date(`${date}T12:00:00+01:00`)}
          workingWindow={data.workingWindow}
          blocks={data.blocks}
          onBlockClick={(b) => router.push(`/admin/bookings/${b.id}`)}
        />
      )}

      {data && data.blocks.length > 0 && (
        <div className="text-xs text-gray-400 text-center">
          Click any booking to open it ·{" "}
          <Link href="/admin/settings/travel-times" className="font-semibold text-brand-600 hover:underline">
            Manage travel times →
          </Link>
        </div>
      )}
    </div>
  );
}
