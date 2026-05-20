"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status = "HIDDEN" | "WAITLIST" | "LIVE";

interface CityRow {
  id: string;
  slug: string;
  name: string;
  status: Status;
  launchedAt: string | null;
  tagline: string;
  sortOrder: number;
  zoneCount: number;
}

interface Props {
  canManage: boolean;
  cities: CityRow[];
}

const STATUS_PILL: Record<Status, string> = {
  LIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  WAITLIST: "bg-amber-100 text-amber-700 border-amber-200",
  HIDDEN: "bg-gray-200 text-gray-600 border-gray-300",
};

export default function CitiesBoard({ canManage, cities }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function patch(slug: string, patchBody: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/cities/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update city.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error.");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-widest text-gray-500">
            <tr>
              <th className="px-4 py-3 font-bold">City</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Launched</th>
              <th className="px-4 py-3 font-bold">Zones</th>
              <th className="px-4 py-3 font-bold">Tagline</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{c.name}</p>
                  <p className="font-mono text-[11px] text-gray-400">/{c.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest ${STATUS_PILL[c.status]}`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {c.launchedAt
                    ? new Date(c.launchedAt).toLocaleDateString("en-NG")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-700 font-bold">
                  {c.zoneCount}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[18rem]">
                  {c.tagline || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage ? (
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {c.status !== "LIVE" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            patch(
                              c.slug,
                              { status: "LIVE" },
                              `Activate ${c.name}? This will:\n• Open bookings in ${c.name}\n• Notify everyone on the ${c.name} waitlist immediately\n\nProceed?`,
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Activate
                        </button>
                      )}
                      {c.status !== "WAITLIST" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            patch(
                              c.slug,
                              { status: "WAITLIST" },
                              c.status === "LIVE"
                                ? `Pause ${c.name}? New bookings will be refused.`
                                : undefined,
                            )
                          }
                          className="rounded-lg border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          Waitlist
                        </button>
                      )}
                      {c.status !== "HIDDEN" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            patch(
                              c.slug,
                              { status: "HIDDEN" },
                              `Hide ${c.name} from the public landing page?`,
                            )
                          }
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Hide
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          const next = prompt(
                            `New tagline for ${c.name}:`,
                            c.tagline,
                          );
                          if (next === null) return;
                          patch(c.slug, { tagline: next || null });
                        }}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Tagline
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">View only</span>
                  )}
                </td>
              </tr>
            ))}
            {cities.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  No cities yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {creating ? "Cancel" : "+ Add city"}
          </button>
        </div>
      )}

      {creating && canManage && (
        <NewCityForm
          onCreated={() => {
            setCreating(false);
            startTransition(() => router.refresh());
          }}
          onError={(m) => setError(m)}
        />
      )}
    </div>
  );
}

function NewCityForm({
  onCreated,
  onError,
}: {
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          tagline: tagline || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Failed to create city.");
        return;
      }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-gray-200 bg-white p-4 grid gap-3 sm:grid-cols-3"
    >
      <input
        required
        placeholder="Name (e.g. Port Harcourt)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
      />
      <input
        placeholder="Slug (auto from name if blank)"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:border-gray-400"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create"}
      </button>
      <input
        placeholder="Tagline (optional)"
        value={tagline}
        onChange={(e) => setTagline(e.target.value)}
        className="sm:col-span-3 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
      />
    </form>
  );
}
