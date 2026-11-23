"use client";

import { useMemo, useState } from "react";

type Svc = { slug: string; name: string; group: string; price: string };
type Area = { slug: string; name: string; city: "lagos" | "abuja" };
type When = "asap" | "today" | "tomorrow" | "date";
type Time = "morning" | "afternoon" | "evening";

const OTHER = "__other";

function lagosToday(offsetDays = 0) {
  const d = new Date(Date.now() + 60 * 60 * 1000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export default function BookRequestForm({
  services,
  areas,
  initial,
}: {
  services: Svc[];
  areas: Area[];
  initial: { service: string | null; city: "lagos" | "abuja"; area: string | null; when: "asap" | null };
}) {
  const [service, setService] = useState(initial.service ?? "");
  const [city, setCity] = useState<"lagos" | "abuja">(initial.city);
  const [area, setArea] = useState(initial.area ?? "");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState<When | "">(initial.when ?? "");
  const [date, setDate] = useState(lagosToday(2));
  const [time, setTime] = useState<Time | "">("");
  const [people, setPeople] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, Svc[]>();
    for (const s of services) m.set(s.group, [...(m.get(s.group) ?? []), s]);
    return [...m.entries()];
  }, [services]);
  const cityAreas = areas.filter((a) => a.city === city);
  const chosen = services.find((s) => s.slug === service);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service) return setError("Pick a service so we can match the right pro.");
    if (!area) return setError("Pick your area.");
    if (area === OTHER && !place.trim()) return setError("Tell us your area.");
    if (!when) return setError("Tell us when you'd like it.");
    setError("");
    setSending(true);
    const p = new URLSearchParams({ src: "book-form", city, svc: service });
    if (area === OTHER) p.set("place", place.trim());
    else p.set("area", area);
    p.set("when", when === "date" ? date : when);
    if (when !== "asap" && time) p.set("time", time);
    if (people > 1) p.set("n", String(people));
    if (note.trim()) p.set("note", note.trim());
    // Same tab: on phones wa.me opens the WhatsApp app directly.
    window.location.href = `/api/wa?${p.toString()}`;
    setTimeout(() => setSending(false), 4000);
  }

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "border-brand-600 bg-brand-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-brand-400"
    }`;
  const label = "mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500";
  const input = "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-brand-500";

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-6 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_8px_40px_rgba(13,27,18,0.08)] backdrop-blur sm:p-7"
    >
      <div>
        <label htmlFor="svc" className={label}>What do you need?</label>
        <select id="svc" className={input} value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">Choose a service</option>
          {groups.map(([g, list]) => (
            <optgroup key={g} label={g}>
              {list.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {chosen && <p className="mt-2 text-xs text-gray-500">Typical price: <b className="text-gray-900">{chosen.price}</b>. The team confirms the exact price before booking.</p>}
      </div>

      <div>
        <span className={label}>Where?</span>
        <div className="mb-3 flex gap-2">
          {(["lagos", "abuja"] as const).map((c) => (
            <button key={c} type="button" className={chip(city === c)} onClick={() => { setCity(c); setArea(""); }}>
              {c === "lagos" ? "Lagos" : "Abuja"}
            </button>
          ))}
        </div>
        <select aria-label="Area" className={input} value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Choose your area</option>
          {cityAreas.map((a) => (
            <option key={a.slug} value={a.slug}>{a.name}</option>
          ))}
          <option value={OTHER}>Somewhere else</option>
        </select>
        {area === OTHER && (
          <input className={`${input} mt-2`} placeholder="Your area, e.g. Magodo" maxLength={60} value={place} onChange={(e) => setPlace(e.target.value)} />
        )}
      </div>

      <div>
        <span className={label}>When?</span>
        <div className="flex flex-wrap gap-2">
          {([["asap", "ASAP"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["date", "Pick a date"]] as const).map(([v, l]) => (
            <button key={v} type="button" className={chip(when === v)} onClick={() => setWhen(v)}>{l}</button>
          ))}
        </div>
        {when === "date" && (
          <input type="date" aria-label="Date" className={`${input} mt-3`} min={lagosToday()} value={date} onChange={(e) => setDate(e.target.value)} />
        )}
        {when && when !== "asap" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {([["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"]] as const).map(([v, l]) => (
              <button key={v} type="button" className={chip(time === v)} onClick={() => setTime(time === v ? "" : v)}>{l}</button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div>
          <span className={label}>How many people?</span>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Fewer people" className={chip(false)} onClick={() => setPeople((n) => Math.max(1, n - 1))}>−</button>
            <span className="w-6 text-center text-lg font-bold text-gray-900">{people}</span>
            <button type="button" aria-label="More people" className={chip(false)} onClick={() => setPeople((n) => Math.min(20, n + 1))}>+</button>
          </div>
        </div>
        <div>
          <label htmlFor="note" className={label}>Anything else? <span className="font-normal normal-case">(optional)</span></label>
          <input id="note" className={input} maxLength={280} placeholder="Style, length, event, estate gate…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-4 text-base font-bold text-gray-950 transition-all hover:-translate-y-0.5 hover:bg-[#3be07a] hover:shadow-[0_8px_24px_rgba(37,211,102,0.35)] disabled:opacity-60"
      >
        💬 {sending ? "Opening WhatsApp…" : "Send request on WhatsApp"}
      </button>
      <p className="-mt-3 text-center text-xs text-gray-500">Nothing is booked until you confirm and pay on WhatsApp.</p>
    </form>
  );
}
