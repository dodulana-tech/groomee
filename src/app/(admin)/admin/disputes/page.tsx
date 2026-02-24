"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn, formatNaira } from "@/lib/utils";
import Link from "next/link";

interface Dispute {
  id: string;
  status: string;
  outcome: string | null;
  reason: string;
  description: string;
  refundAmount: number | null;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    reference: string;
    totalAmount: number;
    customer: { name: string | null; phone: string };
    groomer: { name: string } | null;
    service: { name: string };
    payment: { status: string; paystackRef: string } | null;
  };
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolving, setResolving] = useState(false);
  const [form, setForm] = useState({
    outcome: "NO_REFUND",
    refundAmount: "",
    adminNote: "",
    applyStrikeToGroomer: false,
  });

  useEffect(() => {
    fetch("/api/admin/disputes")
      .then((r) => r.json())
      .then((d) => setDisputes(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function resolve(disputeId: string) {
    if (!form.adminNote.trim()) {
      alert("Admin note required.");
      return;
    }
    setResolving(true);
    try {
      const res = await fetch(`/api/admin/disputes/${disputeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome: form.outcome,
          refundAmount: form.refundAmount
            ? parseFloat(form.refundAmount)
            : undefined,
          adminNote: form.adminNote,
          applyStrikeToGroomer: form.applyStrikeToGroomer,
        }),
      });
      if (res.ok) {
        setDisputes((d) =>
          d.map((dp) =>
            dp.id === disputeId ? { ...dp, status: "RESOLVED" } : dp,
          ),
        );
        setSelected(null);
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to resolve");
      }
    } finally {
      setResolving(false);
    }
  }

  const open = disputes.filter(
    (d) => d.status === "OPEN" || d.status === "UNDER_REVIEW",
  );
  const resolved = disputes.filter(
    (d) => d.status === "RESOLVED" || d.status === "CLOSED",
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Disputes</h1>
        <p className="mt-1 text-sm text-gray-500">
          {open.length} open · {resolved.length} resolved
        </p>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {open.length === 0 && (
            <div className="card py-12 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-semibold text-gray-700">No open disputes</p>
            </div>
          )}

          {[...open, ...resolved].map((dispute) => (
            <div
              key={dispute.id}
              className={cn(
                "card p-5",
                dispute.status === "RESOLVED" && "opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "status-pill",
                        dispute.status === "OPEN"
                          ? "bg-red-100 text-red-600"
                          : dispute.status === "UNDER_REVIEW"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-500",
                      )}
                    >
                      {dispute.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {format(
                        new Date(dispute.createdAt),
                        "dd MMM yyyy, HH:mm",
                      )}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {dispute.booking.service.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Customer:{" "}
                    {dispute.booking.customer.name ??
                      dispute.booking.customer.phone}
                    {dispute.booking.groomer &&
                      ` · Groomer: ${dispute.booking.groomer.name}`}
                  </p>
                  <p className="mt-2 text-sm text-gray-700">
                    <strong>Reason:</strong> {dispute.reason}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {dispute.description}
                  </p>
                  {dispute.adminNote && (
                    <p className="mt-2 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      <strong>Admin note:</strong> {dispute.adminNote}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold">
                    {formatNaira(dispute.booking.totalAmount)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    <Link
                      href={`/admin/bookings/${dispute.booking.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {dispute.booking.reference}
                    </Link>
                  </p>
                  {dispute.status !== "RESOLVED" && (
                    <button
                      onClick={() => {
                        setSelected(dispute);
                        setForm({
                          outcome: "NO_REFUND",
                          refundAmount: "",
                          adminNote: "",
                          applyStrikeToGroomer: false,
                        });
                      }}
                      className="mt-3 btn-primary btn-sm"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-bold text-gray-900 mb-1">Resolve dispute</h3>
            <p className="text-sm text-gray-500 mb-5">
              {selected.booking.reference} ·{" "}
              {formatNaira(selected.booking.totalAmount)}
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Outcome
                </label>
                <select
                  value={form.outcome}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, outcome: e.target.value }))
                  }
                  className="input"
                >
                  <option value="NO_REFUND">No refund</option>
                  <option value="PARTIAL_REFUND">Partial refund</option>
                  <option value="FULL_REFUND">
                    Full refund ({formatNaira(selected.booking.totalAmount)})
                  </option>
                  <option value="CREDIT_ISSUED">Issue credit</option>
                </select>
              </div>

              {form.outcome === "PARTIAL_REFUND" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Refund amount (₦)
                  </label>
                  <input
                    type="number"
                    value={form.refundAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, refundAmount: e.target.value }))
                    }
                    max={selected.booking.totalAmount}
                    className="input"
                    placeholder="e.g. 5000"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Admin note (required)
                </label>
                <textarea
                  value={form.adminNote}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, adminNote: e.target.value }))
                  }
                  className="input resize-none"
                  rows={3}
                  placeholder="Explain the resolution decision…"
                  required
                />
              </div>

              {selected.booking.groomer && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.applyStrikeToGroomer}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        applyStrikeToGroomer: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 text-brand-600"
                  />
                  Issue strike to groomer ({selected.booking.groomer.name})
                </label>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => resolve(selected.id)}
                disabled={resolving}
                className="btn-primary btn-md flex-1"
              >
                {resolving ? "Resolving…" : "Confirm resolution"}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="btn-secondary btn-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
