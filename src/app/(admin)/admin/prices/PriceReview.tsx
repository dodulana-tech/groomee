"use client";

import { useState } from "react";
import { FEE_KEYS } from "@/lib/seo/price-research";

type Range = { min: number; max: number };
type Svc = {
  slug: string; name: string; group: string; id: string | null;
  current: Range | null;
  suggested: (Range & { note?: string; confidence: string }) | null;
};

const naira = (n: number) => "₦" + n.toLocaleString("en-NG");
const num = (v: string) => { const n = Number(v.replace(/[^\d]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };

function Row({ s, canEdit }: { s: Svc; canEdit: boolean }) {
  const [cur, setCur] = useState<Range | null>(s.current);
  const [min, setMin] = useState(String(s.current?.min ?? s.suggested?.min ?? ""));
  const [max, setMax] = useState(String(s.current?.max ?? s.suggested?.max ?? ""));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(range: { min: number | null; max: number | null }) {
    if (!s.id) return setMsg({ ok: false, text: "This service isn't in the catalogue yet." });
    if (!range.min || !range.max) return setMsg({ ok: false, text: "Enter both prices." });
    if (range.min > range.max) return setMsg({ ok: false, text: "The lowest price can't be above the highest." });
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/catalog/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minPrice: range.min, maxPrice: range.max }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save. Try again.");
      setCur({ min: range.min, max: range.max });
      setMin(String(range.min)); setMax(String(range.max));
      setMsg({ ok: true, text: "Saved. Live on the website." });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  }

  const matches = cur && s.suggested && cur.min === s.suggested.min && cur.max === s.suggested.max;
  return (
    <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-[1.2fr_1fr_1fr_1.6fr] md:items-start">
      <div>
        <p className="font-semibold text-gray-900">{s.name}</p>
        {s.suggested?.note && <p className="mt-0.5 text-xs text-gray-500">{s.suggested.note}</p>}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">On the website</p>
        <p className="font-mono text-sm font-semibold text-gray-900">{cur ? `${naira(cur.min)} – ${naira(cur.max)}` : "Not set"}</p>
        {cur && <p className="text-xs text-gray-400">Customers see &ldquo;From {naira(cur.min)}&rdquo;</p>}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Suggested</p>
        <p className="font-mono text-sm font-semibold text-brand-700">{s.suggested ? `${naira(s.suggested.min)} – ${naira(s.suggested.max)}` : "—"}</p>
        {s.suggested && <p className="text-xs text-gray-400">{s.suggested.confidence} confidence</p>}
      </div>
      <div className="grid gap-2">
        {canEdit ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input aria-label={`${s.name} lowest price`} inputMode="numeric" className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={min} onChange={(e) => setMin(e.target.value)} />
              <span className="text-gray-400">to</span>
              <input aria-label={`${s.name} highest price`} inputMode="numeric" className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" value={max} onChange={(e) => setMax(e.target.value)} />
              <button disabled={busy} onClick={() => save({ min: num(min), max: num(max) })} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Save</button>
            </div>
            {s.suggested && !matches && (
              <button disabled={busy} onClick={() => save({ min: s.suggested!.min, max: s.suggested!.max })} className="justify-self-start text-sm font-semibold text-brand-700 underline disabled:opacity-50">
                Use suggested
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-500">Ask an admin with catalogue access to change prices.</p>
        )}
        {msg && <p className={`text-xs font-medium ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}

export default function PriceReview({
  services, canEdit, canEditFees, fees,
}: {
  services: Svc[]; canEdit: boolean; canEditFees: boolean;
  fees: { homeVisit: string; earlyMorning: string; depositPercent: string };
}) {
  const groups = [...new Set(services.map((s) => s.group))];
  const pending = services.filter(
    (s) => s.id && s.suggested && (!s.current || s.current.min !== s.suggested.min || s.current.max !== s.suggested.max),
  );
  const [bulk, setBulk] = useState<{ busy: boolean; text: string | null; ok: boolean }>({ busy: false, text: null, ok: true });

  async function applyAll() {
    if (!confirm(`Update ${pending.length} services to the suggested prices? They go live on the website straight away.`)) return;
    setBulk({ busy: true, text: null, ok: true });
    const failed: string[] = [];
    for (const s of pending) {
      const res = await fetch(`/api/admin/catalog/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minPrice: s.suggested!.min, maxPrice: s.suggested!.max }),
      }).catch(() => null);
      if (!res?.ok) failed.push(s.name);
    }
    if (failed.length) setBulk({ busy: false, ok: false, text: `Couldn't save: ${failed.join(", ")}. The rest are live.` });
    else window.location.reload();
  }
  const [f, setF] = useState(fees);
  const [feeMsg, setFeeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveFees() {
    setFeeMsg(null);
    const clean = (v: string) => v.replace(/[^\d]/g, "");
    const settings = {
      [FEE_KEYS.homeVisit]: clean(f.homeVisit),
      [FEE_KEYS.earlyMorning]: clean(f.earlyMorning),
      [FEE_KEYS.depositPercent]: clean(f.depositPercent),
    };
    const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }) });
    setFeeMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: "Couldn't save. You may not have settings access." });
  }

  return (
    <div className="max-w-5xl space-y-8">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">How prices show</h2>
        <p className="mt-1 text-xs text-gray-500">
          Customers see the lowest price as &ldquo;From ₦…&rdquo;. Keep it the true starting price, and set the highest wide enough
          to cover long, small or premium versions so pros can quote real jobs.
        </p>
        {canEdit && pending.length > 0 && (
          <button disabled={bulk.busy} onClick={applyAll} className="mt-3 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {bulk.busy ? "Saving…" : `Use all suggested prices (${pending.length})`}
          </button>
        )}
        {bulk.text && <p className={`mt-2 text-xs font-medium ${bulk.ok ? "text-green-700" : "text-red-600"}`}>{bulk.text}</p>}
      </section>
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Fees and deposit</h2>
        <p className="mt-1 text-xs text-gray-500">Leave blank or 0 if you don&apos;t charge it. The home-visit fee and deposit show on the price list.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {([["homeVisit", "Home-visit fee (₦)"], ["earlyMorning", "Early-morning fee, before 7am (₦)"], ["depositPercent", "Deposit to confirm (%)"]] as const).map(([k, label]) => (
            <label key={k} className="grid gap-1 text-xs font-semibold text-gray-500">
              {label}
              <input inputMode="numeric" disabled={!canEditFees} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        {canEditFees && <button onClick={saveFees} className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Save fees</button>}
        {feeMsg && <p className={`mt-2 text-xs font-medium ${feeMsg.ok ? "text-green-700" : "text-red-600"}`}>{feeMsg.text}</p>}
      </section>
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-400">{g}</h2>
          <div className="space-y-3">
            {services.filter((s) => s.group === g).map((s) => <Row key={s.slug} s={s} canEdit={canEdit} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
