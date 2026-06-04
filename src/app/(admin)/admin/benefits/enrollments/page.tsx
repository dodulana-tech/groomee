"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Enrolment {
  id: string;
  status: string;
  nextDebitAt: string;
  lastDebitAt: string | null;
  externalPolicyNo: string | null;
  graceUntil: string | null;
  pro: { id: string; name: string; phone: string };
  plan: { id: string; name: string; monthlyPremium: number };
}

interface Plan {
  id: string;
  name: string;
}

const STATUSES = ["", "PENDING", "ACTIVE", "GRACE", "PAUSED", "CANCELLED"];

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: "#FEF3C7", fg: "#92400E" },
  ACTIVE: { bg: "#DCFCE7", fg: "#166534" },
  GRACE: { bg: "#FEF3C7", fg: "#92400E" },
  PAUSED: { bg: "#FEE2E2", fg: "#991B1B" },
  CANCELLED: { bg: "#F3F4F6", fg: "#6B7280" },
};

export default function EnrolmentsPage() {
  const [rows, setRows] = useState<Enrolment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState("");
  const [planId, setPlanId] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (planId) params.set("planId", planId);
    if (q) params.set("q", q);
    setLoading(true);
    return fetch(`/api/admin/benefits/enrollments?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/admin/benefits/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.data ?? []));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, planId]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrolments</h1>
          <p className="mt-1 text-sm text-gray-500">{rows.length} shown</p>
        </div>
        <Link
          href="/admin/benefits/enrollments/new"
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "#1A3A2A" }}
        >
          + Enrol a pro
        </Link>
      </div>

      <div className="glass-card rounded-2xl p-4 mb-4 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
        </select>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
        >
          <option value="">All plans</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex-1 flex gap-2 min-w-[240px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pro name or phone"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm"
          />
          <button type="submit" className="px-3 py-2 rounded-xl text-sm font-bold border border-gray-200">Search</button>
        </form>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {["Pro", "Plan", "Status", "Next debit", "Last debit", "Policy #", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center"><div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-gray-200" style={{ borderTopColor: "#1A3A2A" }} /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400">No enrolments match.</td></tr>
            ) : rows.map((r) => {
              const c = STATUS_COLORS[r.status] ?? STATUS_COLORS.PENDING;
              return (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.pro.name}</p>
                    <p className="text-xs text-gray-400">{r.pro.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.plan.name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-1 text-xs font-bold" style={{ background: c.bg, color: c.fg }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.nextDebitAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.lastDebitAt ? new Date(r.lastDebitAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{r.externalPolicyNo ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/benefits/enrollments/${r.id}`} className="text-xs font-semibold text-gray-500 hover:text-gray-800">View →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
