"use client";

import { useEffect, useMemo, useState } from "react";

interface Zone {
  id: string;
  name: string;
  slug: string;
  city: string;
}
interface Pair {
  fromZoneId: string;
  toZoneId: string;
  travelMins: number;
  isActive: boolean;
}

const DEFAULT_MINS = 30;

export default function TravelTimesEditor() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [pairs, setPairs] = useState<Map<string, Pair>>(new Map());
  const [city, setCity] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const cities = useMemo(
    () => [...new Set(zones.map((z) => z.city))].sort(),
    [zones],
  );
  const cityZones = useMemo(
    () => zones.filter((z) => z.city === city).sort((a, b) => a.name.localeCompare(b.name)),
    [zones, city],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/admin/travel-times")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const z: Zone[] = d.data?.zones ?? [];
        const p: Pair[] = d.data?.pairs ?? [];
        setZones(z);
        setPairs(new Map(p.map((x) => [`${x.fromZoneId}|${x.toZoneId}`, x])));
        const firstCity = [...new Set(z.map((zz: Zone) => zz.city))][0] ?? "";
        setCity(firstCity);
      })
      .catch(() => setSaveError("Failed to load travel times."))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function valueFor(fromId: string, toId: string): number | null {
    if (fromId === toId) return 0;
    const key = `${fromId}|${toId}`;
    const p = pairs.get(key);
    return p ? p.travelMins : null;
  }

  function setCell(fromId: string, toId: string, raw: string) {
    if (fromId === toId) return;
    const trimmed = raw.trim();
    const num = trimmed === "" ? null : Number(trimmed);
    setDirty(true);
    setPairs((prev) => {
      const next = new Map(prev);
      const key = `${fromId}|${toId}`;
      if (num === null || Number.isNaN(num)) {
        next.delete(key);
      } else {
        next.set(key, {
          fromZoneId: fromId,
          toZoneId: toId,
          travelMins: Math.max(0, Math.min(600, Math.round(num))),
          isActive: true,
        });
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        pairs: Array.from(pairs.values()).filter(
          (p) => p.fromZoneId !== p.toZoneId,
        ),
      };
      const res = await fetch("/api/admin/travel-times", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? "Failed to save.");
      } else {
        setDirty(false);
      }
    } catch {
      setSaveError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
          City
        </label>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-3">
          {dirty && (
            <span className="text-xs font-semibold text-amber-600">
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {saveError}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-widest text-gray-500">
              <th className="px-4 py-3 font-bold">From ↓ / To →</th>
              {cityZones.map((z) => (
                <th
                  key={z.id}
                  className="border-l border-gray-100 px-3 py-3 text-center font-bold whitespace-nowrap"
                >
                  {z.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cityZones.map((from) => (
              <tr key={from.id} className="border-t border-gray-100">
                <th className="px-4 py-2 text-left font-bold text-gray-700 whitespace-nowrap">
                  {from.name}
                </th>
                {cityZones.map((to) => {
                  const isSelf = from.id === to.id;
                  const v = valueFor(from.id, to.id);
                  const isDefault = !isSelf && v === null;
                  return (
                    <td
                      key={to.id}
                      className={`border-l border-gray-100 px-2 py-1.5 text-center ${
                        isSelf ? "bg-gray-50" : ""
                      }`}
                    >
                      {isSelf ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={600}
                          value={v ?? ""}
                          placeholder={String(DEFAULT_MINS)}
                          onChange={(e) =>
                            setCell(from.id, to.id, e.target.value)
                          }
                          className={`w-16 rounded-lg border px-2 py-1 text-center text-sm font-semibold focus:outline-none ${
                            isDefault
                              ? "border-gray-100 bg-gray-50 text-gray-300 focus:border-brand-300 focus:bg-white focus:text-gray-900"
                              : "border-gray-200 bg-white text-gray-900 focus:border-brand-400"
                          }`}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Times in minutes. Self-cells are always 0 (same zone). Empty cells fall
        back to the default of {DEFAULT_MINS} min.
      </p>
    </div>
  );
}
