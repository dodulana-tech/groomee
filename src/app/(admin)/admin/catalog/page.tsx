"use client";

import { useState, useEffect } from "react";
import { formatNaira } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  slug: string;
  category: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  durationMins: number;
  isActive: boolean;
  description: string | null;
}

const CATEGORIES = [
  "HAIR",
  "MAKEUP",
  "NAILS",
  "BARBING",
  "LASHES",
  "SKINCARE",
  "OTHER",
];

const EMPTY_FORM = {
  name: "",
  slug: "",
  category: "HAIR",
  description: "",
  basePrice: "",
  minPrice: "",
  maxPrice: "",
  durationMins: "60",
};

export default function AdminCatalogPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function loadServices() {
    return fetch("/api/services")
      .then((r) => r.json())
      .then((d) => setServices(d.data ?? []));
  }

  useEffect(() => {
    loadServices().finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setEditSvc(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowModal(true);
  }

  function openEdit(svc: Service) {
    setEditSvc(svc);
    setForm({
      name: svc.name,
      slug: svc.slug,
      category: svc.category,
      description: svc.description ?? "",
      basePrice: String(svc.basePrice),
      minPrice: String(svc.minPrice),
      maxPrice: String(svc.maxPrice),
      durationMins: String(svc.durationMins),
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
        slug:
          form.slug.trim() ||
          form.name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, ""),
        category: form.category,
        description: form.description.trim() || null,
        basePrice: Number(form.basePrice),
        minPrice: Number(form.minPrice || form.basePrice),
        maxPrice: Number(form.maxPrice || form.basePrice),
        durationMins: Number(form.durationMins),
      };

      const url = editSvc
        ? `/api/admin/catalog/${editSvc.id}`
        : "/api/admin/catalog";
      const method = editSvc ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      await loadServices();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/admin/catalog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok)
      setServices((s) =>
        s.map((svc) => (svc.id === id ? { ...svc, isActive: !current } : svc)),
      );
  }

  const categories = CATEGORIES.filter((c) =>
    services.some((s) => s.category === c),
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">
            {services.length} services · Manage pricing and availability
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "#1A3A2A" }}
        >
          + Add service
        </button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200"
            style={{ borderTopColor: "#1A3A2A" }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
                {cat}
              </h2>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["Service", "Duration", "Base price", "Status", ""].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {services
                      .filter((s) => s.category === cat)
                      .map((svc) => (
                        <tr
                          key={svc.id}
                          className={`hover:bg-gray-50/50 transition-colors ${!svc.isActive ? "opacity-50" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">
                              {svc.name}
                            </p>
                            {svc.description && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {svc.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {svc.durationMins >= 60
                              ? `${Math.floor(svc.durationMins / 60)}h${svc.durationMins % 60 ? ` ${svc.durationMins % 60}m` : ""}`
                              : `${svc.durationMins}m`}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-800">
                            {formatNaira(svc.basePrice)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleActive(svc.id, svc.isActive)}
                              className="rounded-full px-3 py-1 text-xs font-bold transition-colors"
                              style={{
                                background: svc.isActive
                                  ? "#DCFCE7"
                                  : "#F3F4F6",
                                color: svc.isActive ? "#166534" : "#6B7280",
                              }}
                            >
                              {svc.isActive ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => openEdit(svc)}
                              className="text-xs font-semibold text-gray-400 hover:text-gray-700"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {services.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
              <p className="text-3xl mb-2">✂️</p>
              <p className="font-semibold text-gray-500 mb-4">
                No services yet
              </p>
              <button
                onClick={openAdd}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: "#1A3A2A" }}
              >
                Add first service
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">
                {editSvc ? "Edit service" : "Add new service"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Service name *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                    placeholder="e.g. Knotless Braids"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
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
                    Duration (mins) *
                  </label>
                  <input
                    required
                    type="number"
                    min="15"
                    value={form.durationMins}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, durationMins: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                    placeholder="60"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Base price (₦) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.basePrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, basePrice: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                    placeholder="15000"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Min price (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.minPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, minPrice: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                    placeholder="Same as base"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                    Max price (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.maxPrice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, maxPrice: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400"
                    placeholder="Same as base"
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
                    placeholder="Brief description of the service"
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
                    : editSvc
                      ? "Save changes"
                      : "Add service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
