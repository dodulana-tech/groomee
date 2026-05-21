"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  category: string;
  unit: string;
  unitCost: number;
  description: string | null;
  isActive: boolean;
  recipesCount: number;
  prosCount: number;
  decrement30d: number;
}

const CATEGORIES = [
  "HAIR_CARE",
  "MAKEUP",
  "NAILS",
  "LASHES",
  "SKINCARE",
  "TOOLS",
  "CONSUMABLE",
  "OTHER",
];

const UNIT_OPTIONS = ["piece", "ml", "g", "bottle", "pack", "set"];

const EMPTY_FORM = {
  name: "",
  slug: "",
  sku: "",
  category: "HAIR_CARE",
  unit: "piece",
  unitCost: "0",
  description: "",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  function load() {
    const params = new URLSearchParams();
    if (catFilter !== "all") params.set("category", catFilter);
    if (q) params.set("q", q);
    if (includeInactive) params.set("includeInactive", "true");
    return fetch(`/api/admin/products?${params}`)
      .then((r) => r.json())
      .then((d) => setProducts(d.data ?? []));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [catFilter, includeInactive]);

  function slugify(name: string) {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      slug: p.slug,
      sku: p.sku ?? "",
      category: p.category,
      unit: p.unit,
      unitCost: String(p.unitCost),
      description: p.description ?? "",
    });
    setError("");
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        sku: form.sku.trim() || null,
        category: form.category,
        unit: form.unit,
        unitCost: Number(form.unitCost) || 0,
        description: form.description.trim() || null,
      };
      const url = editing
        ? `/api/admin/products/${editing.id}`
        : "/api/admin/products";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      await load();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    if (res.ok) load();
  }

  const filtered = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.slug.toLowerCase().includes(q.toLowerCase()) ||
          (p.sku ?? "").toLowerCase().includes(q.toLowerCase()),
      )
    : products;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            {filtered.length} products  Global consumable catalog
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "#1A3A2A" }}
        >
          + Add product
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name / slug / SKU"
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
        />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200"
            style={{ borderTopColor: "#1A3A2A" }}
          />
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  "Product",
                  "Category",
                  "Unit",
                  "Unit cost",
                  "Recipes",
                  "Pros tracking",
                  "30d use",
                  "Status",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`hover:bg-gray-50/50 transition-colors ${!p.isActive ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.sku && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        {p.sku}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {p.category}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {formatNaira(p.unitCost)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.recipesCount}</td>
                  <td className="px-4 py-3 text-gray-600">{p.prosCount}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.decrement30d.toFixed(0)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className="rounded-full px-3 py-1 text-xs font-bold transition-colors"
                      style={{
                        background: p.isActive ? "#DCFCE7" : "#F3F4F6",
                        color: p.isActive ? "#166534" : "#6B7280",
                      }}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                    No products match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">
                {editing ? "Edit product" : "Add new product"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                    placeholder="e.g. Leave-in Conditioner 250ml"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Slug
                  </label>
                  <input
                    value={form.slug}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slug: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                    placeholder="leave-in-conditioner-250ml"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    SKU
                  </label>
                  <input
                    value={form.sku}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sku: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                    placeholder="LIC-250"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Unit *
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Unit cost (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.unitCost}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unitCost: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 resize-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm font-medium text-red-500">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: saving ? "#9CA3AF" : "#1A3A2A" }}
                >
                  {saving
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : "Add product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
