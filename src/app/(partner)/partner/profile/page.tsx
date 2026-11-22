"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/utils";

const MIN_BIO = 40;

const CATEGORY_LABEL: Record<string, string> = {
  HAIR: "Hair styling",
  MAKEUP: "Makeup",
  NAILS: "Nails",
  LASHES: "Lashes",
  BARBING: "Barbing",
  SKINCARE: "Skincare",
  OTHER: "Other",
};

interface CatalogService {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  durationMins: number;
  offered: boolean;
  customPrice: number | null;
}

interface ZoneOption {
  id: string;
  name: string;
  city: string;
  priority: boolean;
  covered: boolean;
}

interface Bank {
  name: string;
  code: string;
}

type Msg = { kind: "ok" | "err"; text: string } | null;

function MsgLine({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`text-sm font-medium ${msg.kind === "ok" ? "text-green-600" : "text-red-500"}`} role="status">
      {msg.text}
    </p>
  );
}

export default function PartnerProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // About
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [savingAbout, setSavingAbout] = useState(false);
  const [aboutMsg, setAboutMsg] = useState<Msg>(null);

  // Photo
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<Msg>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Services
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const [svcState, setSvcState] = useState<Record<string, { on: boolean; price: string }>>({});
  const [savingSvc, setSavingSvc] = useState(false);
  const [svcMsg, setSvcMsg] = useState<Msg>(null);

  // Zones
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [zoneSel, setZoneSel] = useState<Set<string>>(new Set());
  const [savingZones, setSavingZones] = useState(false);
  const [zoneMsg, setZoneMsg] = useState<Msg>(null);

  // Bank
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [bankMsg, setBankMsg] = useState<Msg>(null);

  async function loadAll() {
    setLoadError("");
    try {
      const [p, s, z, b] = await Promise.all([
        fetch("/api/partner/profile").then((r) => r.json()),
        fetch("/api/partner/services").then((r) => r.json()),
        fetch("/api/partner/zones").then((r) => r.json()),
        fetch("/api/banks").then((r) => r.json()).catch(() => null),
      ]);
      if (!p?.success) throw new Error(p?.error ?? "Could not load your profile.");
      setProfile(p.data);
      setName(p.data.name ?? "");
      setBio(p.data.bio ?? "");
      setPhoto(p.data.photo ?? null);
      setBankCode(p.data.bankCode ?? "");
      setBankAccount(p.data.bankAccount ?? p.data.bankAccountNo ?? "");
      if (s?.success) {
        setCatalog(s.data);
        const st: Record<string, { on: boolean; price: string }> = {};
        for (const svc of s.data as CatalogService[]) {
          st[svc.id] = {
            on: svc.offered,
            price: String(svc.customPrice ?? svc.basePrice),
          };
        }
        setSvcState(st);
      }
      if (z?.success) {
        setZones(z.data);
        setZoneSel(new Set((z.data as ZoneOption[]).filter((x) => x.covered).map((x) => x.id)));
      }
      if (b?.success) setBanks(b.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Jump to the section a checklist link pointed at once content renders.
  useEffect(() => {
    if (loading || typeof window === "undefined" || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  const grouped = useMemo(() => {
    const out: Record<string, CatalogService[]> = {};
    for (const s of catalog) (out[s.category] ??= []).push(s);
    return out;
  }, [catalog]);

  const zonesByCity = useMemo(() => {
    const out: Record<string, ZoneOption[]> = {};
    for (const z of zones) (out[z.city] ??= []).push(z);
    return out;
  }, [zones]);

  async function saveAbout() {
    setAboutMsg(null);
    if (name.trim().length < 2) {
      setAboutMsg({ kind: "err", text: "Please enter your professional name." });
      return;
    }
    setSavingAbout(true);
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), bio: bio.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      setAboutMsg(res.ok ? { kind: "ok", text: "Saved." } : { kind: "err", text: d.error ?? "Failed to save." });
    } catch {
      setAboutMsg({ kind: "err", text: "Network error. Please try again." });
    } finally {
      setSavingAbout(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoMsg({ kind: "err", text: "That photo is over 5 MB. Please pick a smaller one." });
      return;
    }
    setUploading(true);
    setPhotoMsg(null);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/partner/photo", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setPhoto(data.url);
        setPhotoMsg({ kind: "ok", text: "Photo updated." });
      } else {
        setPhotoMsg({ kind: "err", text: data.error ?? "Upload failed. Please try again." });
      }
    } catch {
      setPhotoMsg({ kind: "err", text: "Something went wrong. Please try again." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveServices() {
    setSvcMsg(null);
    const services: { serviceId: string; price: number }[] = [];
    for (const s of catalog) {
      const st = svcState[s.id];
      if (!st?.on) continue;
      const price = Number(st.price);
      if (!Number.isFinite(price) || price < s.minPrice || price > s.maxPrice) {
        setSvcMsg({
          kind: "err",
          text: `${s.name}: price must be between ${formatNaira(s.minPrice)} and ${formatNaira(s.maxPrice)}.`,
        });
        return;
      }
      services.push({ serviceId: s.id, price });
    }
    if (services.length === 0) {
      setSvcMsg({ kind: "err", text: "Turn on at least one service so customers can book you." });
      return;
    }
    setSavingSvc(true);
    try {
      const res = await fetch("/api/partner/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services }),
      });
      const d = await res.json().catch(() => ({}));
      setSvcMsg(
        res.ok
          ? { kind: "ok", text: `Saved ${services.length} service${services.length === 1 ? "" : "s"}.` }
          : { kind: "err", text: d.error ?? "Failed to save." },
      );
    } catch {
      setSvcMsg({ kind: "err", text: "Network error. Please try again." });
    } finally {
      setSavingSvc(false);
    }
  }

  async function saveZones() {
    setZoneMsg(null);
    if (zoneSel.size === 0) {
      setZoneMsg({ kind: "err", text: "Pick at least one area so we can send you jobs." });
      return;
    }
    setSavingZones(true);
    try {
      const res = await fetch("/api/partner/zones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneIds: [...zoneSel] }),
      });
      const d = await res.json().catch(() => ({}));
      setZoneMsg(res.ok ? { kind: "ok", text: "Areas saved." } : { kind: "err", text: d.error ?? "Failed to save." });
    } catch {
      setZoneMsg({ kind: "err", text: "Network error. Please try again." });
    } finally {
      setSavingZones(false);
    }
  }

  async function verifyBank() {
    setBankMsg(null);
    const acct = bankAccount.replace(/\D/g, "");
    if (!bankCode) {
      setBankMsg({ kind: "err", text: "Choose your bank first." });
      return;
    }
    if (acct.length !== 10) {
      setBankMsg({ kind: "err", text: "Account number must be exactly 10 digits." });
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/partner/verify-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber: acct }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setProfile((p: any) => ({
          ...p,
          bankCode,
          bankAccount: acct,
          bankName: data.data.bankName,
          bankAccountName: data.data.accountName,
          bankVerifiedAt: new Date().toISOString(),
        }));
        setBankMsg({ kind: "ok", text: `Verified and saved: ${data.data.accountName}` });
      } else {
        setBankMsg({ kind: "err", text: data.error ?? "Could not verify account." });
      }
    } catch {
      setBankMsg({ kind: "err", text: "Something went wrong. Please try again." });
    } finally {
      setVerifying(false);
    }
  }

  const initials = (name || profile?.name || "?")
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 lg:p-8">
        <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
          <p className="text-red-600 font-semibold mb-3">{loadError}</p>
          <button onClick={() => { setLoading(true); loadAll(); }} className="btn-primary btn-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const bankVerified = Boolean(
    profile?.bankVerifiedAt && profile?.bankCode === bankCode && (profile?.bankAccount ?? "") === bankAccount.replace(/\D/g, ""),
  );
  const offeredCount = Object.values(svcState).filter((s) => s.on).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl">
      <div>
        <Link href="/partner" className="text-xs font-semibold text-brand-700 hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-500">
          What customers see, what you offer, where you work and how we pay you.
        </p>
      </div>

      {/* Photo */}
      <section id="photo" className="scroll-mt-20 glass rounded-2xl border border-white/20 p-5 sm:p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-4">Profile photo</h2>
        <div className="flex items-center gap-5">
          {photo ? (
            <img src={photo} alt="Profile photo" className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-brand-100 border-2 border-white shadow-md flex items-center justify-center text-2xl font-bold text-brand-700 select-none">
              {initials}
            </div>
          )}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary btn-sm">
              {uploading ? "Uploading…" : photo ? "Change photo" : "Upload photo"}
            </button>
            <p className="text-xs text-gray-400">A bright, front-facing photo. JPG, PNG or WebP, max 5 MB.</p>
            <MsgLine msg={photoMsg} />
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 glass rounded-2xl border border-white/20 p-5 sm:p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-4">About you</h2>
        <div className="space-y-4">
          <div>
            <label className="input-label mb-1" htmlFor="pf-name">Display name</label>
            <input id="pf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Your professional name" />
          </div>
          <div>
            <label className="input-label mb-1" htmlFor="pf-bio">Bio</label>
            <textarea
              id="pf-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              className="input min-h-[110px] resize-none"
              placeholder="e.g. 6 years doing knotless braids and frontals. Gentle on edges, always on time."
            />
            <p className={`mt-1 text-xs ${bio.trim().length >= MIN_BIO ? "text-gray-400" : "text-amber-600"}`}>
              {bio.trim().length}/500{bio.trim().length < MIN_BIO ? ` · at least ${MIN_BIO} characters helps customers trust you` : ""}
            </p>
          </div>
          <div>
            <label className="input-label mb-1">Phone</label>
            <input type="text" value={profile?.phone ?? ""} className="input bg-gray-50" disabled />
            <p className="text-xs text-gray-400 mt-1">Your sign-in number. Message the Groomee team to change it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={saveAbout} disabled={savingAbout} className="btn-primary btn-md">
              {savingAbout ? "Saving…" : "Save"}
            </button>
            <MsgLine msg={aboutMsg} />
          </div>
        </div>
      </section>

      {/* Services & prices */}
      <section id="services" className="scroll-mt-20 glass rounded-2xl border border-white/20 p-5 sm:p-6 shadow-lg">
        <h2 className="font-bold text-gray-900">Services &amp; prices</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          Turn on what you do and set your price inside Groomee&apos;s fair range. You keep your share of every booking.
        </p>
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{CATEGORY_LABEL[cat] ?? cat}</p>
              <ul className="space-y-2">
                {list.map((s) => {
                  const st = svcState[s.id] ?? { on: false, price: String(s.basePrice) };
                  return (
                    <li
                      key={s.id}
                      className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center ${
                        st.on ? "border-brand-300 bg-brand-50/50" : "border-gray-100 bg-white/60"
                      }`}
                    >
                      <label className="flex flex-1 items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={st.on}
                          onChange={(e) =>
                            setSvcState((prev) => ({ ...prev, [s.id]: { ...st, on: e.target.checked } }))
                          }
                          className="mt-0.5 h-5 w-5 rounded border-gray-300 text-brand-600"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-900">{s.name}</span>
                          <span className="block text-xs text-gray-500">
                            {formatNaira(s.minPrice)} – {formatNaira(s.maxPrice)} · ~{s.durationMins} min
                          </span>
                        </span>
                      </label>
                      {st.on && (
                        <div className="flex items-center gap-2 sm:w-40">
                          <span className="text-sm text-gray-500">₦</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={s.minPrice}
                            max={s.maxPrice}
                            step={500}
                            value={st.price}
                            onChange={(e) =>
                              setSvcState((prev) => ({ ...prev, [s.id]: { ...st, price: e.target.value } }))
                            }
                            className="input py-2"
                            aria-label={`${s.name} price`}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={saveServices} disabled={savingSvc} className="btn-primary btn-md">
            {savingSvc ? "Saving…" : `Save services (${offeredCount})`}
          </button>
          <MsgLine msg={svcMsg} />
        </div>
      </section>

      {/* Zones */}
      <section id="zones" className="scroll-mt-20 glass rounded-2xl border border-white/20 p-5 sm:p-6 shadow-lg">
        <h2 className="font-bold text-gray-900">Areas you cover</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          We only send you jobs in these areas. ⭐ marks where customers need pros most right now.
        </p>
        <div className="space-y-4">
          {Object.entries(zonesByCity).map(([city, list]) => (
            <div key={city}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{city}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((z) => {
                  const on = zoneSel.has(z.id);
                  return (
                    <button
                      key={z.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setZoneSel((prev) => {
                          const next = new Set(prev);
                          if (next.has(z.id)) next.delete(z.id);
                          else next.add(z.id);
                          return next;
                        })
                      }
                      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
                        on
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-gray-200 bg-white/70 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {z.priority ? "⭐ " : ""}
                      {z.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={saveZones} disabled={savingZones} className="btn-primary btn-md">
            {savingZones ? "Saving…" : "Save areas"}
          </button>
          <MsgLine msg={zoneMsg} />
        </div>
      </section>

      {/* Bank */}
      <section id="bank" className="scroll-mt-20 glass rounded-2xl border border-white/20 p-5 sm:p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gray-900">Payout account</h2>
          {bankVerified ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">✓ Verified</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">Not verified</span>
          )}
        </div>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          We confirm the account name with your bank before saving, so your money never goes to the wrong place.
        </p>
        <div className="space-y-4">
          <div>
            <label className="input-label mb-1" htmlFor="pf-bank">Bank</label>
            <select
              id="pf-bank"
              value={bankCode}
              onChange={(e) => {
                setBankCode(e.target.value);
                setBankMsg(null);
              }}
              className="input"
            >
              <option value="">Choose your bank…</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label mb-1" htmlFor="pf-acct">Account number</label>
            <input
              id="pf-acct"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={bankAccount}
              onChange={(e) => {
                setBankAccount(e.target.value.replace(/\D/g, "").slice(0, 10));
                setBankMsg(null);
              }}
              className="input"
              placeholder="10-digit NUBAN"
              maxLength={10}
            />
          </div>
          {bankVerified && profile?.bankAccountName && (
            <p className="text-sm text-gray-700">
              Account name: <strong>{profile.bankAccountName}</strong>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={verifyBank}
              disabled={verifying || bankVerified}
              className="btn-primary btn-md"
            >
              {verifying ? "Verifying…" : bankVerified ? "Verified" : "Verify & save"}
            </button>
            <MsgLine msg={bankMsg} />
          </div>
        </div>
      </section>
    </div>
  );
}
