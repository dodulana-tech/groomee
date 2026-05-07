"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  apprenticeshipId: string;
  apprenticeName: string;
  masterName: string;
}

/**
 * Master-only Freedom card — shown on the apprentice detail page when the
 * apprenticeship status is READY_FOR_FREEDOM. Confirming POSTs to
 * /api/partner/apprentices/[id]/freedom which generates the permanent cert,
 * flips the apprentice to INDEPENDENT, ends master commission, and fires
 * celebration notifications to both sides. Apprentice keeps a permanent
 * "Freed under [Master]" lineage badge.
 */
export default function FreedomCard({
  apprenticeshipId,
  apprenticeName,
  masterName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/partner/apprentices/${apprenticeshipId}/freedom`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note.trim() || undefined }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErr(data.error || `Request failed (${res.status})`);
        setBusy(false);
        return;
      }
      // Reload onto the freshly-FREED page so the master sees the new state.
      router.push(`/partner/team/${apprenticeshipId}?freedom=success`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div
        className="rounded-2xl border-2 shadow-lg overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #014342 0%, #026564 50%, #014342 100%)",
          borderColor: "#D4A853",
        }}
      >
        <div className="px-6 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.25em]"
                style={{ color: "#D4A853" }}
              >
                Freedom moment
              </p>
              <h2
                className="mt-1 text-xl sm:text-2xl font-black text-white leading-tight"
                style={{
                  fontFamily:
                    "var(--font-display), 'Playfair Display', Georgia, serif",
                }}
              >
                {apprenticeName} is ready for Freedom 🎉
              </h2>
              <p className="mt-2 text-sm text-white/80 max-w-prose leading-relaxed">
                Curriculum complete. Jobs and ratings cleared. When you confirm,
                a permanent Certificate of Freedom is issued in your name —
                "Freed under {masterName}". This is the moment that turns your
                apprentice into a fully independent pro.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setErr(null);
              }}
              className="shrink-0 rounded-xl px-5 py-3 text-sm font-bold transition-all"
              style={{
                background: "#53eb64",
                color: "#014342",
                boxShadow: "0 6px 20px rgba(83, 235, 100, 0.35)",
              }}
            >
              Confirm Freedom
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                🎓
              </span>
              <h3
                className="text-xl font-black text-gray-900"
                style={{
                  fontFamily:
                    "var(--font-display), 'Playfair Display', Georgia, serif",
                }}
              >
                Bestow Freedom on {apprenticeName.split(" ")[0]}?
              </h3>
            </div>
            <div className="mt-4 space-y-3 text-sm text-gray-700 leading-relaxed">
              <p>
                Confirming this generates a <strong>permanent certificate</strong>{" "}
                with a public, verifiable code. It cannot be undone.
              </p>
              <ul className="space-y-1.5 pl-5 list-disc text-gray-600">
                <li>
                  <strong>{apprenticeName}</strong> transitions to fully
                  INDEPENDENT.
                </li>
                <li>
                  Your master commission ends on every future booking they take.
                </li>
                <li>
                  Lineage stays forever — their cert reads "Freed under{" "}
                  {masterName}". You keep the bragging rights.
                </li>
                <li>
                  They get a public cert page they can share with customers,
                  family, and the world.
                </li>
              </ul>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Note for the cert (optional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                disabled={busy}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-white"
                placeholder="A few words for the records (private)"
              />
            </label>

            {err && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                {err}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50"
                style={{
                  background: "#014342",
                  color: "#53eb64",
                  boxShadow: "0 6px 20px rgba(1, 67, 66, 0.3)",
                }}
              >
                {busy ? "Bestowing Freedom…" : "🎓 Yes, bestow Freedom"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
