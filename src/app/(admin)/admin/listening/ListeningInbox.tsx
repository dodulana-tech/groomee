"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status = "NEW" | "IN_PROGRESS" | "REPLIED" | "IGNORED";

interface MentionRow {
  id: string;
  source: string;
  url: string | null;
  authorHandle: string | null;
  text: string;
  postedAt: string;
  matchedTerm: string | null;
  competitor: string | null;
  intent: string | null;
  sentiment: string | null;
  urgency: string | null;
  relevant: boolean | null;
  city: string | null;
  service: string | null;
  summary: string | null;
  suggestedReply: string | null;
  status: Status;
  note: string | null;
}

const INTENT_PILL: Record<string, string> = {
  LEAD: "bg-emerald-100 text-emerald-700 border-emerald-200",
  COMPLAINT: "bg-rose-100 text-rose-700 border-rose-200",
  QUESTION: "bg-sky-100 text-sky-700 border-sky-200",
  PRAISE: "bg-amber-100 text-amber-700 border-amber-200",
  PRO_RECRUIT: "bg-purple-100 text-purple-700 border-purple-200",
  COMPETITOR_COMPLAINT: "bg-orange-100 text-orange-700 border-orange-200",
  UGC: "bg-pink-100 text-pink-700 border-pink-200",
  OTHER: "bg-gray-100 text-gray-600 border-gray-200",
};

const URGENCY_DOT: Record<string, string> = {
  HIGH: "bg-rose-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-gray-300",
};

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function ListeningInbox({ canManage, mentions }: { canManage: boolean; mentions: MentionRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [manual, setManual] = useState({ text: "", url: "", authorHandle: "" });
  const [pending, startTransition] = useTransition();

  async function setStatus(id: string, status: Status) {
    setError(null);
    const res = await fetch(`/api/admin/listening/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Failed to update.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/listening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: manual.text,
        ...(manual.url ? { url: manual.url } : {}),
        ...(manual.authorHandle ? { authorHandle: manual.authorHandle } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to add.");
      return;
    }
    setManual({ text: "", url: "", authorHandle: "" });
    setAdding(false);
    startTransition(() => router.refresh());
  }

  async function copy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {canManage && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
          {adding ? (
            <form onSubmit={addManual} className="space-y-3">
              <p className="text-sm font-semibold text-gray-800">Log a post you spotted (Stories, TikTok, WhatsApp status…)</p>
              <textarea
                required
                minLength={3}
                value={manual.text}
                onChange={(e) => setManual({ ...manual, text: e.target.value })}
                placeholder="Paste the post text"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                rows={3}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={manual.url}
                  onChange={(e) => setManual({ ...manual, url: e.target.value })}
                  placeholder="Link (optional)"
                  type="url"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <input
                  value={manual.authorHandle}
                  onChange={(e) => setManual({ ...manual, authorHandle: e.target.value })}
                  placeholder="@handle (optional)"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
                  Add &amp; classify
                </button>
                <button type="button" onClick={() => setAdding(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setAdding(true)} className="text-sm font-semibold text-gray-700">
              + Log a post manually
            </button>
          )}
        </div>
      )}

      {mentions.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          Nothing here. New mentions arrive hourly.
        </div>
      )}

      {mentions.map((m) => (
        <div key={m.id} className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {m.urgency && <span className={`h-2 w-2 rounded-full ${URGENCY_DOT[m.urgency]}`} title={`${m.urgency} urgency`} />}
            {m.intent ? (
              <span className={`rounded-full border px-2 py-0.5 font-semibold ${INTENT_PILL[m.intent]}`}>
                {m.intent.replace("_", " ").toLowerCase()}
              </span>
            ) : (
              <span className="rounded-full border border-gray-200 px-2 py-0.5 text-gray-400">unclassified</span>
            )}
            {m.sentiment && <span className="text-gray-400">{m.sentiment.toLowerCase()}</span>}
            <span className="font-semibold text-gray-600">{m.source.replace("_", " ").toLowerCase()}</span>
            {m.authorHandle && <span className="text-gray-500">{m.authorHandle}</span>}
            {m.city && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{m.city}</span>}
            {m.service && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{m.service}</span>}
            {m.competitor && <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-700">re: {m.competitor}</span>}
            <span className="ml-auto text-gray-400">{ago(m.postedAt)}</span>
          </div>

          {m.summary && <p className="mt-2 text-sm font-semibold text-gray-900">{m.summary}</p>}
          <p className="mt-1 whitespace-pre-line text-sm text-gray-600 line-clamp-4">{m.text}</p>

          {m.suggestedReply && (
            <div className="mt-3 rounded-xl bg-emerald-50/70 p-3 text-sm text-emerald-900">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700">Suggested reply</p>
              {m.suggestedReply}
              <button
                onClick={() => copy(m.id, m.suggestedReply!)}
                className="ml-2 text-xs font-semibold text-emerald-700 underline"
              >
                {copied === m.id ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {m.url && (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                Open post ↗
              </a>
            )}
            {canManage && m.status !== "REPLIED" && (
              <button onClick={() => setStatus(m.id, "REPLIED")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                Mark replied
              </button>
            )}
            {canManage && m.status === "NEW" && (
              <button onClick={() => setStatus(m.id, "IN_PROGRESS")} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                I&apos;m on it
              </button>
            )}
            {canManage && m.status !== "IGNORED" && (
              <button onClick={() => setStatus(m.id, "IGNORED")} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
                Ignore
              </button>
            )}
            {canManage && (m.status === "REPLIED" || m.status === "IGNORED") && (
              <button onClick={() => setStatus(m.id, "NEW")} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
                Reopen
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400">{m.status.replace("_", " ").toLowerCase()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
