"use client";

import { useEffect, useState } from "react";

interface Settings {
  enabled: boolean;
  minBookings: number;
  minTenureDays: number;
  graceDays: number;
  pauseDays: number;
}

export default function ConfigPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function load() {
    return fetch("/api/admin/benefits/config")
      .then((r) => r.json())
      .then((d) => setSettings(d.data));
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/benefits/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          BENEFITS_ENABLED: settings.enabled ? "true" : "false",
          BENEFITS_MIN_BOOKINGS: String(settings.minBookings),
          BENEFITS_MIN_TENURE_DAYS: String(settings.minTenureDays),
          BENEFITS_GRACE_DAYS: String(settings.graceDays),
          BENEFITS_PAUSE_DAYS: String(settings.pauseDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSettings(data.data);
      setMessage("Settings saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return <div className="p-6"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200" style={{ borderTopColor: "#1A3A2A" }} /></div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Benefits configuration</h1>
      <p className="text-sm text-gray-500 mb-6">Eligibility gates + failure-cascade windows. Plans can override.</p>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings((s) => s && { ...s, enabled: e.target.checked })} />
          <div>
            <p className="font-bold text-gray-900">Benefits enabled</p>
            <p className="text-xs text-gray-500">Turning off halts the debit cron but keeps existing enrolments intact.</p>
          </div>
        </label>
        <NumField label="Min completed bookings (last 30 days)" value={settings.minBookings} onChange={(v) => setSettings((s) => s && { ...s, minBookings: v })} />
        <NumField label="Min tenure (days since first booking)" value={settings.minTenureDays} onChange={(v) => setSettings((s) => s && { ...s, minTenureDays: v })} />
        <NumField label="Grace window (days) — failed debit → GRACE for N days" value={settings.graceDays} onChange={(v) => setSettings((s) => s && { ...s, graceDays: v })} />
        <NumField label="Pause window (days) — PAUSED for N days before CANCELLED" value={settings.pauseDays} onChange={(v) => setSettings((s) => s && { ...s, pauseDays: v })} />
        {message && <p className="text-sm text-gray-700">{message}</p>}
        <button disabled={saving} onClick={save} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#1A3A2A" }}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
    </div>
  );
}
