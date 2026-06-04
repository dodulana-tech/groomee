"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Claim {
  id: string;
  kind: string;
  status: string;
  summary: string;
  externalRef: string | null;
  createdAt: string;
  pro: { id: string; name: string; phone: string };
  enrollment: { id: string; plan: { id: string; name: string } };
}

interface Enrolment {
  id: string;
  status: string;
  pro: { name: string; phone: string };
  plan: { name: string };
}

const STATUSES = ["", "OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"];
const KINDS = ["BUNDLE", "HMO", "ACCIDENT"];

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [form, setForm] = useState({ enrollmentId: "", kind: "BUNDLE", summary: "", externalRef: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    const params = status ? `?status=${status}` : "";
    setLoading(true);
    return fetch(`/api/admin/benefits/claims${params}`)
      .then((r) => r.json())
      .then((d) => setClaims(d.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status]);

  async function openCreate() {
    setShowModal(true);
    const res = await fetch("/api/admin/benefits/enrollments?status=ACTIVE");
    const d = await res.json();
    setEnrolments(d.data ?? []);
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/benefits/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: form.enrollmentId,
          kind: form.kind,
          summary: form.summary.trim(),
          externalRef: form.externalRef.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setShowModal(false);
      setForm({ enrollmentId: "", kind: "BUNDLE", summary: "", externalRef: "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Claims</h1>
          <p className="text-sm text-gray-500">Handoff records. Actual processing happens at the HMO / insurer.</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#1A3A2A" }}>
          + Log claim
        </button>
      </div>

      <div className="flex gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-gray-200 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
        </select>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {["Pro", "Plan", "Kind", "Status", "Summary", "Ref", "Created", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={8} className="py-12 text-center"><div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-gray-200" style={{ borderTopColor: "#1A3A2A" }} /></td></tr>
            ) : claims.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-400">No claims.</td></tr>
            ) : claims.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3"><p className="font-medium text-gray-900">{c.pro.name}</p><p className="text-xs text-gray-400">{c.pro.phone}</p></td>
                <td className="px-4 py-3 text-gray-600">{c.enrollment.plan.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.kind}</td>
                <td className="px-4 py-3 text-xs"><span className="rounded px-2 py-0.5 bg-gray-100 text-gray-700">{c.status}</span></td>
                <td className="px-4 py-3 text-gray-700">{c.summary}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.externalRef ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3"><Link href={`/admin/benefits/claims/${c.id}`} className="text-xs font-semibold text-gray-500 hover:text-gray-800">View →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">Log claim</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Enrolment *</label>
                <select value={form.enrollmentId} onChange={(e) => setForm((f) => ({ ...f, enrollmentId: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm">
                  <option value="">Select…</option>
                  {enrolments.map((e) => (
                    <option key={e.id} value={e.id}>{e.pro.name} · {e.plan.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Kind</label>
                <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm">
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Summary *</label>
                <input value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="e.g. Hospital visit" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
                <p className="text-xs text-amber-700 mt-1">
                  Do not paste medical detail. Diagnoses, prescriptions, and case notes are handled directly with the insurer. Keep this to a high-level handoff label only.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">External ref #</label>
                <input value={form.externalRef} onChange={(e) => setForm((f) => ({ ...f, externalRef: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={saving || !form.enrollmentId || !form.summary.trim()} onClick={submit} className="w-full px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: "#1A3A2A" }}>
                {saving ? "Saving…" : "Log claim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
