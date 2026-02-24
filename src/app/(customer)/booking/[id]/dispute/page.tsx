"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const REASONS = [
  "Groomer did not show up",
  "Service was not as described",
  "Groomer was unprofessional",
  "Work quality was unacceptable",
  "Incorrect amount charged",
  "Other",
];

export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setError("Please select a reason.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setDone(true);
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center pb-24">
        <p className="text-5xl mb-4">📨</p>
        <h2 className="font-display text-2xl font-bold mb-2">
          Dispute submitted
        </h2>
        <p className="text-gray-500 mb-6 max-w-sm">
          Our team will review your case and respond within 4 hours. Any refund
          will be processed within 24–48 hours.
        </p>
        <button
          onClick={() => router.push("/bookings")}
          className="btn-primary btn-md"
        >
          Back to bookings
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-24">
      <h1 className="mb-1 font-display text-2xl font-bold">Raise a dispute</h1>
      <p className="mb-6 text-sm text-gray-500">
        Our team will review within 4 hours.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            What went wrong?
          </label>
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors hover:border-brand-300"
                style={{ borderColor: reason === r ? "var(--brand)" : "" }}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="border-gray-300 text-brand-600"
                />
                <span className="text-sm font-medium">{r}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Describe the issue
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input resize-none"
            rows={4}
            placeholder="Please provide as much detail as possible…"
            required
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary btn-lg w-full"
        >
          {submitting ? "Submitting…" : "Submit dispute"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-ghost btn-md w-full"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
