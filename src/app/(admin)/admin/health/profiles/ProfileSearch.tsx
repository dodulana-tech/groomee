"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface ProfileRow {
  id: string;
  userId: string;
  user: { id: string; name: string | null; phone: string | null } | null;
  visibility: "ALWAYS_SHARE" | "ASK_PER_BOOKING" | "PRIVATE";
  conditionCount: number;
  lastReviewedAt: string | null;
  updatedAt: string;
}

const VISIBILITY_PILL: Record<string, string> = {
  ALWAYS_SHARE: "bg-brand-50 text-brand-700",
  ASK_PER_BOOKING: "bg-amber-50 text-amber-700",
  PRIVATE: "bg-gray-100 text-gray-600",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-NG");
}

export default function ProfileSearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ProfileRow[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (append: boolean) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (append && cursor) params.set("cursor", cursor);
      try {
        const res = await fetch(
          `/api/admin/health/profiles?${params.toString()}`,
        );
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Failed to load.");
          return;
        }
        setRows((prev) =>
          append && prev ? [...prev, ...(json.data ?? [])] : json.data ?? [],
        );
        setNextCursor(json.nextCursor ?? null);
      } catch {
        setError("Network error.");
      } finally {
        setLoading(false);
      }
    },
    [q, cursor],
  );

  // Debounced search
  useEffect(() => {
    setCursor(null);
    const t = setTimeout(() => load(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-3">
        <input
          type="search"
          placeholder="Search by name or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-xl border-0 bg-transparent px-3 py-2.5 text-sm focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {!rows ? (
          <div className="p-10 text-center text-sm text-gray-400">
            {loading ? "Loading…" : "—"}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            No profiles match.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-widest text-gray-500">
              <tr>
                <th className="px-4 py-3 font-bold">Customer</th>
                <th className="px-4 py-3 font-bold">Conditions</th>
                <th className="px-4 py-3 font-bold">Visibility</th>
                <th className="px-4 py-3 font-bold">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">
                      {p.user?.name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.user?.phone ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-700">
                    {p.conditionCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-widest ${VISIBILITY_PILL[p.visibility]}`}
                    >
                      {p.visibility.replace("_", " ").toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {timeAgo(p.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/health/profiles/${p.userId}`}
                      className="text-sm font-semibold text-brand-600 hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {nextCursor && rows && rows.length > 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setCursor(nextCursor);
              load(true);
            }}
            disabled={loading}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
