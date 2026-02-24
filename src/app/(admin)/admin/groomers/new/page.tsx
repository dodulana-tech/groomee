"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Service {
  id: string;
  name: string;
  category: string;
}
interface Zone {
  id: string;
  name: string;
}

export default function AddGroomerPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    bio: "",
    bankName: "",
    bankAccountNo: "",
    bankAccountName: "",
    commissionRate: 0.2,
    serviceIds: [] as string[],
    zoneIds: [] as string[],
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/admin/zones").then((r) => r.json()),
    ]).then(([s, z]) => {
      setServices(s.data ?? []);
      setZones(z.data ?? []);
    });
  }, []);

  function toggle(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.serviceIds.length) {
      setError("Select at least one service.");
      return;
    }
    if (!form.zoneIds.length) {
      setError("Select at least one zone.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/groomers/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      router.push("/admin/groomers");
    } catch {
      setError("Failed to create groomer. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const servicesByCategory = services.reduce<Record<string, Service[]>>(
    (acc, s) => {
      acc[s.category] = [...(acc[s.category] ?? []), s];
      return acc;
    },
    {},
  );

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add New Groomer</h1>
        <p className="mt-1 text-sm text-gray-500">
          Fill in the groomer's details. They will receive a WhatsApp welcome
          message on activation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal details */}
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-gray-900">Personal details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Full name *
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="input"
                required
                placeholder="Chidinma Adeyemi"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                WhatsApp phone *
              </label>
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                className="input"
                required
                placeholder="+2348012345678"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Bio (optional)
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              className="input resize-none"
              rows={2}
              placeholder="Specialties, experience, style..."
            />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Commission rate
            </label>
            <select
              value={form.commissionRate}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  commissionRate: parseFloat(e.target.value),
                }))
              }
              className="input"
            >
              <option value={0.1}>10% (Promo — first 30 days)</option>
              <option value={0.15}>15%</option>
              <option value={0.2}>20% (Standard)</option>
              <option value={0.25}>25%</option>
            </select>
          </div>
        </div>

        {/* Banking */}
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-gray-900">Banking details</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Bank name
              </label>
              <input
                value={form.bankName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bankName: e.target.value }))
                }
                className="input"
                placeholder="GTBank"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Account number
              </label>
              <input
                value={form.bankAccountNo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bankAccountNo: e.target.value }))
                }
                className="input"
                placeholder="0123456789"
                maxLength={10}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Account name
              </label>
              <input
                value={form.bankAccountName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bankAccountName: e.target.value }))
                }
                className="input"
                placeholder="As on bank records"
              />
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-gray-900">
            Services offered *
          </h2>
          {Object.entries(servicesByCategory).map(([cat, svcs]) => (
            <div key={cat} className="mb-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                {cat}
              </p>
              <div className="flex flex-wrap gap-2">
                {svcs.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        serviceIds: toggle(f.serviceIds, s.id),
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      form.serviceIds.includes(s.id)
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Zones */}
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-gray-900">Coverage zones *</h2>
          <div className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, zoneIds: toggle(f.zoneIds, z.id) }))
                }
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  form.zoneIds.includes(z.id)
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                )}
              >
                {z.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary btn-lg flex-1"
          >
            {loading
              ? "Adding groomer…"
              : "Add groomer & send welcome WhatsApp"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary btn-lg"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
