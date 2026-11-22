"use client";

import { useRef, useState } from "react";
import Link from "next/link";

interface PreviewRow {
  line: number;
  name: string;
  phone: string | null;
  rawPhone: string;
  city: string | null;
  zones: { id: string; name: string }[];
  serviceLabels: string[];
  instagram: string | null;
  note: string | null;
  action: "create" | "update" | "skip" | "error";
  errors: string[];
  warnings: string[];
}

interface CommitResult {
  line: number;
  name: string;
  phone: string | null;
  outcome: "created" | "updated" | "skipped" | "error";
  message?: string;
  proId?: string;
  invited?: boolean;
}

const ACTION_STYLE: Record<PreviewRow["action"], { label: string; cls: string }> = {
  create: { label: "Will add", cls: "bg-green-50 text-green-700" },
  update: { label: "Will update", cls: "bg-blue-50 text-blue-700" },
  skip: { label: "Skip (duplicate)", cls: "bg-gray-100 text-gray-600" },
  error: { label: "Fix needed", cls: "bg-red-50 text-red-700" },
};

export default function ImportClient() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"ACTIVE" | "PENDING">("ACTIVE");
  const [duplicates, setDuplicates] = useState<"skip" | "update">("skip");
  const [sendInvites, setSendInvites] = useState(true);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [results, setResults] = useState<CommitResult[] | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function resetOutput() {
    setPreview(null);
    setResults(null);
    setError("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500_000) {
      setError("That file is too large. Split it into smaller files.");
      return;
    }
    setText(await f.text());
    setFileName(f.name);
    resetOutput();
  }

  async function call(mode: "preview" | "commit") {
    setError("");
    setBusy(mode);
    try {
      const res = await fetch("/api/admin/pros/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode, status, duplicates, sendInvites }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (mode === "preview") {
        setPreview(j.data.rows);
        setResults(null);
      } else {
        setResults(j.data.results);
        setPreview(null);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const counts = preview
    ? {
        create: preview.filter((r) => r.action === "create").length,
        update: preview.filter((r) => r.action === "update").length,
        skip: preview.filter((r) => r.action === "skip").length,
        error: preview.filter((r) => r.action === "error").length,
      }
    : null;
  const toWrite = counts ? counts.create + counts.update : 0;

  return (
    <div className="space-y-6">
      {/* Step 1: input */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gray-900">1. Add your list</h2>
          <a
            href="/api/admin/pros/import/template"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            ⬇ Download CSV template
          </a>
        </div>
        <p className="text-xs text-gray-500">
          Columns: <strong>name, phone, city, areas, services, instagram, note</strong>. Separate several areas or
          services with “;”. Services can be categories (Hair, Makeup, Nails, Lashes, Barbing, Skincare) or exact
          service names. You can paste straight from Google Sheets or Excel.
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
            resetOutput();
          }}
          rows={8}
          placeholder={"name,phone,city,areas,services,instagram,note\nAmaka Obi,0803 123 4567,Abuja,Wuse; Maitama,Hair,@amakabraids,"}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={onFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Upload CSV
          </button>
          {fileName && <span className="text-xs text-gray-500">Loaded {fileName}</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">New pros start as</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" checked={status === "ACTIVE"} onChange={() => { setStatus("ACTIVE"); resetOutput(); }} className="mt-1" />
              <span><strong>Approved</strong> (known to us). Can sign in and get jobs.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" checked={status === "PENDING"} onChange={() => { setStatus("PENDING"); resetOutput(); }} className="mt-1" />
              <span><strong>Needs review</strong>. Goes to the applicant queue.</span>
            </label>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">If the phone is already a pro</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" checked={duplicates === "skip"} onChange={() => { setDuplicates("skip"); resetOutput(); }} className="mt-1" />
              <span>Skip them</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" checked={duplicates === "update"} onChange={() => { setDuplicates("update"); resetOutput(); }} className="mt-1" />
              <span>Add the new areas and services to them</span>
            </label>
          </fieldset>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Invite</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={sendInvites} onChange={(e) => setSendInvites(e.target.checked)} className="mt-1" />
              <span>WhatsApp each new pro their sign-in link</span>
            </label>
          </fieldset>
        </div>

        {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}

        <button
          type="button"
          onClick={() => call("preview")}
          disabled={!text.trim() || busy !== null}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy === "preview" ? "Checking…" : "2. Preview import"}
        </button>
      </section>

      {/* Step 2: preview */}
      {preview && counts && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">{counts.create} to add</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{counts.update} to update</span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">{counts.skip} duplicates skipped</span>
            <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">{counts.error} need fixing</span>
          </div>
          {counts.error > 0 && (
            <p className="text-xs text-gray-500">
              Rows that need fixing won&apos;t be imported. Fix them in your sheet and import them again later, or go
              ahead with the rest now.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-2 py-2">Line</th>
                  <th className="px-2 py-2">Result</th>
                  <th className="px-2 py-2">Name / phone</th>
                  <th className="px-2 py-2">Areas</th>
                  <th className="px-2 py-2">Services</th>
                  <th className="px-2 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 align-top">
                {preview.map((r) => (
                  <tr key={r.line} className={r.action === "error" ? "bg-red-50/30" : ""}>
                    <td className="px-2 py-2 text-xs text-gray-400">{r.line}</td>
                    <td className="px-2 py-2">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${ACTION_STYLE[r.action].cls}`}>
                        {ACTION_STYLE[r.action].label}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <p className="font-semibold text-gray-900">{r.name || "—"}</p>
                      <p className="font-mono text-xs text-gray-500">{r.phone ?? r.rawPhone}</p>
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-600">
                      {r.city && <span className="font-semibold">{r.city}: </span>}
                      {r.zones.map((z) => z.name).join(", ") || "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-gray-600">{r.serviceLabels.join(", ") || "—"}</td>
                    <td className="px-2 py-2 text-xs">
                      {r.errors.map((e) => (
                        <p key={e} className="text-red-700">• {e}</p>
                      ))}
                      {r.warnings.map((w) => (
                        <p key={w} className="text-amber-700">• {w}</p>
                      ))}
                      {r.instagram && <p className="text-gray-500">{r.instagram}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (confirm(`Import ${toWrite} pro${toWrite === 1 ? "" : "s"}${sendInvites && counts.create > 0 ? ` and WhatsApp ${counts.create} invite${counts.create === 1 ? "" : "s"}` : ""}?`)) {
                  call("commit");
                }
              }}
              disabled={toWrite === 0 || busy !== null}
              className="rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-40"
              style={{ background: "#53eb64", color: "#014342" }}
            >
              {busy === "commit" ? "Importing…" : `3. Confirm import (${toWrite})`}
            </button>
            <button type="button" onClick={resetOutput} className="text-sm font-semibold text-gray-500">
              Back to edit
            </button>
          </div>
        </section>
      )}

      {/* Step 3: results */}
      {results && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 space-y-3">
          <h2 className="font-bold text-gray-900">Import finished</h2>
          <p className="text-sm text-gray-600">
            {results.filter((r) => r.outcome === "created").length} added ·{" "}
            {results.filter((r) => r.outcome === "updated").length} updated ·{" "}
            {results.filter((r) => r.outcome === "skipped").length} skipped ·{" "}
            {results.filter((r) => r.outcome === "error").length} not imported ·{" "}
            {results.filter((r) => r.invited).length} WhatsApp invites delivered to Twilio
          </p>
          <ul className="divide-y divide-gray-50 text-sm">
            {results.map((r) => (
              <li key={r.line} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="text-xs text-gray-400">#{r.line}</span>{" "}
                  {r.proId ? (
                    <Link href={`/admin/pros/${r.proId}`} className="font-semibold text-gray-900 hover:underline">{r.name}</Link>
                  ) : (
                    <span className="font-semibold text-gray-900">{r.name || "—"}</span>
                  )}
                </span>
                <span className="text-xs">
                  <span
                    className={
                      r.outcome === "created"
                        ? "font-bold text-green-700"
                        : r.outcome === "updated"
                          ? "font-bold text-blue-700"
                          : r.outcome === "error"
                            ? "font-bold text-red-700"
                            : "font-bold text-gray-500"
                    }
                  >
                    {r.outcome}
                  </span>
                  {r.outcome === "created" && sendInvites && (
                    <span className="text-gray-500"> · invite {r.invited ? "sent" : "not delivered (check Notifications)"}</span>
                  )}
                  {r.message && <span className="text-gray-500"> · {r.message}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/admin/pros?source=imported" className="text-sm font-semibold text-brand-700 hover:underline">
              See all imported pros →
            </Link>
            <button type="button" onClick={() => { setText(""); setFileName(null); resetOutput(); }} className="text-sm font-semibold text-gray-500">
              Import another list
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
