"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ModuleRow {
  id: string;
  title: string;
  description: string | null;
  required: boolean;
  gatesIndependence: boolean;
  sortOrder: number;
  completedAt: string | null;
  masterSignoffAt: string | null;
  notes: string | null;
  isSeeded: boolean;
}

interface Props {
  apprenticeshipId: string;
  status: string;
  masterApprovedIndependence: boolean;
  masterApprovedAt: string | null;
  gatingTotal: number;
  gatingComplete: number;
  requiredTotal: number;
  requiredComplete: number;
  modules: ModuleRow[];
}

export default function CurriculumActions({
  apprenticeshipId,
  status,
  masterApprovedIndependence,
  masterApprovedAt,
  gatingTotal,
  gatingComplete,
  requiredTotal,
  requiredComplete,
  modules,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Add-module form state
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [newGates, setNewGates] = useState(false);

  // Edit-module modal state
  const [editing, setEditing] = useState<ModuleRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRequired, setEditRequired] = useState(false);
  const [editGates, setEditGates] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  const closed = status === "FREED" || status === "TERMINATED";
  const canEdit = !closed && status !== "PENDING_ACCEPT";

  function openEdit(m: ModuleRow) {
    setEditing(m);
    setEditTitle(m.title);
    setEditDesc(m.description ?? "");
    setEditRequired(m.required);
    setEditGates(m.gatesIndependence);
    setEditNotes(m.notes ?? "");
    setErr(null);
  }

  async function postJSON(
    url: string,
    method: string,
    body?: unknown,
  ): Promise<{ ok: boolean; data: any }> {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErr(data.error || `Request failed (${res.status})`);
        return { ok: false, data };
      }
      return { ok: true, data };
    } catch (e) {
      setErr((e as Error).message);
      return { ok: false, data: null };
    }
  }

  async function toggleCompleted(m: ModuleRow) {
    if (!canEdit) return;
    setErr(null);
    setBusy(`complete-${m.id}`);
    const next = m.completedAt === null;
    const { ok } = await postJSON(
      `/api/partner/apprentices/${apprenticeshipId}/modules/${m.id}`,
      "PATCH",
      { completed: next },
    );
    setBusy(null);
    if (ok) router.refresh();
  }

  async function toggleSignoff(m: ModuleRow) {
    if (!canEdit) return;
    setErr(null);
    setBusy(`signoff-${m.id}`);
    const next = m.masterSignoffAt === null;
    const { ok } = await postJSON(
      `/api/partner/apprentices/${apprenticeshipId}/modules/${m.id}`,
      "PATCH",
      { signedOff: next },
    );
    setBusy(null);
    if (ok) router.refresh();
  }

  async function deleteModule(m: ModuleRow) {
    if (!canEdit) return;
    if (m.completedAt !== null) return;
    if (!confirm(`Delete module "${m.title}"? This cannot be undone.`)) return;
    setErr(null);
    setBusy(`delete-${m.id}`);
    const { ok } = await postJSON(
      `/api/partner/apprentices/${apprenticeshipId}/modules/${m.id}`,
      "DELETE",
    );
    setBusy(null);
    if (ok) router.refresh();
  }

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const title = newTitle.trim();
    if (title.length < 1) {
      setErr("Title is required.");
      return;
    }
    setErr(null);
    setBusy("add");
    const { ok } = await postJSON(
      `/api/partner/apprentices/${apprenticeshipId}/modules`,
      "POST",
      {
        title,
        description: newDesc.trim() || undefined,
        required: newRequired,
        gatesIndependence: newGates,
      },
    );
    setBusy(null);
    if (ok) {
      setNewTitle("");
      setNewDesc("");
      setNewRequired(false);
      setNewGates(false);
      setAdding(false);
      router.refresh();
    }
  }

  async function saveEdit() {
    if (!editing || !canEdit) return;
    const title = editTitle.trim();
    if (title.length < 1) {
      setErr("Title is required.");
      return;
    }
    setErr(null);
    setBusy("edit");
    const { ok } = await postJSON(
      `/api/partner/apprentices/${apprenticeshipId}/modules/${editing.id}`,
      "PATCH",
      {
        title,
        description: editDesc.trim() ? editDesc.trim() : null,
        required: editRequired,
        gatesIndependence: editGates,
        notes: editNotes.trim() ? editNotes.trim() : null,
      },
    );
    setBusy(null);
    if (ok) {
      setEditing(null);
      router.refresh();
    }
  }

  async function grantIndependence() {
    if (!canEdit) return;
    setErr(null);
    setBusy("independence-grant");
    const { ok } = await postJSON(
      `/api/partner/apprentices/${apprenticeshipId}/independence`,
      "POST",
    );
    setBusy(null);
    if (ok) router.refresh();
  }

  async function revokeIndependence() {
    if (!canEdit) return;
    if (
      !confirm(
        "Revoke independence? Your apprentice will no longer be able to take their own bookings.",
      )
    )
      return;
    setErr(null);
    setBusy("independence-revoke");
    const { ok } = await postJSON(
      `/api/partner/apprentices/${apprenticeshipId}/independence`,
      "DELETE",
    );
    setBusy(null);
    if (ok) router.refresh();
  }

  const allGatingDone = gatingTotal > 0 && gatingComplete === gatingTotal;

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {err}
        </div>
      )}

      {/* Independence card */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Independent bookings</h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-prose">
              When granted, your apprentice can take their own customer bookings.
              You still earn commission until Freedom.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Gating modules
            </p>
            <p className="mt-0.5 text-sm font-bold text-gray-900">
              {gatingComplete} / {gatingTotal}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/60 p-4">
          <div className="text-sm">
            {masterApprovedIndependence ? (
              <>
                <p className="font-bold text-green-700">
                  ✓ Independence granted
                </p>
                {masterApprovedAt && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    On {new Date(masterApprovedAt).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-bold text-gray-700">Not yet independent</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {allGatingDone
                    ? "All gating modules are complete — you can grant independence."
                    : `Need to sign off ${gatingTotal - gatingComplete} more gating module${gatingTotal - gatingComplete === 1 ? "" : "s"}.`}
                </p>
              </>
            )}
          </div>
          {masterApprovedIndependence ? (
            <button
              type="button"
              onClick={revokeIndependence}
              disabled={!canEdit || busy === "independence-revoke"}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {busy === "independence-revoke" ? "Revoking…" : "Revoke independence"}
            </button>
          ) : (
            <button
              type="button"
              onClick={grantIndependence}
              disabled={!canEdit || !allGatingDone || busy === "independence-grant"}
              className="btn-primary btn-md disabled:opacity-50"
              title={
                !allGatingDone
                  ? "Sign off all gating modules first"
                  : "Grant independence"
              }
            >
              {busy === "independence-grant"
                ? "Granting…"
                : "Grant independence"}
            </button>
          )}
        </div>
      </div>

      {/* Curriculum card */}
      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/40">
          <div>
            <h2 className="font-bold text-gray-900">Curriculum</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {requiredComplete} of {requiredTotal} required modules signed off.
              When everything is done and your apprentice has the jobs/ratings,
              they reach Freedom-ready.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setAdding((v) => !v);
                setErr(null);
              }}
              className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100"
            >
              {adding ? "Cancel" : "+ Add custom module"}
            </button>
          )}
        </div>

        {adding && canEdit && (
          <form
            onSubmit={addModule}
            className="px-6 py-4 border-b border-white/40 space-y-3 bg-white/40"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Module title"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-white"
              maxLength={200}
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              placeholder="Description (optional)"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-white"
              maxLength={2000}
            />
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                />
                Required for Freedom
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newGates}
                  onChange={(e) => setNewGates(e.target.checked)}
                />
                Gates independence
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewTitle("");
                  setNewDesc("");
                  setNewRequired(false);
                  setNewGates(false);
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy === "add"}
                className="btn-primary btn-sm disabled:opacity-50"
              >
                {busy === "add" ? "Adding…" : "Add module"}
              </button>
            </div>
          </form>
        )}

        {modules.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-500">
              No modules attached. Add some to track this apprentice's training.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {modules.map((m) => {
              const completed = m.completedAt !== null;
              const signed = m.masterSignoffAt !== null;
              return (
                <li key={m.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900">
                          {m.title}
                        </p>
                        {m.required && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                            Required
                          </span>
                        )}
                        {m.gatesIndependence && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                            Gates independence
                          </span>
                        )}
                        {!m.isSeeded && (
                          <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-purple-700">
                            Custom
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          {m.description}
                        </p>
                      )}
                      {m.notes && (
                        <p className="text-xs text-gray-600 italic mt-1.5 bg-yellow-50 rounded-lg px-2.5 py-1.5">
                          Note: {m.notes}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={completed}
                            disabled={!canEdit || busy === `complete-${m.id}`}
                            onChange={() => toggleCompleted(m)}
                          />
                          <span className={completed ? "font-bold text-green-700" : ""}>
                            Completed
                          </span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={signed}
                            disabled={!canEdit || busy === `signoff-${m.id}`}
                            onChange={() => toggleSignoff(m)}
                          />
                          <span className={signed ? "font-bold text-green-700" : ""}>
                            Signed off
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="shrink-0 text-right space-y-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          completed && signed
                            ? "bg-green-50 text-green-700"
                            : completed
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {completed && signed
                          ? "Signed off"
                          : completed
                            ? "Awaiting sign-off"
                            : "Not done"}
                      </span>
                      {canEdit && (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(m)}
                            className="text-[11px] font-bold text-brand-700 hover:underline"
                          >
                            Edit
                          </button>
                          {!m.isSeeded && !completed && (
                            <button
                              type="button"
                              onClick={() => deleteModule(m)}
                              disabled={busy === `delete-${m.id}`}
                              className="text-[11px] font-bold text-red-600 hover:underline disabled:opacity-50"
                            >
                              {busy === `delete-${m.id}` ? "…" : "Delete"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Edit module</h3>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Title
                </span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  maxLength={200}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Description
                </span>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  maxLength={2000}
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Notes (private)
                </span>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  maxLength={2000}
                  placeholder="Anything you want to remember about this module"
                />
              </label>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editRequired}
                    onChange={(e) => setEditRequired(e.target.checked)}
                  />
                  Required for Freedom
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editGates}
                    onChange={(e) => setEditGates(e.target.checked)}
                  />
                  Gates independence
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={busy === "edit"}
                className="btn-primary btn-sm disabled:opacity-50"
              >
                {busy === "edit" ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
