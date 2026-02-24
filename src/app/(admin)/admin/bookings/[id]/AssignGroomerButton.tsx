"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Groomer {
  id: string;
  name: string;
  phone: string;
  availability: string;
  avgRating: number;
  zones: { zone: { name: string } }[];
}

export default function AssignGroomerButton({
  bookingId,
  serviceName,
  groomers,
}: {
  bookingId: string;
  serviceName: string;
  groomers: Groomer[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function assign() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groomerId: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const available = groomers.filter((g) => g.availability === "ONLINE");
  const busy = groomers.filter((g) => g.availability === "BUSY");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl text-sm font-bold text-white"
        style={{ background: "#1A3A2A" }}
      >
        Assign groomer
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-lg text-gray-900">
                  Assign groomer
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Showing groomers qualified for{" "}
                  <span className="font-semibold text-gray-600">
                    {serviceName}
                  </span>{" "}
                  in this zone
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              {groomers.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">😔</p>
                  <p className="text-sm font-semibold text-gray-700">
                    No available groomers for {serviceName}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    No active groomers in this zone can perform this service
                    right now
                  </p>
                </div>
              )}

              {available.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Available
                  </p>
                  <div className="space-y-2">
                    {available.map((g) => (
                      <label
                        key={g.id}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${selected === g.id ? "border-green-500 bg-green-50" : "border-gray-100 hover:border-gray-200"}`}
                      >
                        <input
                          type="radio"
                          name="groomer"
                          value={g.id}
                          checked={selected === g.id}
                          onChange={() => setSelected(g.id)}
                          className="sr-only"
                        />
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                          style={{ background: "#1A3A2A" }}
                        >
                          {g.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">
                            {g.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {g.zones[0]?.zone.name ?? "—"} · ★{" "}
                            {g.avgRating.toFixed(1)}
                          </p>
                        </div>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "#DCFCE7", color: "#166534" }}
                        >
                          Online
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {busy.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Busy (override)
                  </p>
                  <div className="space-y-2">
                    {busy.map((g) => (
                      <label
                        key={g.id}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all ${selected === g.id ? "border-orange-400 bg-orange-50" : "border-gray-100 hover:border-gray-200"}`}
                      >
                        <input
                          type="radio"
                          name="groomer"
                          value={g.id}
                          checked={selected === g.id}
                          onChange={() => setSelected(g.id)}
                          className="sr-only"
                        />
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                          style={{ background: "#9CA3AF" }}
                        >
                          {g.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">
                            {g.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {g.zones[0]?.zone.name ?? "—"} · ★{" "}
                            {g.avgRating.toFixed(1)}
                          </p>
                        </div>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "#FFF7ED", color: "#C2410C" }}
                        >
                          Busy
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="px-6 text-sm text-red-500 font-medium">{error}</p>
            )}

            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={assign}
                disabled={!selected || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity disabled:opacity-40"
                style={{ background: "#1A3A2A" }}
              >
                {saving ? "Assigning…" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
