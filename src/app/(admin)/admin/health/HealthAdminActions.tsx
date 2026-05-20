"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConditionDef } from "@/lib/health";

interface ServiceOption {
  id: string;
  name: string;
  category: string;
}

interface EditRule {
  id: string;
  conditionCode: string;
  conditionLabel: string;
  serviceId: string | null;
  serviceName: string | null;
  level: "INFO" | "WARN" | "BLOCK";
  message: string;
}

interface Props {
  canManage: boolean;
  services: ServiceOption[];
  catalog: ConditionDef[];
  /** When provided, render only the per-row edit/delete buttons. */
  editRule?: EditRule;
  rowOnly?: boolean;
}

const LEVELS: Array<"INFO" | "WARN" | "BLOCK"> = ["INFO", "WARN", "BLOCK"];

const LEVEL_HINT: Record<string, string> = {
  INFO: "Heads-up only. Pro sees a note.",
  WARN: "Pro must acknowledge before starting.",
  BLOCK: "Booking is refused — pro should not proceed.",
};

export default function HealthAdminActions({
  canManage,
  services,
  catalog,
  editRule,
  rowOnly,
}: Props) {
  const router = useRouter();

  // Add modal state
  const [addOpen, setAddOpen] = useState(false);
  const [addConditionCode, setAddConditionCode] = useState(catalog[0]?.code ?? "");
  const [addServiceId, setAddServiceId] = useState<string>(""); // "" = any
  const [addLevel, setAddLevel] = useState<"INFO" | "WARN" | "BLOCK">("WARN");
  const [addMessage, setAddMessage] = useState("");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editLevel, setEditLevel] = useState<"INFO" | "WARN" | "BLOCK">(
    editRule?.level ?? "WARN",
  );
  const [editMessage, setEditMessage] = useState(editRule?.message ?? "");

  // Delete confirm state
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function resetAdd() {
    setAddConditionCode(catalog[0]?.code ?? "");
    setAddServiceId("");
    setAddLevel("WARN");
    setAddMessage("");
    setErr(null);
  }

  async function submitAdd() {
    if (!canManage) return;
    if (!addConditionCode) {
      setErr("Pick a condition.");
      return;
    }
    if (addMessage.trim().length < 2) {
      setErr("Message is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/health/contraindications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditionCode: addConditionCode,
          serviceId: addServiceId || null,
          level: addLevel,
          message: addMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data.error || "Failed to create rule.");
        return;
      }
      setAddOpen(false);
      resetAdd();
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!canManage || !editRule) return;
    if (editMessage.trim().length < 2) {
      setErr("Message is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/health/contraindications/${editRule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: editLevel,
            message: editMessage.trim(),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data.error || "Failed to update rule.");
        return;
      }
      setEditOpen(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitDelete() {
    if (!canManage || !editRule) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/health/contraindications/${editRule.id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data.error || "Failed to delete rule.");
        return;
      }
      setDeleteOpen(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ─── Row-only mode: edit + delete buttons next to a single rule ──────
  if (rowOnly && editRule) {
    if (!canManage) {
      return <span className="text-xs text-gray-400">Read only</span>;
    }
    return (
      <>
        <div className="flex gap-1 justify-end">
          <button
            type="button"
            onClick={() => {
              setEditLevel(editRule.level);
              setEditMessage(editRule.message);
              setErr(null);
              setEditOpen(true);
            }}
            className="text-xs font-semibold text-brand-600 hover:bg-brand-50 px-2 py-1 rounded-lg"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setErr(null);
              setDeleteOpen(true);
            }}
            className="text-xs font-semibold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg"
          >
            Delete
          </button>
        </div>

        {editOpen && (
          <Modal
            title={`Edit rule — ${editRule.conditionLabel}`}
            subtitle={
              editRule.serviceName
                ? `Service: ${editRule.serviceName}`
                : "Service: Any (catalog-wide)"
            }
            onClose={() => setEditOpen(false)}
          >
            <p className="text-xs text-gray-500 mb-3">
              Condition and service are locked. To repoint, delete and recreate.
            </p>
            <LevelPicker value={editLevel} onChange={setEditLevel} />
            <label className="block mt-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                Message to pro
              </span>
              <textarea
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                maxLength={500}
              />
            </label>
            {err && <ErrorBox text={err} />}
            <ModalActions
              busy={busy}
              onCancel={() => setEditOpen(false)}
              onSubmit={submitEdit}
              submitLabel="Save changes"
            />
          </Modal>
        )}

        {deleteOpen && (
          <Modal
            title="Delete rule?"
            onClose={() => setDeleteOpen(false)}
            small
          >
            <p className="text-sm text-gray-700">
              Remove the <strong>{editRule.level}</strong> rule for{" "}
              <strong>{editRule.conditionLabel}</strong>
              {editRule.serviceName
                ? ` on ${editRule.serviceName}`
                : " across all services"}
              ? This can't be undone.
            </p>
            {err && <ErrorBox text={err} />}
            <ModalActions
              busy={busy}
              onCancel={() => setDeleteOpen(false)}
              onSubmit={submitDelete}
              submitLabel="Delete"
              danger
            />
          </Modal>
        )}
      </>
    );
  }

  // ─── Top-level: the "Add rule" button ────────────────────────────────
  if (!canManage) {
    return (
      <div className="text-xs text-gray-400 italic">
        Read-only — needs <code>health.manage</code> to edit.
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetAdd();
          setAddOpen(true);
        }}
        className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand-700"
      >
        + Add rule
      </button>

      {addOpen && (
        <Modal title="Add contraindication rule" onClose={() => setAddOpen(false)}>
          <label className="block">
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              Condition
            </span>
            <select
              value={addConditionCode}
              onChange={(e) => setAddConditionCode(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              {catalog.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.category})
                </option>
              ))}
            </select>
          </label>

          <label className="block mt-3">
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              Service
            </span>
            <select
              value={addServiceId}
              onChange={(e) => setAddServiceId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="">Any service (catalog-wide)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.category}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3">
            <LevelPicker value={addLevel} onChange={setAddLevel} />
          </div>

          <label className="block mt-3">
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
              Message to pro
            </span>
            <textarea
              value={addMessage}
              onChange={(e) => setAddMessage(e.target.value)}
              rows={3}
              placeholder="What should the pro know?"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              maxLength={500}
            />
          </label>

          {err && <ErrorBox text={err} />}
          <ModalActions
            busy={busy}
            onCancel={() => setAddOpen(false)}
            onSubmit={submitAdd}
            submitLabel="Create rule"
          />
        </Modal>
      )}
    </>
  );
}

// ─── tiny shared components ──────────────────────────────────────────

function Modal({
  title,
  subtitle,
  children,
  onClose,
  small,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  small?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${
          small ? "max-w-sm" : "max-w-lg"
        } p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LevelPicker({
  value,
  onChange,
}: {
  value: "INFO" | "WARN" | "BLOCK";
  onChange: (v: "INFO" | "WARN" | "BLOCK") => void;
}) {
  return (
    <div>
      <span className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
        Level
      </span>
      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map((lv) => {
          const active = value === lv;
          return (
            <button
              key={lv}
              type="button"
              onClick={() => onChange(lv)}
              className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                active
                  ? lv === "BLOCK"
                    ? "border-red-500 bg-red-50"
                    : lv === "WARN"
                      ? "border-amber-500 bg-amber-50"
                      : "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="text-xs font-bold">{lv}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {LEVEL_HINT[lv]}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
      {text}
    </div>
  );
}

function ModalActions({
  busy,
  onCancel,
  onSubmit,
  submitLabel,
  danger,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-100 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className={`px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 ${
          danger ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700"
        }`}
      >
        {busy ? "Working…" : submitLabel}
      </button>
    </div>
  );
}
