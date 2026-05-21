"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

interface Plan { id: string; name: string; monthlyPremium: number; isActive: boolean }
interface Pro { id: string; name: string; phone: string; totalJobs: number; avgRating: number }

interface Eligibility {
  eligible: boolean;
  reasons: string[];
  details: {
    proTier: string;
    completedBookings30d: number;
    daysSinceFirstBooking: number | null;
    walletAvailable: number;
    requiredPremium: number;
    minBookings: number;
    minTenureDays: number;
  };
}

export default function NewEnrolmentPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pros, setPros] = useState<Pro[]>([]);
  const [planId, setPlanId] = useState("");
  const [proId, setProId] = useState("");
  const [externalPolicyNo, setExternalPolicyNo] = useState("");
  const [notes, setNotes] = useState("");
  const [debitNow, setDebitNow] = useState(true);
  const [skipEligibility, setSkipEligibility] = useState(false);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/benefits/plans").then((r) => r.json()).then((d) => {
      const active = (d.data ?? []).filter((p: Plan) => p.isActive);
      setPlans(active);
      if (active[0]) setPlanId(active[0].id);
    });
    fetch("/api/admin/pros/list").then((r) => r.json()).then((d) => setPros(d.data ?? []));
  }, []);

  useEffect(() => {
    if (!proId || !planId) { setEligibility(null); return; }
    fetch(`/api/admin/benefits/eligibility/${proId}?planId=${planId}`)
      .then((r) => r.json())
      .then((d) => setEligibility(d.data));
  }, [proId, planId]);

  const filteredPros = search
    ? pros.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search))
    : pros.slice(0, 50);

  async function submit() {
    if (!proId || !planId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/benefits/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proId,
          planId,
          externalPolicyNo: externalPolicyNo.trim() || null,
          notes: notes.trim() || null,
          debitNow,
          skipEligibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const reasons = Array.isArray(data.reasons) && data.reasons.length ? `\n${data.reasons.join("\n")}` : "";
        throw new Error(`${data.error ?? "Failed"}${reasons}`);
      }
      router.push(`/admin/benefits/enrollments/${data.data.enrollment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <Link href="/admin/benefits/enrollments" className="text-xs text-gray-400 hover:text-gray-700">← Enrolments</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-1">Enrol a pro</h1>
      <p className="text-sm text-gray-500 mb-6">Cover starts on first successful debit. Underwritten by Reliance HMO + Leadway. Groomee is not an insurer.</p>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Plan *</label>
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm">
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatNaira(p.monthlyPremium)}/mo</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Search pro</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Pro *</label>
          <select value={proId} onChange={(e) => setProId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm">
            <option value="">Select pro…</option>
            {filteredPros.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {p.phone} · {p.totalJobs} jobs · {p.avgRating.toFixed(1)}★</option>
            ))}
          </select>
        </div>

        {eligibility && (
          <div className={`rounded-xl p-4 text-sm ${eligibility.eligible ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
            <p className="font-bold mb-2">
              {eligibility.eligible ? "✓ Eligible" : "✗ Not eligible"}
              <span className="ml-3 text-xs opacity-70">Tier: {eligibility.details.proTier}</span>
            </p>
            <ul className="text-xs space-y-1">
              <li>Completed bookings (30d): {eligibility.details.completedBookings30d} / {eligibility.details.minBookings}</li>
              <li>Tenure: {eligibility.details.daysSinceFirstBooking ?? "—"} days / {eligibility.details.minTenureDays} required</li>
              <li>Wallet available: {formatNaira(eligibility.details.walletAvailable)} (need {formatNaira(eligibility.details.requiredPremium)})</li>
            </ul>
            {eligibility.reasons.length > 0 && (
              <ul className="text-xs mt-2 list-disc list-inside">
                {eligibility.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">External policy # (optional)</label>
          <input value={externalPolicyNo} onChange={(e) => setExternalPolicyNo(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={debitNow} onChange={(e) => setDebitNow(e.target.checked)} />
          Run first debit immediately
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={skipEligibility} onChange={(e) => setSkipEligibility(e.target.checked)} />
          Override eligibility gates (admin)
        </label>

        {error && <pre className="text-xs text-red-700 whitespace-pre-wrap">{error}</pre>}
        <button
          disabled={saving || !proId || !planId}
          onClick={submit}
          className="w-full px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
          style={{ background: "#1A3A2A" }}
        >
          {saving ? "Enrolling…" : "Enrol pro"}
        </button>
      </div>
    </div>
  );
}
