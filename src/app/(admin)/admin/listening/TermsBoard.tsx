"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Kind = "BRAND" | "COMPETITOR" | "LEAD" | "HASHTAG";

interface TermRow {
  id: string;
  term: string;
  kind: Kind;
  competitor: string | null;
  active: boolean;
}

interface ConnectorRow {
  label: string;
  configured: boolean;
  lastRun: string | null;
}

const KIND_HELP: Record<Kind, string> = {
  BRAND: "Our names and handles",
  COMPETITOR: "Competitor names / handles",
  LEAD: "Phrases people use when looking for a pro",
  HASHTAG: "Instagram hashtags (max 25 active)",
};

const SETUP: Record<string, string> = {
  Instagram: "Set IG_USER_ID + IG_ACCESS_TOKEN (Meta app on Facebook Login, App Review + Business Verification).",
  X: "Set X_BEARER_TOKEN (pay-per-use; set a spend cap in the X console).",
  "Web (Brave)": "Set BRAVE_API_KEY ($5/month free credit covers daily runs).",
  "Google Alerts": "Create alerts for “Groomee” and competitors, deliver to RSS, put the feed URLs in GOOGLE_ALERTS_FEEDS.",
  Nairaland: "Front-page feed only (sections are bot-protected).",
  Classifier: "Set ANTHROPIC_API_KEY.",
};

export default function TermsBoard({
  canManage,
  terms,
  connectors,
}: {
  canManage: boolean;
  terms: TermRow[];
  connectors: ConnectorRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ term: string; kind: Kind; competitor: string }>({ term: "", kind: "LEAD", competitor: "" });
  const [pending, startTransition] = useTransition();

  async function call(url: string, method: string, body?: unknown) {
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Request failed.");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call("/api/admin/listening/terms", "POST", {
      term: form.term,
      kind: form.kind,
      ...(form.kind === "COMPETITOR" && form.competitor ? { competitor: form.competitor } : {}),
    });
    if (ok) setForm({ ...form, term: "", competitor: "" });
  }

  const kinds: Kind[] = ["BRAND", "COMPETITOR", "LEAD", "HASHTAG"];

  return (
    <div className={`grid gap-6 lg:grid-cols-[2fr_1fr] ${pending ? "opacity-60" : ""}`}>
      <div className="space-y-4">
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        {canManage && (
          <form onSubmit={add} className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-4">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            >
              {kinds.map((k) => (
                <option key={k} value={k}>{k.toLowerCase()}</option>
              ))}
            </select>
            <input
              required
              minLength={2}
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              placeholder={form.kind === "HASHTAG" ? "lagosbraider" : form.kind === "LEAD" ? "need a lash tech" : "term or @handle"}
              className="min-w-[200px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
            {form.kind === "COMPETITOR" && (
              <input
                value={form.competitor}
                onChange={(e) => setForm({ ...form, competitor: e.target.value })}
                placeholder="Competitor name"
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            )}
            <button type="submit" className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              Track
            </button>
          </form>
        )}

        {kinds.map((k) => (
          <div key={k} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-bold text-gray-900">{k.toLowerCase()}</p>
            <p className="mb-3 text-xs text-gray-400">{KIND_HELP[k]}</p>
            <div className="flex flex-wrap gap-2">
              {terms.filter((t) => t.kind === k).map((t) => (
                <span
                  key={t.id}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${t.active ? "border-gray-200 bg-gray-50 text-gray-800" : "border-dashed border-gray-200 text-gray-400 line-through"}`}
                >
                  {k === "HASHTAG" ? `#${t.term}` : t.term}
                  {t.competitor && t.competitor !== t.term && <span className="text-xs text-gray-400">({t.competitor})</span>}
                  {canManage && (
                    <>
                      <button
                        onClick={() => call(`/api/admin/listening/terms/${t.id}`, "PATCH", { active: !t.active })}
                        className="text-xs text-gray-500 hover:text-gray-900"
                        title={t.active ? "Pause" : "Resume"}
                      >
                        {t.active ? "⏸" : "▶"}
                      </button>
                      <button
                        onClick={() => confirm(`Stop tracking "${t.term}"?`) && call(`/api/admin/listening/terms/${t.id}`, "DELETE")}
                        className="text-xs text-gray-400 hover:text-rose-600"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm font-bold text-gray-900">Sources</p>
          <ul className="space-y-3">
            {connectors.map((c) => (
              <li key={c.label} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${c.configured ? "bg-emerald-500" : "bg-gray-300"}`} />
                  <span className="font-semibold text-gray-800">{c.label}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {c.configured ? (c.lastRun ? `ran ${new Date(c.lastRun).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}` : "on") : "not set up"}
                  </span>
                </div>
                {!c.configured && <p className="mt-1 pl-4 text-xs text-gray-400">{SETUP[c.label]}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs leading-relaxed text-gray-500">
          <p className="mb-1 font-bold text-gray-700">Data rules</p>
          Only the handle, post text, link and time are stored. Un-actioned posts are deleted after 90 days (NDPA data
          minimisation). Don&apos;t copy social handles into customer profiles without the person&apos;s consent (Meta
          Platform Terms). Never auto-post replies.
        </div>
      </div>
    </div>
  );
}
