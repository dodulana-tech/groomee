"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

interface Enrolment {
  id: string;
  status: string;
  enrolledAt: string;
  activatedAt: string | null;
  nextDebitAt: string;
  lastDebitAt: string | null;
  graceUntil: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  externalPolicyNo: string | null;
  notes: string | null;
  pro: { id: string; name: string; phone: string; totalJobs: number; avgRating: number };
  plan: { id: string; name: string; monthlyPremium: number; provider: string };
  debits: Array<{
    id: string;
    period: string;
    premiumGross: number;
    subsidyAmount: number;
    amountDebited: number;
    status: string;
    failureReason: string | null;
    createdAt: string;
  }>;
  claims: Array<{
    id: string;
    kind: string;
    status: string;
    summary: string;
    externalRef: string | null;
    createdAt: string;
  }>;
  activity: Array<{
    id: string;
    action: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export default function EnrolmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [enr, setEnr] = useState<Enrolment | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState("");
  const [policyNo, setPolicyNo] = useState("");

  function load() {
    return fetch(`/api/admin/benefits/enrollments/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setEnr(d.data);
        setPolicyNo(d.data?.externalPolicyNo ?? "");
      });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  async function action(path: string, body?: Record<string, unknown>) {
    setActing(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/benefits/enrollments/${id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessage(`${path}: ok`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setActing(false);
    }
  }

  if (loading || !enr) {
    return <div className="p-6"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200" style={{ borderTopColor: "#1A3A2A" }} /></div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <Link href="/admin/benefits/enrollments" className="text-xs text-gray-400 hover:text-gray-700">← Enrolments</Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{enr.pro.name}</h1>
            <p className="text-sm text-gray-500">{enr.pro.phone} · {enr.plan.name} · {enr.plan.provider}</p>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-bold bg-gray-100 text-gray-700">{enr.status}</span>
        </div>
      </div>

      {message && <p className="text-sm text-gray-700">{message}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Premium" value={`${formatNaira(enr.plan.monthlyPremium)}/mo`} />
        <Stat label="Next debit" value={new Date(enr.nextDebitAt).toLocaleDateString()} />
        <Stat label="Last debit" value={enr.lastDebitAt ? new Date(enr.lastDebitAt).toLocaleDateString() : "—"} />
        <Stat label="Grace until" value={enr.graceUntil ? new Date(enr.graceUntil).toLocaleDateString() : "—"} />
        <Stat label="Paused at" value={enr.pausedAt ? new Date(enr.pausedAt).toLocaleDateString() : "—"} />
        <Stat label="Cancelled at" value={enr.cancelledAt ? new Date(enr.cancelledAt).toLocaleDateString() : "—"} />
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-bold text-gray-900 mb-4">Admin actions</h2>
        <div className="flex flex-wrap gap-2">
          <button disabled={acting} onClick={() => action("debit-now")} className="px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#1A3A2A" }}>Run debit now</button>
          {enr.status !== "PAUSED" && enr.status !== "CANCELLED" && (
            <button disabled={acting} onClick={() => action("pause", { reason: prompt("Reason for pause?") ?? "Paused by admin" })} className="px-3 py-2 rounded-xl text-sm font-bold border border-gray-200">Pause</button>
          )}
          {(enr.status === "PAUSED" || enr.status === "CANCELLED") && (
            <button disabled={acting} onClick={() => action("resume")} className="px-3 py-2 rounded-xl text-sm font-bold border border-gray-200">Resume</button>
          )}
          {enr.status !== "CANCELLED" && (
            <button disabled={acting} onClick={() => { const r = prompt("Cancellation reason?"); if (r) action("cancel", { reason: r }); }} className="px-3 py-2 rounded-xl text-sm font-bold text-red-700 border border-red-200">Cancel</button>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} placeholder="External policy #" className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm" />
          <button disabled={acting} onClick={() => action("attach-policy", { externalPolicyNo: policyNo })} className="px-3 py-2 rounded-xl text-sm font-bold border border-gray-200">Attach policy</button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-bold text-gray-900 mb-4">Debit history</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="py-2">Period</th>
              <th className="py-2">Gross</th>
              <th className="py-2">Subsidy</th>
              <th className="py-2">Debited</th>
              <th className="py-2">Status</th>
              <th className="py-2">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {enr.debits.map((d) => (
              <tr key={d.id}>
                <td className="py-2 text-gray-700 font-mono">{d.period}</td>
                <td className="py-2 text-gray-600">{formatNaira(d.premiumGross)}</td>
                <td className="py-2 text-gray-600">{formatNaira(d.subsidyAmount)}</td>
                <td className="py-2 font-bold text-gray-800">{formatNaira(d.amountDebited)}</td>
                <td className="py-2 text-xs"><span className={`rounded px-2 py-0.5 ${d.status === "SUCCESS" ? "bg-green-100 text-green-800" : d.status === "INSUFFICIENT_FUNDS" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>{d.status}</span></td>
                <td className="py-2 text-xs text-gray-400">{new Date(d.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {enr.debits.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-sm text-gray-400">No debits yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-bold text-gray-900 mb-4">Claims</h2>
        {enr.claims.length === 0 ? (
          <p className="text-sm text-gray-400">No claims logged.</p>
        ) : (
          <ul className="space-y-2">
            {enr.claims.map((c) => (
              <li key={c.id} className="text-sm">
                <Link href={`/admin/benefits/claims/${c.id}`} className="text-gray-700 hover:text-gray-900">
                  {c.kind} · {c.status} · {c.summary} {c.externalRef ? `· ${c.externalRef}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-bold text-gray-900 mb-4">Timeline</h2>
        <ul className="space-y-2 text-sm">
          {enr.activity.map((a) => (
            <li key={a.id} className="flex items-start gap-3 text-gray-600">
              <span className="text-xs text-gray-400 w-32 shrink-0">{new Date(a.createdAt).toLocaleString()}</span>
              <span className="font-mono">{a.action}</span>
            </li>
          ))}
          {enr.activity.length === 0 && (
            <li className="text-gray-400">No activity recorded.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-2 text-lg font-bold text-gray-800">{value}</p>
    </div>
  );
}
