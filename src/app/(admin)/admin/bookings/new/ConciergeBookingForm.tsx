"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";
import { watToDate } from "@/lib/wat";
import PayLinkPanel from "@/components/admin/PayLinkPanel";

type City = { id: string; name: string; slug: string; status: string };
type Zone = { id: string; name: string; cityId: string | null };
type Service = {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  durationMins: number;
};
type Pro = {
  id: string;
  name: string;
  availability: string;
  avgRating: number;
  zoneIds: string[];
  serviceIds: string[];
};
type Quote = {
  lines: { serviceId: string; name: string; price: number; proPrice: boolean; durationMins: number }[];
  durationMins: number;
  listBaseAmount: number;
  baseAmount: number;
  overridden: boolean;
  priceRange: { min: number; max: number };
  surcharge: { type: string | null; amount: number; label: string | null };
  totalAmount: number;
  platformFee: number;
  proEarning: number;
};
type Created = {
  bookingId: string;
  reference: string;
  customer: { name: string | null; phone: string; created: boolean };
  city: { name: string; status: string };
  payUrl: string;
  message: string;
  whatsappUrl: string;
  fallbackSent: boolean;
  quote: Quote;
};

const input =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-deep/20 focus:border-brand-deep";
const label = "block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1";
const section = "bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 space-y-4";

function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}
function lagosNextHour(): string {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hour12: false }).format(new Date()),
  );
  return `${String(Math.min(h + 2, 21)).padStart(2, "0")}:00`;
}
const CATEGORY_LABEL: Record<string, string> = {
  HAIR: "Hair",
  BARBING: "Barbing",
  NAILS: "Nails",
  MAKEUP: "Makeup",
  SKINCARE: "Skincare",
  LASHES: "Lashes",
  OTHER: "Other",
};

export default function ConciergeBookingForm() {
  const [opts, setOpts] = useState<{ cities: City[]; zones: Zone[]; services: Service[]; pros: Pro[] } | null>(null);
  const [loadError, setLoadError] = useState("");

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [isAsap, setIsAsap] = useState(false);
  const [date, setDate] = useState(lagosToday());
  const [time, setTime] = useState(lagosNextHour());
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [proId, setProId] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideOn, setOverrideOn] = useState(false);
  const [priceOverride, setPriceOverride] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [canForce, setCanForce] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => {
    fetch("/api/admin/concierge/options")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.error ?? "Couldn't load options.");
        setOpts(d.data);
        if (d.data.cities.length) setCityId(d.data.cities[0].id);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  const zones = useMemo(() => opts?.zones.filter((z) => z.cityId === cityId) ?? [], [opts, cityId]);
  const city = opts?.cities.find((c) => c.id === cityId);
  const serviceById = useMemo(() => new Map(opts?.services.map((s) => [s.id, s]) ?? []), [opts]);
  const eligiblePros = useMemo(() => {
    if (!opts || !zoneId || serviceIds.length === 0) return [];
    return opts.pros.filter(
      (p) => p.zoneIds.includes(zoneId) && serviceIds.every((id) => p.serviceIds.includes(id)),
    );
  }, [opts, zoneId, serviceIds]);

  // Drop a picked pro who no longer fits the area / services.
  useEffect(() => {
    if (proId && !eligiblePros.some((p) => p.id === proId)) setProId("");
  }, [eligiblePros, proId]);

  const scheduledIso = !isAsap && date && time ? watToDate(date, time).toISOString() : undefined;
  const overrideNum = overrideOn && priceOverride ? Number(priceOverride.replace(/[^\d.]/g, "")) : null;

  // Live quote: same server pricing the booking will be created with.
  useEffect(() => {
    if (serviceIds.length === 0) {
      setQuote(null);
      setQuoteError("");
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch("/api/admin/concierge/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({
          serviceIds,
          isAsap,
          scheduledFor: scheduledIso,
          proId: proId || null,
          priceOverride: overrideNum && overrideNum > 0 ? overrideNum : null,
        }),
      })
        .then(async (r) => {
          const d = await r.json();
          if (d.success) {
            setQuote(d.data);
            setQuoteError("");
          } else {
            setQuoteError(d.error ?? "Couldn't price this.");
          }
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [serviceIds, isAsap, scheduledIso, proId, overrideNum]);

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(force = false) {
    setError("");
    setCanForce(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/concierge/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name: name || undefined,
          zoneId,
          address,
          isAsap,
          scheduledFor: scheduledIso,
          serviceIds,
          proId: proId || null,
          notes: notes || undefined,
          priceOverride: overrideNum && overrideNum > 0 ? overrideNum : null,
          overrideReason: overrideOn ? overrideReason : undefined,
          force,
        }),
      });
      const d = await res.json();
      if (!d.success) {
        setError(d.error ?? "Something went wrong.");
        if (d.code === "OUT_OF_HOURS" || d.code === "SCHEDULE_CONFLICT") setCanForce(true);
        if (d.code === "PAYMENT_LINK_FAILED" && d.bookingId) {
          setError(`${d.error} (Booking ${d.reference} was saved.)`);
        }
        return;
      }
      setCreated(d.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setCreated(null);
    setPhone("");
    setName("");
    setAddress("");
    setServiceIds([]);
    setProId("");
    setNotes("");
    setOverrideOn(false);
    setPriceOverride("");
    setOverrideReason("");
    setError("");
  }

  if (loadError) {
    return <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{loadError}</div>;
  }
  if (!opts) {
    return <div className="rounded-2xl bg-white border border-gray-100 p-6 text-sm text-gray-400">Loading…</div>;
  }

  if (created) {
    return (
      <div className="space-y-4">
        <div className={section}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-green-600">Booking created · awaiting payment</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">
              {formatNaira(created.quote.totalAmount)} · {created.reference}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {created.customer.name ?? "Customer"} · {created.customer.phone}
              {created.customer.created ? " · new customer" : ""} · {created.city.name}
            </p>
          </div>
          <PayLinkPanel
            payUrl={created.payUrl}
            message={created.message}
            whatsappUrl={created.whatsappUrl}
            fallbackSent={created.fallbackSent}
          />
          <details className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <summary className="cursor-pointer font-semibold">Preview message</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans">{created.message}</pre>
          </details>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={reset} className="rounded-xl bg-brand-deep px-4 py-3 text-sm font-bold text-white">
            New booking
          </button>
          <Link
            href={`/admin/bookings/${created.bookingId}`}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-bold text-gray-800"
          >
            View booking
          </Link>
        </div>
      </div>
    );
  }

  const q = serviceSearch.trim().toLowerCase();
  const visibleServices = opts.services.filter(
    (s) => serviceIds.includes(s.id) || !q || s.name.toLowerCase().includes(q),
  );
  const grouped = visibleServices.reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
  const range = quote?.priceRange;
  const canSubmit =
    !submitting &&
    phone.trim().length >= 7 &&
    zoneId &&
    address.trim().length >= 5 &&
    serviceIds.length > 0 &&
    (isAsap || (date && time)) &&
    !quoteError &&
    (!overrideOn || !overrideNum || overrideReason.trim().length >= 3);

  return (
    <form
      className="space-y-4 pb-28 sm:pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) submit(false);
      }}
    >
      {/* Customer */}
      <div className={section}>
        <h2 className="text-sm font-bold text-gray-900">Customer</h2>
        <div>
          <label className={label} htmlFor="phone">WhatsApp number</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="0803 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={input}
          />
          <p className="mt-1 text-xs text-gray-400">We find their account by this number, or create one.</p>
        </div>
        <div>
          <label className={label} htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amaka" className={input} />
        </div>
      </div>

      {/* Where & when */}
      <div className={section}>
        <h2 className="text-sm font-bold text-gray-900">Where &amp; when</h2>
        <div className="grid grid-cols-2 gap-2">
          {opts.cities.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => {
                setCityId(c.id);
                setZoneId("");
              }}
              className={`rounded-xl px-3 py-3 text-sm font-bold border ${
                cityId === c.id ? "bg-brand-deep text-white border-brand-deep" : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              {c.name}
              {c.status !== "LIVE" && <span className="block text-[10px] font-semibold opacity-80">WhatsApp concierge</span>}
            </button>
          ))}
        </div>
        <div>
          <label className={label} htmlFor="zone">Area</label>
          <select id="zone" value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={input}>
            <option value="">Pick an area in {city?.name ?? "the city"}</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="address">Address or landmark</label>
          <textarea
            id="address"
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House 12, Admiralty Way, opposite Mega Plaza"
            className={input}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsAsap(true)}
            className={`rounded-xl px-3 py-3 text-sm font-bold border ${isAsap ? "bg-brand-deep text-white border-brand-deep" : "bg-white text-gray-700 border-gray-200"}`}
          >
            ASAP
          </button>
          <button
            type="button"
            onClick={() => setIsAsap(false)}
            className={`rounded-xl px-3 py-3 text-sm font-bold border ${!isAsap ? "bg-brand-deep text-white border-brand-deep" : "bg-white text-gray-700 border-gray-200"}`}
          >
            Schedule
          </button>
        </div>
        {!isAsap && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label} htmlFor="date">Date</label>
              <input id="date" type="date" min={lagosToday()} value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="time">Time (Lagos)</label>
              <input id="time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} className={input} />
            </div>
          </div>
        )}
      </div>

      {/* Services */}
      <div className={section}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Services</h2>
          {serviceIds.length > 0 && <span className="text-xs font-semibold text-brand-deep">{serviceIds.length} picked</span>}
        </div>
        {serviceIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {serviceIds.map((id, i) => (
              <button
                type="button"
                key={id}
                onClick={() => toggleService(id)}
                className="rounded-full bg-forest-50 px-3 py-1.5 text-xs font-semibold text-brand-deep"
              >
                {i === 0 ? "Main: " : "+ "}
                {serviceById.get(id)?.name} ✕
              </button>
            ))}
          </div>
        )}
        <input
          type="search"
          value={serviceSearch}
          onChange={(e) => setServiceSearch(e.target.value)}
          placeholder="Search services…"
          className={input}
        />
        <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-3">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{CATEGORY_LABEL[cat] ?? cat}</p>
              <div className="space-y-1">
                {list.map((s) => {
                  const on = serviceIds.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleService(s.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${
                        on ? "border-brand-deep bg-forest-50" : "border-gray-100 bg-white"
                      }`}
                    >
                      <span className="font-medium text-gray-800">
                        {on ? "✓ " : ""}
                        {s.name}
                        <span className="block text-xs font-normal text-gray-400">{s.durationMins} mins</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-gray-700">{formatNaira(s.basePrice)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pro */}
      <div className={section}>
        <h2 className="text-sm font-bold text-gray-900">Beauty pro</h2>
        <select value={proId} onChange={(e) => setProId(e.target.value)} className={input} disabled={!zoneId || serviceIds.length === 0}>
          <option value="">Leave for dispatch (first available pro)</option>
          {eligiblePros.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.availability.toLowerCase()}
              {p.avgRating ? ` · ${p.avgRating.toFixed(1)}★` : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400">
          {!zoneId || serviceIds.length === 0
            ? "Pick an area and services to see pros who cover them."
            : eligiblePros.length === 0
              ? "No active pro covers this area for all these services yet. Leave it for dispatch or assign later."
              : "A pre-assigned pro gets the job offer first once the customer pays."}
        </p>
        <div>
          <label className={label} htmlFor="notes">Notes for the pro</label>
          <textarea
            id="notes"
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Gate code, style reference, bring own extensions…"
            className={input}
          />
        </div>
      </div>

      {/* Price */}
      <div className={section}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Price</h2>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <input type="checkbox" checked={overrideOn} onChange={(e) => setOverrideOn(e.target.checked)} className="h-4 w-4" />
            Agreed a different price
          </label>
        </div>
        {overrideOn && (
          <div className="space-y-3">
            <div>
              <label className={label} htmlFor="override">Service price (₦)</label>
              <input
                id="override"
                inputMode="numeric"
                value={priceOverride}
                onChange={(e) => setPriceOverride(e.target.value)}
                placeholder={range ? `${range.min.toLocaleString()}–${range.max.toLocaleString()}` : ""}
                className={input}
              />
              {range && <p className="mt-1 text-xs text-gray-400">Allowed: {formatNaira(range.min)} to {formatNaira(range.max)}</p>}
            </div>
            <div>
              <label className={label} htmlFor="reason">Reason</label>
              <input
                id="reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. waist-length, extra volume"
                className={input}
              />
            </div>
          </div>
        )}
        {quoteError && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">{quoteError}</p>}
        {quote ? (
          <dl className="divide-y divide-gray-100 text-sm">
            {quote.lines.map((l) => (
              <div key={l.serviceId} className="flex justify-between py-1.5 text-gray-600">
                <dt>{l.name}{l.proPrice ? " (pro's price)" : ""}</dt>
                <dd>{formatNaira(l.price)}</dd>
              </div>
            ))}
            {quote.overridden && (
              <div className="flex justify-between py-1.5 text-gray-600">
                <dt>Agreed service price</dt>
                <dd>
                  <span className="mr-1 text-gray-300 line-through">{formatNaira(quote.listBaseAmount)}</span>
                  {formatNaira(quote.baseAmount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between py-1.5 text-gray-600">
              <dt>{quote.surcharge.label ?? "Urgency fee"}</dt>
              <dd>{formatNaira(quote.surcharge.amount)}</dd>
            </div>
            <div className="flex justify-between py-2 text-base font-bold text-gray-900">
              <dt>Customer pays</dt>
              <dd>{formatNaira(quote.totalAmount)}</dd>
            </div>
            <div className="flex justify-between py-1.5 text-xs text-gray-500">
              <dt>Groomee platform fee</dt>
              <dd>{formatNaira(quote.platformFee)}</dd>
            </div>
            <div className="flex justify-between py-1.5 text-xs text-gray-500">
              <dt>Pro earns</dt>
              <dd>{formatNaira(quote.proEarning)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-xs text-gray-400">Pick services to see the price.</p>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
          {error}
          {canForce && (
            <button
              type="button"
              onClick={() => submit(true)}
              className="mt-2 block w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              The pro has agreed this slot, book anyway
            </button>
          )}
        </div>
      )}

      {/* Sticky action bar on phones */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-100 bg-white/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-brand-deep px-4 py-4 text-base font-bold text-white disabled:bg-gray-300"
        >
          {submitting
            ? "Creating…"
            : quote
              ? `Create booking & get pay link · ${formatNaira(quote.totalAmount)}`
              : "Create booking & get pay link"}
        </button>
      </div>
    </form>
  );
}
