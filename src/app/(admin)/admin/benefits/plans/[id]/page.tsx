"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  slug: string;
  kind: string;
  provider: string;
  monthlyPremium: number;
  coverAmount: number | null;
  description: string | null;
  highlights: string[];
  minBookings: number;
  minTenureDays: number;
  isActive: boolean;
  sortOrder: number;
  subsidyRules: { id: string; proTier: string; subsidyPct: number }[];
  enrollments: Array<{
    id: string;
    status: string;
    pro: { id: string; name: string; phone: string };
    nextDebitAt: string;
  }>;
}

const TIERS = ["STANDARD", "PRO", "ELITE"] as const;

export default function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<Partial<Plan>>({});
  const [highlightsText, setHighlightsText] = useState("");
  const [subsidies, setSubsidies] = useState<Record<string, number>>({
    STANDARD: 0,
    PRO: 0.5,
    ELITE: 1,
  });

  function load() {
    return fetch(`/api/admin/benefits/plans/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const p: Plan = d.data;
        setPlan(p);
        setForm({
          name: p.name,
          provider: p.provider,
          monthlyPremium: p.monthlyPremium,
          coverAmount: p.coverAmount,
          description: p.description,
          minBookings: p.minBookings,
          minTenureDays: p.minTenureDays,
          isActive: p.isActive,
          sortOrder: p.sortOrder,
        });
        setHighlightsText(p.highlights.join("\n"));
        const map: Record<string, number> = { STANDARD: 0, PRO: 0.5, ELITE: 1 };
        for (const r of p.subsidyRules) map[r.proTier] = r.subsidyPct;
        setSubsidies(map);
      });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  async function savePlan() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/benefits/plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          highlights: highlightsText.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessage("Saved.");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveSubsidies() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/benefits/plans/${id}/subsidies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          TIERS.map((t) => ({ tier: t, pct: subsidies[t] })),
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessage("Subsidies updated.");
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !plan) {
    return <div className="p-6"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200" style={{ borderTopColor: "#1A3A2A" }} /></div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <Link href="/admin/benefits/plans" className="text-xs text-gray-400 hover:text-gray-700">← Plans</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{plan.name}</h1>
        <p className="text-sm text-gray-500">{plan.provider} · {plan.kind}</p>
      </div>

      {message && <p className="text-sm text-gray-700">{message}</p>}

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="font-bold text-gray-900">Plan details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name" value={form.name ?? ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Field label="Provider" value={form.provider ?? ""} onChange={(v) => setForm((f) => ({ ...f, provider: v }))} />
          <Field label="Monthly premium (₦)" type="number" value={String(form.monthlyPremium ?? 0)} onChange={(v) => setForm((f) => ({ ...f, monthlyPremium: Number(v) }))} />
          <Field label="Cover amount (₦)" type="number" value={String(form.coverAmount ?? "")} onChange={(v) => setForm((f) => ({ ...f, coverAmount: v ? Number(v) : null }))} />
          <Field label="Min bookings (30d)" type="number" value={String(form.minBookings ?? 0)} onChange={(v) => setForm((f) => ({ ...f, minBookings: Number(v) }))} />
          <Field label="Min tenure days" type="number" value={String(form.minTenureDays ?? 0)} onChange={(v) => setForm((f) => ({ ...f, minTenureDays: Number(v) }))} />
          <Field label="Sort order" type="number" value={String(form.sortOrder ?? 0)} onChange={(v) => setForm((f) => ({ ...f, sortOrder: Number(v) }))} />
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Active</label>
            <select
              value={String(form.isActive ?? true)}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === "true" }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
            >
              <option value="true">Yes</option>
              <option value="false">No (soft delete)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Description</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Highlights (one per line)</label>
          <textarea
            value={highlightsText}
            onChange={(e) => setHighlightsText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
          />
        </div>
        <button disabled={saving} onClick={savePlan} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#1A3A2A" }}>
          {saving ? "Saving…" : "Save plan"}
        </button>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-bold text-gray-900">Subsidy rules</h2>
          <p className="text-xs text-gray-500 mt-1">% Groomee covers per tier (rest comes from pro&apos;s wallet)</p>
        </div>
        <div className="space-y-3">
          {TIERS.map((t) => (
            <div key={t} className="flex items-center gap-4">
              <span className="w-24 text-sm font-bold text-gray-700">{t}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={subsidies[t]}
                onChange={(e) => setSubsidies((s) => ({ ...s, [t]: Number(e.target.value) }))}
                className="flex-1"
              />
              <span className="w-16 text-right text-sm font-bold text-gray-800">
                {(subsidies[t] * 100).toFixed(0)}%
              </span>
              <span className="w-32 text-right text-xs text-gray-500">
                Pro pays {formatNaira(Math.round(plan.monthlyPremium * (1 - subsidies[t])))}
              </span>
            </div>
          ))}
        </div>
        <button disabled={saving} onClick={saveSubsidies} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#1A3A2A" }}>
          {saving ? "Saving…" : "Save subsidies"}
        </button>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-bold text-gray-900 mb-4">Recent enrolments</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="py-2">Pro</th>
              <th className="py-2">Status</th>
              <th className="py-2">Next debit</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {plan.enrollments.map((e) => (
              <tr key={e.id}>
                <td className="py-2 text-gray-700">{e.pro.name} <span className="text-xs text-gray-400">{e.pro.phone}</span></td>
                <td className="py-2 text-gray-600">{e.status}</td>
                <td className="py-2 text-xs text-gray-500">{new Date(e.nextDebitAt).toLocaleDateString()}</td>
                <td className="py-2 text-right">
                  <Link href={`/admin/benefits/enrollments/${e.id}`} className="text-xs font-semibold text-gray-500 hover:text-gray-800">View →</Link>
                </td>
              </tr>
            ))}
            {plan.enrollments.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-sm text-gray-400">No enrolments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
      />
    </div>
  );
}
