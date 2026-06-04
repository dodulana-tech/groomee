"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const KINDS = [
  { value: "HMO", label: "HMO — hospital visit, GP, etc." },
  { value: "ACCIDENT", label: "Accident — injury cover" },
];

export default function ClaimForm({
  enrollmentId,
  planKind,
}: {
  enrollmentId: string;
  planKind: "HMO" | "ACCIDENT" | "BUNDLE";
}) {
  const router = useRouter();
  const [kind, setKind] = useState<string>(
    planKind === "ACCIDENT" ? "ACCIDENT" : "HMO",
  );
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trimmed = summary.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < 10;
  const canSubmit = trimmed.length >= 10 && !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/partner/benefits/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, kind, summary: trimmed }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        setError(data.error ?? "Could not open claim.");
        return;
      }
      router.push("/partner/benefits?claim=opened");
      router.refresh();
    } catch {
      setError("Could not open claim. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="glass rounded-2xl border border-white/20 p-6 shadow-lg space-y-5"
    >
      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Kind of claim
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Summary
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value.slice(0, 240))}
          rows={4}
          minLength={10}
          maxLength={240}
          placeholder="What happened? Short summary, no medical detail. The insurer will follow up with you directly."
          className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
          required
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
          <span>{trimmed.length}/240 characters</span>
          {tooShort && (
            <span className="text-red-600 font-semibold">
              At least 10 characters
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-700 font-semibold">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/partner/benefits")}
          disabled={loading}
          className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-green-500 px-5 py-2.5 text-sm font-black text-white hover:bg-green-600 disabled:opacity-50 shadow-lg"
        >
          {loading ? "Opening..." : "Open claim"}
        </button>
      </div>
    </form>
  );
}
