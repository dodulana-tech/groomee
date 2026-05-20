"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InviteApprenticePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [apprenticeName, setApprenticeName] = useState("");
  const [commissionPct, setCommissionPct] = useState(30);
  const [expectedFreedom, setExpectedFreedom] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const body: Record<string, unknown> = {
      phone: phone.trim(),
      commission: commissionPct / 100,
    };
    if (apprenticeName.trim()) body.apprenticeName = apprenticeName.trim();
    if (notes.trim()) body.notes = notes.trim();
    if (expectedFreedom) {
      const d = new Date(expectedFreedom);
      if (!isNaN(d.getTime())) body.expectedFreedom = d.toISOString();
    }

    try {
      const res = await fetch("/api/partner/apprentices/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to send invitation.");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/partner/team/invitations"), 1200);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="p-6 lg:p-8">
        <div className="glass rounded-2xl border border-white/20 p-10 text-center max-w-xl mx-auto">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation sent!</h1>
          <p className="text-sm text-gray-500">
            We&apos;ve sent your apprentice a WhatsApp message and email with the accept link.
            You&apos;ll be notified the moment they accept.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/partner/team"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to team
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Invite an apprentice</h1>
        <p className="text-sm text-gray-500">
          They&apos;ll receive a WhatsApp message and email with a link to review and accept.
        </p>
      </div>

      <form onSubmit={onSubmit} className="glass rounded-2xl border border-white/20 p-6 shadow-lg space-y-5">
        <div>
          <label className="input-label mb-1">Apprentice phone number</label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0801 234 5678"
            className="input"
            autoComplete="off"
          />
          <p className="text-xs text-gray-400 mt-1">
            Nigerian mobile number — they&apos;ll get the invite via WhatsApp.
          </p>
        </div>

        <div>
          <label className="input-label mb-1">
            Display name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={apprenticeName}
            onChange={(e) => setApprenticeName(e.target.value)}
            placeholder="What should we call them?"
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            They can change this themselves once they accept.
          </p>
        </div>

        <div>
          <div className="flex items-end justify-between mb-1">
            <label className="input-label">Your commission</label>
            <span className="text-xl font-black text-brand-700">
              {commissionPct}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={50}
            step={1}
            value={commissionPct}
            onChange={(e) => setCommissionPct(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>10% (gentle)</span>
            <span>30% (default)</span>
            <span>50% (intensive)</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            What you&apos;ll earn from each booking your apprentice fulfills, after Groomee&apos;s platform fee. You can renegotiate anytime.
          </p>
        </div>

        <div>
          <label className="input-label mb-1">
            Expected Freedom date <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={expectedFreedom}
            onChange={(e) => setExpectedFreedom(e.target.value)}
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            A target graduation date helps both of you plan.
          </p>
        </div>

        <div>
          <label className="input-label mb-1">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input min-h-[80px] resize-none"
            placeholder="Anything specific you want to mention to them?"
            maxLength={500}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/partner/team" className="btn-secondary btn-md">
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className="btn-primary btn-md">
            {submitting ? "Sending invitation…" : "Send invitation"}
          </button>
        </div>
      </form>
    </div>
  );
}
