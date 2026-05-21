"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface Claim {
  id: string;
  kind: string;
  status: string;
  summary: string;
  externalRef: string | null;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  pro: { id: string; name: string; phone: string };
  enrollment: {
    id: string;
    plan: { id: string; name: string; provider: string };
  };
}

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"];

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function load() {
    return fetch(`/api/admin/benefits/claims/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const c: Claim = d.data;
        setClaim(c);
        setStatus(c.status);
        setNotes(c.notes ?? "");
        setExternalRef(c.externalRef ?? "");
      });
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, [id]);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/benefits/claims/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes, externalRef }),
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

  if (loading || !claim) {
    return <div className="p-6"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200" style={{ borderTopColor: "#1A3A2A" }} /></div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <Link href="/admin/benefits/claims" className="text-xs text-gray-400 hover:text-gray-700">← Claims</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{claim.kind} claim · {claim.pro.name}</h1>
        <p className="text-sm text-gray-500">{claim.enrollment.plan.name} · {claim.enrollment.plan.provider}</p>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Summary</p>
          <p className="text-gray-800 mt-1">{claim.summary}</p>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">External ref #</label>
          <input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
          <p className="text-xs text-amber-700 mt-1">
            Do not paste medical detail. Diagnoses, prescriptions, and case notes are handled directly with the insurer.
          </p>
        </div>
        {message && <p className="text-sm text-gray-700">{message}</p>}
        <button disabled={saving} onClick={save} className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#1A3A2A" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Created {new Date(claim.createdAt).toLocaleString()} ·{" "}
        {claim.resolvedAt ? `Resolved ${new Date(claim.resolvedAt).toLocaleString()}` : "Unresolved"}
      </div>
    </div>
  );
}
