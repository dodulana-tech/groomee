"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Visibility = "ALWAYS_SHARE" | "ASK_PER_BOOKING" | "PRIVATE";
type Severity = "MILD" | "MODERATE" | "SEVERE";

interface ConditionRow {
  id: string;
  code: string;
  label: string;
  category: string;
  severity: Severity;
  notes: string | null;
  startedAt: string | null; // YYYY-MM-DD
  resolved: boolean;
}

interface CatalogCondition {
  code: string;
  label: string;
  category: string;
  hint?: string;
}
interface CatalogCategory {
  key: string;
  label: string;
}

type Props =
  | { mode: "visibility"; initialVisibility: Visibility }
  | { mode: "notes"; initialNotes: string }
  | { mode: "add-trigger" }
  | { mode: "condition-row"; condition: ConditionRow };

export default function HealthActions(props: Props) {
  if (props.mode === "visibility") {
    return <VisibilityControl initial={props.initialVisibility} />;
  }
  if (props.mode === "notes") {
    return <NotesControl initial={props.initialNotes} />;
  }
  if (props.mode === "add-trigger") {
    return <AddConditionButton />;
  }
  return <ConditionRowControl condition={props.condition} />;
}

// ─── VISIBILITY ────────────────────────────────────────────────────────────

function VisibilityControl({ initial }: { initial: Visibility }) {
  const router = useRouter();
  const [value, setValue] = useState<Visibility>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function update(v: Visibility) {
    if (v === value) return;
    setSaving(true);
    setError("");
    const previous = value;
    setValue(v);
    try {
      const res = await fetch("/api/profile/health", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: v }),
      });
      const data = await res.json();
      if (!res.ok) {
        setValue(previous);
        throw new Error(data.error ?? "Failed to save");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const options: { value: Visibility; label: string; sub: string }[] = [
    {
      value: "ALWAYS_SHARE",
      label: "Always share",
      sub: "Recommended — pros always see it.",
    },
    {
      value: "ASK_PER_BOOKING",
      label: "Ask me each booking",
      sub: "You confirm before each appointment.",
    },
    {
      value: "PRIVATE",
      label: "Keep private",
      sub: "Nobody sees this profile.",
    },
  ];

  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
            value === o.value
              ? "border-brand-500 bg-brand-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <input
            type="radio"
            name="visibility"
            checked={value === o.value}
            onChange={() => update(o.value)}
            disabled={saving}
            className="mt-0.5 h-4 w-4 text-brand-600"
          />
          <div>
            <p className="font-medium text-gray-900">{o.label}</p>
            <p className="text-xs text-gray-500">{o.sub}</p>
          </div>
        </label>
      ))}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── NOTES ─────────────────────────────────────────────────────────────────

function NotesControl({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/profile/health", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. I'm 5 months postpartum and my scalp is more tender than usual."
        rows={4}
        maxLength={2000}
        className="input resize-none text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">
          {value.length}/2000
        </p>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs font-semibold text-brand-600">
              ✓ Saved
            </span>
          )}
          {error && (
            <span className="text-xs text-red-500">{error}</span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ADD CONDITION ─────────────────────────────────────────────────────────

function AddConditionButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
      >
        + Add a condition
      </button>
      {open && <AddConditionModal onClose={() => setOpen(false)} />}
    </>
  );
}

function AddConditionModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<{
    categories: CatalogCategory[];
    conditions: CatalogCondition[];
  } | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [code, setCode] = useState("");
  const [severity, setSeverity] = useState<Severity>("MODERATE");
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile/health/catalog")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCatalog(d.data);
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  const grouped = useMemo(() => {
    if (!catalog) return [];
    return catalog.categories
      .map((cat) => ({
        ...cat,
        items: catalog.conditions.filter((c) => c.category === cat.key),
      }))
      .filter((g) => g.items.length > 0);
  }, [catalog]);

  const selectedDef = useMemo(
    () => catalog?.conditions.find((c) => c.code === code),
    [code, catalog],
  );

  async function submit() {
    if (!code) {
      setError("Pick a condition first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        code,
        severity,
      };
      if (notes.trim()) body.notes = notes.trim();
      if (startedAt) body.startedAt = startedAt;

      const res = await fetch("/api/profile/health/conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-gray-900">
              Add a condition
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick from the list. Only your pro sees these.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loadingCatalog ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-4">
              {grouped.map((g) => (
                <div key={g.key}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    {g.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((c) => (
                      <button
                        type="button"
                        key={c.code}
                        onClick={() => setCode(c.code)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          code === c.code
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-gray-200 text-gray-700 hover:border-brand-300"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedDef?.hint && (
              <p className="mb-3 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
                💡 {selectedDef.hint}
              </p>
            )}

            <div className="space-y-3 mb-4">
              <div>
                <label className="label">Severity</label>
                <div className="flex gap-2">
                  {(["MILD", "MODERATE", "SEVERE"] as Severity[]).map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSeverity(s)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        severity === s
                          ? s === "SEVERE"
                            ? "border-red-400 bg-red-50 text-red-700"
                            : s === "MODERATE"
                              ? "border-amber-400 bg-amber-50 text-amber-700"
                              : "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-600"
                      }`}
                    >
                      {s[0] + s.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">
                  Started{" "}
                  <span className="text-gray-400 font-normal normal-case">
                    (optional)
                  </span>
                </label>
                <input
                  type="date"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className="input"
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>

              <div>
                <label className="label">
                  Notes for your pro{" "}
                  <span className="text-gray-400 font-normal normal-case">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="e.g. Reacts to cocoa butter only."
                  className="input resize-none text-sm"
                />
              </div>
            </div>

            {error && (
              <p className="mb-3 text-sm text-red-500">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving || !code}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add condition"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CONDITION ROW ─────────────────────────────────────────────────────────

function ConditionRowControl({ condition }: { condition: ConditionRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [severity, setSeverity] = useState<Severity>(condition.severity);
  const [notes, setNotes] = useState(condition.notes ?? "");
  const [startedAt, setStartedAt] = useState(condition.startedAt ?? "");

  const sevPill =
    condition.severity === "SEVERE"
      ? "bg-red-100 text-red-700"
      : condition.severity === "MODERATE"
        ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-600";

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/profile/health/conditions/${condition.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.refresh();
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (
      !confirm(
        `Delete "${condition.label}"? This removes it completely from your profile.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/profile/health/conditions/${condition.id}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-gray-900">{condition.label}</p>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
        <div>
          <label className="label">Severity</label>
          <div className="flex gap-2">
            {(["MILD", "MODERATE", "SEVERE"] as Severity[]).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setSeverity(s)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                  severity === s
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                {s[0] + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Started</label>
          <input
            type="date"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className="input"
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            className="input resize-none text-sm"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          onClick={() =>
            patch({
              severity,
              notes: notes.trim() || null,
              startedAt: startedAt || null,
            })
          }
          disabled={busy}
          className="w-full rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`font-semibold ${condition.resolved ? "text-gray-500 line-through" : "text-gray-900"}`}
            >
              {condition.label}
            </p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sevPill}`}>
              {condition.severity}
            </span>
            {condition.resolved && (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                RESOLVED
              </span>
            )}
          </div>
          {condition.notes && (
            <p className="text-xs text-gray-500 mt-1">{condition.notes}</p>
          )}
          {condition.startedAt && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              Since {condition.startedAt}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {!condition.resolved ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={busy}
                className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:border-brand-300 hover:text-brand-600"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => patch({ resolved: true })}
                disabled={busy}
                className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:border-brand-300 hover:text-brand-600"
              >
                Mark resolved
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => patch({ resolved: false })}
              disabled={busy}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:border-brand-300 hover:text-brand-600"
            >
              Restore
            </button>
          )}
          <button
            type="button"
            onClick={destroy}
            disabled={busy}
            className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
