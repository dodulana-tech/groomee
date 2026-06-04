"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Config {
  enabled: boolean;
  cooldownHours: number;
  thresholdDefault: number;
}

export default function InventorySettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/inventory/settings")
      .then((r) => r.json())
      .then((d) => setConfig(d.data))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/inventory/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: config.enabled,
          cooldownHours: config.cooldownHours,
          thresholdDefault: config.thresholdDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setConfig(data.data);
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex h-32 items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200"
            style={{ borderTopColor: "#1A3A2A" }}
          />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6 lg:p-8 text-sm text-gray-500">
        Could not load settings.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/inventory" className="hover:text-gray-700">
          Inventory
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">Settings</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Inventory settings
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Controls the auto-decrement hook on confirm and the low-stock alert
        throttle for beauty professionals.
      </p>

      <form onSubmit={save} className="glass-card rounded-2xl p-6 space-y-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              setConfig((c) => (c ? { ...c, enabled: e.target.checked } : c))
            }
            className="mt-1 h-4 w-4"
          />
          <div>
            <p className="font-bold text-gray-900 text-sm">
              Inventory tracking enabled
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              When off, confirms will not decrement product stock and low-stock
              alerts will not fire. Manual restock + adjust still work.
            </p>
          </div>
        </label>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Default low-stock threshold
          </label>
          <input
            type="number"
            min="0"
            max="1000"
            value={config.thresholdDefault}
            onChange={(e) =>
              setConfig((c) =>
                c ? { ...c, thresholdDefault: Number(e.target.value) } : c,
              )
            }
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
          />
          <p className="text-xs text-gray-500 mt-1">
            Applied to new ProInventory rows when a pro hasn't set their own
            threshold for a product.
          </p>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Low-stock alert cooldown (hours)
          </label>
          <input
            type="number"
            min="0"
            max="720"
            value={config.cooldownHours}
            onChange={(e) =>
              setConfig((c) =>
                c ? { ...c, cooldownHours: Number(e.target.value) } : c,
              )
            }
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
          />
          <p className="text-xs text-gray-500 mt-1">
            Minimum gap between low-stock WhatsApps for the same (pro, product)
            pair. 24 is a reasonable default.
          </p>
        </div>

        {error && (
          <p className="text-sm font-medium text-red-500">{error}</p>
        )}
        {saved && (
          <p className="text-sm font-medium" style={{ color: "#166534" }}>
            Settings saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: saving ? "#9CA3AF" : "#1A3A2A" }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
