"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const UNIT_OPTIONS = ["piece", "ml", "g", "bottle", "pack", "set"];

export default function ProductEditForm({
  id,
  initial,
}: {
  id: string;
  initial: {
    name: string;
    slug: string;
    sku: string;
    unit: string;
    unitCost: number;
    description: string;
    isActive: boolean;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...initial,
    unitCost: String(initial.unitCost),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk(false);
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        sku: form.sku.trim() || null,
        unit: form.unit,
        unitCost: Number(form.unitCost) || 0,
        description: form.description.trim() || null,
        isActive: form.isActive,
      };
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setOk(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 text-sm">
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
          Name
        </label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Slug
          </label>
          <input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            SKU
          </label>
          <input
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Unit
          </label>
          <select
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
            Unit cost (₦)
          </label>
          <input
            type="number"
            value={form.unitCost}
            onChange={(e) =>
              setForm((f) => ({ ...f, unitCost: e.target.value }))
            }
            className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
          Description
        </label>
        <textarea
          rows={2}
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 resize-none"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) =>
            setForm((f) => ({ ...f, isActive: e.target.checked }))
          }
        />
        Active
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {ok && <p className="text-sm text-green-600">Saved.</p>}
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-xl text-sm font-bold text-white"
        style={{ background: saving ? "#9CA3AF" : "#1A3A2A" }}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
