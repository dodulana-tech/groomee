"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type BookingStatus =
  | "PENDING_PAYMENT"
  | "DISPATCHING"
  | "NO_GROOMER"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CONFIRMED"
  | "CANCELLED"
  | "DISPUTED";

const STATUS_OPTIONS: BookingStatus[] = [
  "PENDING_PAYMENT",
  "DISPATCHING",
  "NO_GROOMER",
  "ACCEPTED",
  "EN_ROUTE",
  "ARRIVED",
  "IN_SERVICE",
  "COMPLETED",
  "CONFIRMED",
  "CANCELLED",
  "DISPUTED",
];

interface NoteRow {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string | null; phone: string | null; email: string | null };
}

export default function BookingActions({
  bookingId,
  currentStatus,
  bookingTotal,
  refundedSoFar,
  hasPaystackPayment,
}: {
  bookingId: string;
  currentStatus: BookingStatus;
  bookingTotal: number;
  refundedSoFar: number;
  hasPaystackPayment: boolean;
}) {
  const router = useRouter();
  const [openSheet, setOpenSheet] = useState<null | "status" | "refund" | "complete">(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Status change form
  const [newStatus, setNewStatus] = useState<BookingStatus>(currentStatus);
  const [statusReason, setStatusReason] = useState("");

  // Refund form
  const refundCap = Math.max(0, bookingTotal - refundedSoFar);
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState("");

  // Force-complete form
  const [completeReason, setCompleteReason] = useState("");

  // Notes
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [notesLoading, setNotesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/notes?entityType=booking&entityId=${bookingId}`,
        );
        const data = await res.json();
        if (!cancelled && data.success) {
          setNotes(data.data);
        }
      } finally {
        if (!cancelled) setNotesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  async function submitStatusChange() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reason: statusReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update status");
        return;
      }
      setOpenSheet(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function submitForceComplete() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceComplete: true, reason: completeReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to complete booking");
        return;
      }
      setOpenSheet(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRefund() {
    setSubmitting(true);
    setError(null);
    try {
      const amt = Number(refundAmount);
      const res = await fetch(`/api/admin/bookings/${bookingId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, reason: refundReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to refund");
        return;
      }
      setOpenSheet(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteDraft.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "booking",
          entityId: bookingId,
          content: noteDraft,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotes((prev) => [data.data, ...prev]);
        setNoteDraft("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isTerminal = ["CONFIRMED", "CANCELLED"].includes(currentStatus);

  return (
    <>
      {/* Action bar */}
      <div className="glass-card rounded-2xl mt-4 p-5">
        <h2 className="font-bold text-gray-900 mb-3">Admin actions</h2>
        <div className="flex flex-wrap gap-2">
          {!isTerminal && (
            <button
              onClick={() => {
                setNewStatus(currentStatus);
                setStatusReason("");
                setError(null);
                setOpenSheet("status");
              }}
              className="text-sm font-semibold text-gray-700 bg-gray-100 px-4 py-2 rounded-xl hover:bg-gray-200"
            >
              Change status
            </button>
          )}
          {!isTerminal && currentStatus !== "PENDING_PAYMENT" && (
            <button
              onClick={() => {
                setCompleteReason("");
                setError(null);
                setOpenSheet("complete");
              }}
              className="text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700"
            >
              Force complete
            </button>
          )}
          {hasPaystackPayment && refundCap > 0 && (
            <button
              onClick={() => {
                setRefundAmount(String(refundCap));
                setRefundReason("");
                setError(null);
                setOpenSheet("refund");
              }}
              className="text-sm font-semibold text-red-600 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100"
            >
              Refund customer
            </button>
          )}
        </div>
      </div>

      {/* Notes log */}
      <div className="glass-card rounded-2xl mt-4 p-5">
        <h2 className="font-bold text-gray-900 mb-3">Admin notes</h2>
        <form onSubmit={submitNote} className="mb-4 flex gap-2">
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Add a note (visible to other admins)…"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={submitting || !noteDraft.trim()}
            className="text-sm font-semibold text-white bg-brand-600 px-4 py-2 rounded-xl hover:bg-brand-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {notesLoading ? (
          <p className="text-sm text-gray-400">Loading notes…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-gray-400">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="border-b border-gray-50 pb-2 last:border-0">
                <p className="text-sm text-gray-700">{n.content}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {n.author?.name ?? n.author?.phone ?? "Admin"} ·{" "}
                  {new Date(n.createdAt).toLocaleString("en-NG", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Status change modal */}
      {openSheet === "status" && (
        <Modal title="Change status" onClose={() => setOpenSheet(null)} error={error}>
          <label className="block text-xs font-semibold text-gray-500 mb-1">New status</label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as BookingStatus)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Reason (audited)</label>
          <textarea
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            placeholder="Why is this needed?"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setOpenSheet(null)}
              className="text-sm font-semibold text-gray-600 bg-gray-100 px-4 py-2 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={submitStatusChange}
              disabled={submitting || newStatus === currentStatus || statusReason.trim().length < 5}
              className="text-sm font-semibold text-white bg-brand-600 px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Update status"}
            </button>
          </div>
        </Modal>
      )}

      {/* Force complete modal */}
      {openSheet === "complete" && (
        <Modal title="Force complete booking" onClose={() => setOpenSheet(null)} error={error}>
          <p className="text-sm text-gray-600 mb-3">
            This will mark the booking as CONFIRMED, releasing payment to the pro and freeing them
            for new jobs. Used when normal completion is stuck.
          </p>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Reason (audited)</label>
          <textarea
            value={completeReason}
            onChange={(e) => setCompleteReason(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3"
            placeholder="e.g. Customer confirmed by phone, system stuck."
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setOpenSheet(null)}
              className="text-sm font-semibold text-gray-600 bg-gray-100 px-4 py-2 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={submitForceComplete}
              disabled={submitting || completeReason.trim().length < 5}
              className="text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {submitting ? "Completing…" : "Force complete"}
            </button>
          </div>
        </Modal>
      )}

      {/* Refund modal */}
      {openSheet === "refund" && (
        <Modal title="Refund customer" onClose={() => setOpenSheet(null)} error={error}>
          <p className="text-sm text-gray-600 mb-3">
            Up to ₦{refundCap.toLocaleString()} can be refunded against this Paystack transaction.
            {refundedSoFar > 0 && ` Already refunded ₦${refundedSoFar.toLocaleString()}.`}
          </p>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Amount (₦)</label>
          <input
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            min={1}
            max={refundCap}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3"
          />
          <label className="block text-xs font-semibold text-gray-500 mb-1">Reason (audited)</label>
          <textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3"
            placeholder="Why is this refund being issued?"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setOpenSheet(null)}
              className="text-sm font-semibold text-gray-600 bg-gray-100 px-4 py-2 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={submitRefund}
              disabled={
                submitting ||
                !refundAmount ||
                Number(refundAmount) <= 0 ||
                Number(refundAmount) > refundCap ||
                refundReason.trim().length < 5
              }
              className="text-sm font-semibold text-white bg-red-600 px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {submitting ? "Refunding…" : "Issue refund"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({
  title,
  onClose,
  error,
  children,
}: {
  title: string;
  onClose: () => void;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-gray-900 mb-3">{title}</h3>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>
        )}
        {children}
      </div>
    </div>
  );
}
