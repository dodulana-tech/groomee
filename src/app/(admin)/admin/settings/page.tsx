"use client";

import { useState, useEffect } from "react";

interface Setting {
  key: string;
  value: string;
}

const SETTING_META: Record<
  string,
  {
    label: string;
    description: string;
    type: "number" | "percent" | "boolean" | "text";
  }
> = {
  EMERGENCY_THRESHOLD_MINUTES: {
    label: "Emergency threshold (minutes)",
    description:
      'Bookings created less than this many minutes ahead are considered "emergency"',
    type: "number",
  },
  EMERGENCY_SURCHARGE_RATE: {
    label: "Emergency surcharge rate",
    description: "Percentage added to base price for emergency bookings",
    type: "percent",
  },
  LATENIGHT_START_HOUR: {
    label: "Late night start hour (24h)",
    description: "0–23. Late night surcharge applies from this hour",
    type: "number",
  },
  LATENIGHT_END_HOUR: {
    label: "Late night end hour (24h)",
    description: "0–23. Late night surcharge ends at this hour",
    type: "number",
  },
  LATENIGHT_SURCHARGE_RATE: {
    label: "Late night surcharge rate",
    description: "Percentage added for bookings during late night hours",
    type: "percent",
  },
  EARLYMORNING_START_HOUR: {
    label: "Early morning start hour (24h)",
    type: "number",
    description: "",
  },
  EARLYMORNING_END_HOUR: {
    label: "Early morning end hour (24h)",
    type: "number",
    description: "",
  },
  EARLYMORNING_SURCHARGE_RATE: {
    label: "Early morning surcharge rate",
    type: "percent",
    description: "",
  },
  DISPATCH_TIMEOUT_SECONDS: {
    label: "Dispatch timeout (seconds)",
    description:
      "How long to wait for a groomer to respond before trying the next",
    type: "number",
  },
  DISPATCH_MAX_ATTEMPTS: {
    label: "Max dispatch attempts",
    description: "Maximum number of groomers to try per booking",
    type: "number",
  },
  AUTO_CAPTURE_HOURS: {
    label: "Auto-capture after (hours)",
    description:
      'Hours after service "done" before payment auto-captures without customer confirmation',
    type: "number",
  },
  PLATFORM_COMMISSION: {
    label: "Platform commission rate",
    description: "Percentage of base service fee kept by platform",
    type: "percent",
  },
  SURGE_ACTIVE: {
    label: "Surge pricing active",
    description: "Enable surge pricing (overrides all other surcharges)",
    type: "boolean",
  },
  SURGE_RATE: {
    label: "Surge rate",
    description: "Percentage added during surge pricing",
    type: "percent",
  },
  MIN_BOOKING_LEAD_MINUTES: {
    label: "Min booking lead time (minutes)",
    description: "Minimum minutes ahead a scheduled booking must be placed",
    type: "number",
  },
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load from API
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.data ?? []);
        const map: Record<string, string> = {};
        (d.data ?? []).forEach((s: Setting) => {
          map[s.key] = s.value;
        });
        setEdits(map);
      });
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: edits }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Platform Settings
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Surcharges, dispatch, and commission configuration
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary btn-md">
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save changes"}
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(SETTING_META).map(([key, meta]) => {
          const val = edits[key] ?? "";
          return (
            <div key={key} className="card p-5">
              <label className="mb-0.5 block text-sm font-semibold text-gray-900">
                {meta.label}
              </label>
              {meta.description && (
                <p className="mb-3 text-xs text-gray-500">{meta.description}</p>
              )}
              {meta.type === "boolean" ? (
                <label className="flex cursor-pointer items-center gap-3">
                  <div
                    onClick={() =>
                      setEdits((e) => ({
                        ...e,
                        [key]: val === "true" ? "false" : "true",
                      }))
                    }
                    className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${val === "true" ? "bg-brand-600" : "bg-gray-200"}`}
                  >
                    <div
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${val === "true" ? "translate-x-5.5" : "translate-x-0.5"}`}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {val === "true" ? "Enabled" : "Disabled"}
                  </span>
                </label>
              ) : meta.type === "percent" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    value={Math.round(parseFloat(val || "0") * 100)}
                    onChange={(e) =>
                      setEdits((ed) => ({
                        ...ed,
                        [key]: (parseFloat(e.target.value) / 100).toString(),
                      }))
                    }
                    className="input w-28"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              ) : (
                <input
                  type="number"
                  value={val}
                  onChange={(e) =>
                    setEdits((ed) => ({ ...ed, [key]: e.target.value }))
                  }
                  className="input w-32"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary btn-lg">
          {saving ? "Saving…" : saved ? "✓ Saved!" : "Save all changes"}
        </button>
      </div>
    </div>
  );
}
