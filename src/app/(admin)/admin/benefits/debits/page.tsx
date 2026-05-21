"use client";

import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/utils";
import Link from "next/link";

interface PeriodSummary {
  period: string;
  attempted: number;
  succeeded: number;
  insufficient: number;
  failed: number;
  skipped: number;
  grossDebited: number;
}

interface DebitRow {
  id: string;
  period: string;
  amountDebited: number;
  premiumGross: number;
  subsidyAmount: number;
  status: string;
  failureReason: string | null;
  createdAt: string;
  enrollment: {
    id: string;
    pro: { id: string; name: string; phone: string };
    plan: { id: string; name: string };
  };
}

export default function DebitsPage() {
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [rows, setRows] = useState<DebitRow[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load(period?: string) {
    setLoading(true);
    const url = period ? `/api/admin/benefits/debits?period=${period}` : "/api/admin/benefits/debits";
    return fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setPeriods(d.data?.periods ?? []);
        setRows(d.data?.rows ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Debit log</h1>
        <p className="text-sm text-gray-500">Monthly premium runs · idempotent per enrolment × period.</p>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {["Period", "Attempted", "Succeeded", "Insufficient", "Failed", "Skipped", "Gross debited", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {periods.map((p) => (
              <tr key={p.period} className={selectedPeriod === p.period ? "bg-emerald-50/40" : ""}>
                <td className="px-4 py-3 font-mono font-bold text-gray-800">{p.period}</td>
                <td className="px-4 py-3 text-gray-700">{p.attempted}</td>
                <td className="px-4 py-3 text-green-700">{p.succeeded}</td>
                <td className="px-4 py-3 text-amber-700">{p.insufficient}</td>
                <td className="px-4 py-3 text-red-700">{p.failed}</td>
                <td className="px-4 py-3 text-gray-500">{p.skipped}</td>
                <td className="px-4 py-3 font-bold text-gray-800">{formatNaira(p.grossDebited)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => { setSelectedPeriod(p.period); load(p.period); }} className="text-xs font-semibold text-gray-500 hover:text-gray-800">
                    {selectedPeriod === p.period ? "Hide rows" : "Show rows →"}
                  </button>
                </td>
              </tr>
            ))}
            {periods.length === 0 && !loading && (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-400">No debit runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedPeriod && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Rows for {selectedPeriod}</h2>
            <button onClick={() => { setSelectedPeriod(null); load(); }} className="text-xs text-gray-500 hover:text-gray-800">Clear filter</button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {["Pro", "Plan", "Amount", "Status", "When"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/benefits/enrollments/${r.enrollment.id}`} className="font-medium text-gray-900 hover:underline">{r.enrollment.pro.name}</Link>
                    <p className="text-xs text-gray-400">{r.enrollment.pro.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.enrollment.plan.name}</td>
                  <td className="px-4 py-3 font-bold text-gray-800">{formatNaira(r.amountDebited)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`rounded px-2 py-0.5 ${r.status === "SUCCESS" ? "bg-green-100 text-green-800" : r.status === "INSUFFICIENT_FUNDS" ? "bg-amber-100 text-amber-800" : r.status === "SKIPPED" ? "bg-gray-100 text-gray-700" : "bg-red-100 text-red-800"}`}>{r.status}</span>
                    {r.failureReason && <p className="text-xs text-gray-500 mt-1">{r.failureReason}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
