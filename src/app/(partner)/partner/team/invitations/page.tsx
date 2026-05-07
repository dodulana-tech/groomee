"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Invitation {
  id: string;
  apprenticeName: string;
  apprenticePhone: string;
  masterCommission: number;
  invitedAt: string;
  expectedFreedom: string | null;
}

export default function PartnerTeamInvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/partner/apprentices/invite");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to load invitations.");
        return;
      }
      setInvitations(data.data ?? []);
    } catch {
      setError("Could not load invitations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCancel(id: string, name: string) {
    if (!confirm(`Cancel the apprenticeship invitation to ${name}? They'll be notified.`)) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/partner/apprentices/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error ?? "Failed to cancel.");
      } else {
        setInvitations((current) => current.filter((inv) => inv.id !== id));
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href="/partner/team"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to team
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pending invitations</h1>
            <p className="text-sm text-gray-500">
              Apprentices you&apos;ve invited who haven&apos;t accepted yet.
            </p>
          </div>
          <Link href="/partner/team/invite" className="btn-primary btn-md">
            New invitation
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Loading invitations…
          </div>
        ) : invitations.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-500 mb-4">
              No pending invitations. Anyone you&apos;ve invited has either accepted, declined, or hasn&apos;t been invited yet.
            </p>
            <Link href="/partner/team/invite" className="btn-primary btn-sm">
              Invite an apprentice
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Invitee</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Master cut</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {inv.apprenticeName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inv.apprenticePhone}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {(inv.masterCommission * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(inv.invitedAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleCancel(inv.id, inv.apprenticeName)}
                      disabled={cancellingId === inv.id}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      {cancellingId === inv.id ? "Cancelling…" : "Cancel"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
