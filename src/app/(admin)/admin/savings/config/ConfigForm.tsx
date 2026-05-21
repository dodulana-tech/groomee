"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SavingsSettings {
  enabled: boolean;
  rate: number;
  sliderMin: number;
  sliderMax: number;
  noticeDays: number;
  penaltyPct: number;
  clawbackHours: number;
  matchBonusPct: number;
}

export default function ConfigForm({ initial }: { initial: SavingsSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<SavingsSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/savings/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Save failed");
      } else {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof SavingsSettings>(key: K, value: SavingsSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 text-red-700 px-3 py-2 text-sm">{error}</div>
      )}
      {saved && (
        <div className="rounded-xl bg-green-50 border border-green-100 text-green-700 px-3 py-2 text-sm">Saved.</div>
      )}

      <div className="glass-card rounded-2xl p-4">
        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">Earnings Reserve enabled</p>
            <p className="text-xs text-gray-500">Off → SKIM is a no-op on every confirm.</p>
          </div>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Default skim rate"
          hint={`Within ${(form.sliderMin * 100).toFixed(0)}–${(form.sliderMax * 100).toFixed(0)}%`}
          suffix="%"
          value={form.rate * 100}
          onChange={(v) => set("rate", v / 100)}
          step={0.1}
          min={0}
          max={100}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Slider min"
            suffix="%"
            value={form.sliderMin * 100}
            onChange={(v) => set("sliderMin", v / 100)}
            step={0.1}
            min={0}
            max={100}
          />
          <Field
            label="Slider max"
            suffix="%"
            value={form.sliderMax * 100}
            onChange={(v) => set("sliderMax", v / 100)}
            step={0.1}
            min={0}
            max={100}
          />
        </div>
        <Field
          label="Notice days"
          suffix="days"
          value={form.noticeDays}
          onChange={(v) => set("noticeDays", v)}
          step={1}
          min={1}
          max={90}
        />
        <Field
          label="Instant-break penalty"
          suffix="%"
          value={form.penaltyPct * 100}
          onChange={(v) => set("penaltyPct", v / 100)}
          step={0.5}
          min={0}
          max={50}
        />
        <Field
          label="Clawback window"
          suffix="hours"
          hint="Refunds beyond this leave the skim in vault; Groomee absorbs loss."
          value={form.clawbackHours}
          onChange={(v) => set("clawbackHours", v)}
          step={1}
          min={0}
          max={168}
        />
        <Field
          label="Match bonus (loyalty top-up)"
          suffix="%"
          hint="Paid from take-rate on every notice-period withdrawal."
          value={form.matchBonusPct * 100}
          onChange={(v) => set("matchBonusPct", v / 100)}
          step={0.1}
          min={0}
          max={10}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save configuration"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
  step = 0.1,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-3">
      <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-lg font-bold text-gray-900"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
