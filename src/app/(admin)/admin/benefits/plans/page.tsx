"use client";

import { useEffect, useState } from "react";
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
  _count?: { enrollments: number };
}

const KINDS = ["BUNDLE", "HMO", "ACCIDENT"];

const EMPTY = {
  name: "",
  slug: "",
  kind: "BUNDLE",
  provider: "",
  monthlyPremium: "",
  coverAmount: "",
  description: "",
  highlights: "",
  minBookings: "5",
  minTenureDays: "30",
};

export default function BenefitsPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    return fetch("/api/admin/benefits/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.data ?? []));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim() || form.name.toLowerCase().replace(/\s+/g, "-"),
        kind: form.kind,
        provider: form.provider.trim(),
        monthlyPremium: Number(form.monthlyPremium),
        coverAmount: form.coverAmount ? Number(form.coverAmount) : null,
        description: form.description.trim() || null,
        highlights: form.highlights
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        minBookings: Number(form.minBookings),
        minTenureDays: Number(form.minTenureDays),
      };
      const res = await fetch("/api/admin/benefits/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      await load();
      setShowModal(false);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Plan) {
    await fetch(`/api/admin/benefits/plans/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benefit plans</h1>
          <p className="mt-1 text-sm text-gray-500">
            {plans.length} plan{plans.length === 1 ? "" : "s"} · HMO + accident
            bundles
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "#1A3A2A" }}
        >
          + Add plan
        </button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200"
            style={{ borderTopColor: "#1A3A2A" }}
          />
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Plan", "Kind", "Premium", "Cover", "Eligibility", "Active enrolments", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {plans.map((p) => (
                <tr key={p.id} className={p.isActive ? "" : "opacity-50"}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.provider}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.kind}</td>
                  <td className="px-4 py-3 font-bold text-gray-800">
                    {formatNaira(p.monthlyPremium)}
                    <span className="text-xs text-gray-400">/mo</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.coverAmount ? formatNaira(p.coverAmount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.minBookings} bookings · {p.minTenureDays} days
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p._count?.enrollments ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className="rounded-full px-3 py-1 text-xs font-bold"
                      style={{
                        background: p.isActive ? "#DCFCE7" : "#F3F4F6",
                        color: p.isActive ? "#166534" : "#6B7280",
                      }}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/benefits/plans/${p.id}`}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                    No plans yet. Create the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">New benefit plan</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <Field label="Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
              <Field label="Provider" value={form.provider} onChange={(v) => setForm((f) => ({ ...f, provider: v }))} placeholder="Reliance HMO + Leadway" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Kind</label>
                  <select
                    value={form.kind}
                    onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
                  >
                    {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <Field label="Monthly premium (₦) *" value={form.monthlyPremium} type="number" onChange={(v) => setForm((f) => ({ ...f, monthlyPremium: v }))} />
                <Field label="Cover amount (₦)" value={form.coverAmount} type="number" onChange={(v) => setForm((f) => ({ ...f, coverAmount: v }))} />
                <Field label="Min completed bookings (30d)" value={form.minBookings} type="number" onChange={(v) => setForm((f) => ({ ...f, minBookings: v }))} />
                <Field label="Min tenure (days)" value={form.minTenureDays} type="number" onChange={(v) => setForm((f) => ({ ...f, minTenureDays: v }))} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Highlights (one per line)</label>
                <textarea
                  value={form.highlights}
                  onChange={(e) => setForm((f) => ({ ...f, highlights: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={saving} type="submit" className="w-full px-4 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "#1A3A2A" }}>
                {saving ? "Saving…" : "Create plan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
      />
    </div>
  );
}
