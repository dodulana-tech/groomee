"use client";

import { useState, useEffect } from "react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface DaySchedule {
  isActive: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map((_, i) => ({
  isActive: i >= 1 && i <= 5,
  startTime: "09:00",
  endTime: "21:00",
}));

export default function PartnerSchedulePage() {
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/partner/schedule")
      .then((r) => r.json())
      .then((d) => {
        if (d.data?.schedule && Array.isArray(d.data.schedule) && d.data.schedule.length === 7) {
          setSchedule(d.data.schedule);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(index: number) {
    setSchedule((s) =>
      s.map((d, i) => (i === index ? { ...d, isActive: !d.isActive } : d)),
    );
    setSaved(false);
  }

  function updateTime(index: number, field: "startTime" | "endTime", value: string) {
    setSchedule((s) =>
      s.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/partner/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-sm text-gray-500">
            Set your weekly availability. Customers can only book you during these hours.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="btn-primary btn-md"
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
        </button>
      </div>

      <div className="glass rounded-2xl border border-white/20 shadow-lg divide-y divide-gray-100">
        {DAYS.map((day, i) => (
          <div
            key={day}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 transition-colors ${
              schedule[i].isActive ? "" : "opacity-50"
            }`}
          >
            {/* Toggle */}
            <button
              onClick={() => toggleDay(i)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                schedule[i].isActive ? "bg-brand-500" : "bg-gray-200"
              }`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  schedule[i].isActive ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>

            {/* Day name */}
            <p className="sm:w-28 text-sm font-semibold text-gray-900">{day}</p>

            {/* Time pickers */}
            {schedule[i].isActive ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={schedule[i].startTime}
                  onChange={(e) => updateTime(i, "startTime", e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="time"
                  value={schedule[i].endTime}
                  onChange={(e) => updateTime(i, "endTime", e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700"
                />
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not available</p>
            )}
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-2">💡 Tips</h2>
        <ul className="space-y-2 text-sm text-gray-500">
          <li>• Pros who are available on weekends earn 30% more on average</li>
          <li>• Evening slots (6pm-10pm) have the highest demand</li>
          <li>• Consistent availability builds trust and repeat customers</li>
        </ul>
      </div>
    </div>
  );
}
