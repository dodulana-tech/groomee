"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LOGO_TEAL_BASE64 } from "@/lib/logo";
import { formatPhone, isValidNigerianPhone } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type AppState = "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "CLOSED";
type Step = "about" | "services" | "zones" | "bank" | "review";

interface ZoneOpt {
  id: string;
  name: string;
  city: string;
  cityLive: boolean;
  priority: boolean;
}
interface CategoryOpt {
  id: string;
  label: string;
}
interface Bank {
  name: string;
  code: string;
}
interface Application {
  name: string;
  bio: string | null;
  yearsExperience: number | null;
  portfolioUrl: string | null;
  categories: string[];
  zoneIds: string[];
  zoneNames: string[];
  bankCode: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
  appliedAt: string;
  rejectionReason: string | null;
}
interface StatusPayload {
  state: AppState;
  sessionRole: string;
  user: { name: string | null; phone: string | null; email: string | null };
  application: Application | null;
  options: { zones: ZoneOpt[]; categories: CategoryOpt[] };
}

const STEPS: { key: Step; label: string }[] = [
  { key: "about", label: "About you" },
  { key: "services", label: "Services" },
  { key: "zones", label: "Areas" },
  { key: "bank", label: "Payouts" },
  { key: "review", label: "Submit" },
];

const CATEGORY_META: Record<string, { emoji: string; desc: string }> = {
  HAIR: { emoji: "💇🏿‍♀️", desc: "Braids, weaves, wigs, natural styles" },
  MAKEUP: { emoji: "💄", desc: "Soft glam, full glam, bridal" },
  NAILS: { emoji: "💅🏿", desc: "Gel, acrylic, extensions, mani-pedi" },
  LASHES: { emoji: "👁️", desc: "Classic, hybrid, volume" },
  BARBING: { emoji: "✂️", desc: "Fades, cuts, shape-ups, beards" },
  SKINCARE: { emoji: "✨", desc: "Facials and glow treatments" },
  OTHER: { emoji: "🌿", desc: "Other beauty services" },
};

const DRAFT_KEY = "groomee:pro-application-draft";

interface Draft {
  name: string;
  email: string;
  bio: string;
  years: string;
  portfolio: string;
  categories: string[];
  zoneIds: string[];
  bankCode: string;
  bankAccount: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  email: "",
  bio: "",
  years: "",
  portfolio: "",
  categories: [],
  zoneIds: [],
  bankCode: "",
  bankAccount: "",
};

function readDraft(): Partial<Draft> | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {}
}
function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PartnerOnboardingPage() {
  return (
    <Suspense fallback={<Shell><p className="text-center text-sm text-gray-400">Loading…</p></Shell>}>
      <Onboarding />
    </Suspense>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-[100dvh] bg-cream-50 px-4 py-8 sm:py-12">
      <div className={`mx-auto w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <img src={LOGO_TEAL_BASE64} alt="Groomee" width={40} height={40} className="rounded-full" />
        </Link>
        {children}
      </div>
    </div>
  );
}

function Onboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("src")?.slice(0, 40) ?? undefined;

  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch("/api/applications/pro", { cache: "no-store" });
      if (res.status === 401) {
        setNeedsAuth(true);
        setStatus(null);
        return;
      }
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.error ?? "Could not load your application.");
      setNeedsAuth(false);
      setStatus(j.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your application.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <Shell>
        <div className="glass rounded-2xl border border-white/20 p-6 text-center shadow-xl">
          <p className="mb-4 text-sm font-medium text-red-600">{loadError}</p>
          <button onClick={load} className="btn-primary btn-md">Try again</button>
        </div>
      </Shell>
    );
  }

  if (needsAuth) {
    return (
      <Shell>
        <PhoneGate onVerified={load} />
      </Shell>
    );
  }

  if (!status) {
    return (
      <Shell>
        <p className="text-center text-sm text-gray-400">Loading…</p>
      </Shell>
    );
  }

  const showForm = status.state === "NONE" || editing;

  if (!showForm) {
    return (
      <Shell wide>
        <StatusView
          status={status}
          onEdit={() => setEditing(true)}
          onOpenPortal={async () => {
            const res = await fetch("/api/applications/pro/session", { method: "POST" });
            const j = await res.json().catch(() => ({}));
            if (res.ok && j.data?.isPro) {
              router.push("/partner");
              router.refresh();
            } else {
              router.push("/partner/login");
            }
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell wide>
      <ApplicationForm
        status={status}
        source={source}
        onCancelEdit={status.state === "NONE" ? undefined : () => setEditing(false)}
        onSubmitted={async () => {
          clearDraft();
          setEditing(false);
          await load();
          window.scrollTo({ top: 0 });
        }}
      />
    </Shell>
  );
}

// ─── Phone gate (inline OTP — no detour through the customer sign-in) ────────

function PhoneGate({ onVerified }: { onVerified: () => void }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    if (!isValidNigerianPhone(phone)) {
      setError("Enter a valid Nigerian number, e.g. 0803 123 4567.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatPhone(phone) }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't send the code. Please try again.");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatPhone(phone), otp }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "That code didn't work.");
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
          Join Groomee as a beauty professional
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          About 3 minutes. Start with the WhatsApp number customers and our team will reach you on.
        </p>
      </div>
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-xl">
        {step === "phone" ? (
          <form onSubmit={send} className="space-y-4" noValidate>
            <div>
              <label htmlFor="ap-phone" className="input-label mb-1">WhatsApp number</label>
              <input
                id="ap-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                placeholder="0803 123 4567"
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-400">We&apos;ll send a 6-digit code by WhatsApp and SMS.</p>
            </div>
            {error && <p className="text-sm font-medium text-red-500" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
              {busy ? "Sending…" : "Send code →"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4" noValidate>
            <button
              type="button"
              onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
              className="text-xs font-semibold text-gray-500"
            >
              ← Change number
            </button>
            <div>
              <label htmlFor="ap-otp" className="input-label mb-1">Code sent to {phone}</label>
              <input
                id="ap-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="input text-center text-xl font-bold tracking-[0.4em]"
                placeholder="••••••"
                autoFocus
              />
            </div>
            {error && <p className="text-sm font-medium text-red-500" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary btn-lg w-full">
              {busy ? "Checking…" : "Continue →"}
            </button>
            <button type="button" onClick={() => send()} disabled={busy} className="w-full text-xs font-semibold text-brand-700">
              Resend code
            </button>
          </form>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-gray-500">
        Already a Groomee pro?{" "}
        <Link href="/partner/login" className="font-semibold text-brand-700">Sign in</Link>
        {" · "}
        <Link href="/become-a-pro" className="font-semibold text-brand-700">How it works</Link>
      </p>
    </div>
  );
}

// ─── Status view ─────────────────────────────────────────────────────────────

function StatusView({
  status,
  onEdit,
  onOpenPortal,
}: {
  status: StatusPayload;
  onEdit: () => void;
  onOpenPortal: () => Promise<void>;
}) {
  const [opening, setOpening] = useState(false);
  const app = status.application;
  const first = (app?.name ?? status.user.name ?? "").split(" ")[0];

  if (status.state === "APPROVED") {
    return (
      <div className="glass rounded-2xl border border-white/20 p-6 text-center shadow-xl sm:p-8">
        <div className="text-4xl">🎉</div>
        <h1 className="mt-3 font-display text-2xl font-bold text-gray-900">You&apos;re approved{first ? `, ${first}` : ""}!</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your partner portal is ready. Finish your checklist there and go online to receive jobs.
        </p>
        <button
          onClick={async () => { setOpening(true); try { await onOpenPortal(); } finally { setOpening(false); } }}
          disabled={opening}
          className="btn-primary btn-lg mt-6 w-full sm:w-auto"
        >
          {opening ? "Opening…" : "Open my partner portal →"}
        </button>
      </div>
    );
  }

  if (status.state === "SUSPENDED" || status.state === "CLOSED") {
    return (
      <div className="glass rounded-2xl border border-white/20 p-6 text-center shadow-xl sm:p-8">
        <h1 className="font-display text-2xl font-bold text-gray-900">Your partner account is on hold</h1>
        <p className="mt-2 text-sm text-gray-500">
          Please message the Groomee team on WhatsApp and we&apos;ll sort it out with you.
        </p>
        <Link href="/partner/login" className="btn-ghost btn-md mt-6 inline-flex">Partner sign in</Link>
      </div>
    );
  }

  if (status.state === "REJECTED") {
    return (
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-xl sm:p-8">
        <h1 className="font-display text-2xl font-bold text-gray-900">Thanks for applying{first ? `, ${first}` : ""}</h1>
        <p className="mt-2 text-sm text-gray-500">We couldn&apos;t approve your application yet. Here&apos;s what our team said:</p>
        {app?.rejectionReason && (
          <blockquote className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {app.rejectionReason}
          </blockquote>
        )}
        <p className="mt-4 text-sm text-gray-600">This isn&apos;t a final no. Update your details and send it again.</p>
        <button onClick={onEdit} className="btn-primary btn-lg mt-6 w-full">Update &amp; re-apply →</button>
      </div>
    );
  }

  // PENDING
  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-xl sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> Under review
        </span>
        <h1 className="mt-3 font-display text-2xl font-bold text-gray-900 sm:text-3xl">
          Application received{first ? `, ${first}` : ""}!
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Submitted {app ? timeAgo(app.appliedAt) : "recently"}. We&apos;ve sent a confirmation to {status.user.phone ?? "your WhatsApp"}
          {status.user.email ? ` and ${status.user.email}` : ""}. Most applications get an answer within 24 hours on weekdays.
        </p>

        <ol className="mt-6 space-y-4">
          {[
            { t: "Application received", d: "You're in the queue.", done: true },
            { t: "Quick vetting", d: "We check your details and may WhatsApp you for photos of recent work.", done: false },
            { t: "Approval & welcome", d: "You get a WhatsApp with your partner portal link.", done: false },
            { t: "Get bookable", d: "Add your photo, confirm prices and bank, then go online for your first job.", done: false },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.done ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{s.t}</p>
                <p className="text-xs text-gray-500">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {app && (
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Your application</h2>
            <button onClick={onEdit} className="text-sm font-semibold text-brand-700 hover:underline">Edit</button>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Name" value={app.name} />
            <Row
              label="Services"
              value={
                app.categories
                  .map((c) => status.options.categories.find((x) => x.id === c)?.label ?? c)
                  .join(", ") || "-"
              }
            />
            <Row label="Areas" value={app.zoneNames.join(", ") || "-"} />
            <Row label="Payouts" value={app.bankAccountName ? `Verified · ${app.bankAccountName}` : "Add after approval"} />
          </dl>
        </div>
      )}

      <p className="text-center text-xs text-gray-500">
        <Link href="/" className="font-semibold text-brand-700">← Back to Groomee</Link>
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}

// ─── Application form ────────────────────────────────────────────────────────

function ApplicationForm({
  status,
  source,
  onSubmitted,
  onCancelEdit,
}: {
  status: StatusPayload;
  source?: string;
  onSubmitted: () => Promise<void>;
  onCancelEdit?: () => void;
}) {
  const app = status.application;
  const [step, setStep] = useState<Step>("about");
  const [d, setD] = useState<Draft>(() => {
    const base: Draft = {
      ...EMPTY_DRAFT,
      name: app?.name ?? status.user.name ?? "",
      email: status.user.email ?? "",
      bio: app?.bio ?? "",
      years: app?.yearsExperience != null ? String(app.yearsExperience) : "",
      portfolio: app?.portfolioUrl ?? "",
      categories: app?.categories ?? [],
      zoneIds: app?.zoneIds ?? [],
      bankCode: app?.bankCode ?? "",
      bankAccount: app?.bankAccount ?? "",
    };
    if (app || typeof window === "undefined") return base;
    const draft = readDraft();
    return draft ? { ...base, ...draft } : base;
  });
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bank
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankName, setBankName] = useState<string | null>(app?.bankAccountName ?? null);
  const [resolving, setResolving] = useState(false);
  const [bankError, setBankError] = useState("");

  useEffect(() => {
    fetch("/api/banks")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.success && setBanks(j.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!app) writeDraft(d);
  }, [d, app]);

  const idx = STEPS.findIndex((s) => s.key === step);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const zonesByCity = useMemo(() => {
    const out: { city: string; live: boolean; zones: ZoneOpt[] }[] = [];
    for (const z of status.options.zones) {
      let g = out.find((x) => x.city === z.city);
      if (!g) out.push((g = { city: z.city, live: z.cityLive, zones: [] }));
      g.zones.push(z);
    }
    return out;
  }, [status.options.zones]);

  function validate(s: Step): boolean {
    const e: Record<string, string> = {};
    if (s === "about") {
      if (d.name.trim().length < 2) e.name = "Please enter your full name.";
      if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = "That email doesn't look right.";
      if (d.years && (!/^\d{1,2}$/.test(d.years) || Number(d.years) > 60)) e.years = "Enter years as a number, e.g. 3.";
      if (!status.user.phone && !isValidNigerianPhone(phone)) e.phone = "Enter a valid Nigerian WhatsApp number.";
    }
    if (s === "services" && d.categories.length === 0) e.categories = "Pick at least one service you offer.";
    if (s === "zones" && d.zoneIds.length === 0) e.zoneIds = "Pick at least one area you can cover.";
    if (s === "bank") {
      const acct = d.bankAccount.replace(/\D/g, "");
      if ((d.bankCode || acct) && !bankName) {
        e.bank = d.bankCode && acct.length === 10
          ? "Tap “Confirm account” first, or clear the fields to skip for now."
          : "Choose your bank and enter a 10-digit account number, or skip for now.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validate(step)) return;
    setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)].key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function prev() {
    setStep(STEPS[Math.max(idx - 1, 0)].key);
  }

  async function confirmBank() {
    setBankError("");
    setBankName(null);
    const acct = d.bankAccount.replace(/\D/g, "");
    if (!d.bankCode) return setBankError("Choose your bank first.");
    if (acct.length !== 10) return setBankError("Account number must be exactly 10 digits.");
    setResolving(true);
    try {
      const res = await fetch("/api/banks/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCode: d.bankCode, accountNumber: acct }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "We couldn't confirm that account.");
      setBankName(j.data.accountName);
      setErrors((e) => ({ ...e, bank: "" }));
    } catch (err) {
      setBankError(err instanceof Error ? err.message : "We couldn't confirm that account.");
    } finally {
      setResolving(false);
    }
  }

  async function post() {
    return fetch("/api/applications/pro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: d.name.trim(),
        email: d.email.trim(),
        bio: d.bio.trim(),
        yearsExperience: d.years ? Number(d.years) : null,
        portfolioUrl: d.portfolio.trim(),
        categories: d.categories,
        zoneIds: d.zoneIds,
        bankCode: bankName ? d.bankCode : "",
        bankAccount: bankName ? d.bankAccount.replace(/\D/g, "") : "",
        source,
      }),
    });
  }

  async function submit() {
    setFormError("");
    for (const s of STEPS) {
      if (s.key !== "review" && !validate(s.key)) {
        setStep(s.key);
        return;
      }
    }
    if (!agreed) {
      setFormError("Please agree to the Partner Terms to continue.");
      return;
    }
    setSubmitting(true);
    try {
      let res = await post();
      let j = await res.json().catch(() => ({}));

      // Email-only accounts have no verified phone. Linking one needs a code
      // sent to that number, so send them to phone sign-in (their draft is
      // kept) rather than attaching an unverified number.
      if (!res.ok && j.needsPhone) {
        setErrors({
          phone: "Please sign in with your phone number (we'll text you a code) so we can reach you about jobs. Your application is saved.",
        });
        setStep("about");
        return;
      }

      if (!res.ok) {
        const fieldStep: Record<string, Step> = {
          name: "about",
          email: "about",
          yearsExperience: "about",
          portfolioUrl: "about",
          bio: "about",
          categories: "services",
          zoneIds: "zones",
          bank: "bank",
        };
        if (j.field && fieldStep[j.field]) {
          setStep(fieldStep[j.field]);
          setErrors({ [j.field === "yearsExperience" ? "years" : j.field]: j.error });
        } else {
          setFormError(j.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      if (j.data?.emailWarning) alert(j.data.emailWarning);
      await onSubmitted();
    } catch {
      setFormError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const pct = ((idx + 1) / STEPS.length) * 100;
  const err = (k: string) =>
    errors[k] ? <p className="mt-1 text-xs font-medium text-red-500" role="alert">{errors[k]}</p> : null;

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold text-gray-900">
          {app ? "Update your application" : "Join Groomee as a beauty professional"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {status.user.phone ? `Signed in as ${status.user.phone}. ` : ""}Your progress saves as you go.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-5" aria-label={`Step ${idx + 1} of ${STEPS.length}`}>
        <div className="mb-2 flex justify-between text-[11px] font-semibold">
          {STEPS.map((s, i) => (
            <span key={s.key} className={i <= idx ? "text-brand-700" : "text-gray-400"}>
              <span className="sm:hidden">{i === idx ? s.label : i + 1}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </span>
          ))}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/20 p-5 shadow-xl sm:p-8">
        {step === "about" && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Tell us about yourself</h2>
            <div>
              <label htmlFor="f-name" className="input-label mb-1">Full name</label>
              <input id="f-name" value={d.name} onChange={(e) => set("name", e.target.value)} className="input" placeholder="As customers should see it" autoComplete="name" />
              {err("name")}
            </div>
            {!status.user.phone && (
              <div>
                <label htmlFor="f-phone" className="input-label mb-1">WhatsApp number</label>
                <input id="f-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setErrors((x) => ({ ...x, phone: "" })); }} className="input" placeholder="0803 123 4567" />
                {err("phone")}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="f-years" className="input-label mb-1">Years of experience</label>
                <input id="f-years" inputMode="numeric" value={d.years} onChange={(e) => set("years", e.target.value.replace(/\D/g, "").slice(0, 2))} className="input" placeholder="e.g. 4" />
                {err("years")}
              </div>
              <div>
                <label htmlFor="f-email" className="input-label mb-1">Email <span className="font-normal text-gray-400">(optional)</span></label>
                <input id="f-email" type="email" inputMode="email" value={d.email} onChange={(e) => set("email", e.target.value)} className="input" placeholder="you@email.com" autoComplete="email" />
                {err("email")}
              </div>
            </div>
            <div>
              <label htmlFor="f-portfolio" className="input-label mb-1">Instagram or portfolio <span className="font-normal text-gray-400">(speeds up vetting)</span></label>
              <input id="f-portfolio" value={d.portfolio} onChange={(e) => set("portfolio", e.target.value)} className="input" placeholder="@yourhandle or a link" autoCapitalize="none" />
              {err("portfolioUrl")}
            </div>
            <div>
              <label htmlFor="f-bio" className="input-label mb-1">Short bio <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea id="f-bio" value={d.bio} onChange={(e) => set("bio", e.target.value)} maxLength={500} className="input min-h-[90px] resize-none" placeholder="Your specialities and what clients love about you" />
            </div>
          </div>
        )}

        {step === "services" && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">What do you offer?</h2>
            <p className="text-sm text-gray-500">Pick all that apply. You&apos;ll confirm individual services and prices after approval.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {status.options.categories.map((c) => {
                const on = d.categories.includes(c.id);
                const meta = CATEGORY_META[c.id] ?? CATEGORY_META.OTHER;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("categories", on ? d.categories.filter((x) => x !== c.id) : [...d.categories, c.id])}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      on ? "border-brand-500 bg-brand-50 shadow-sm" : "border-gray-100 glass-card hover:border-gray-200"
                    }`}
                  >
                    <span className="text-2xl" aria-hidden>{meta.emoji}</span>
                    <span>
                      <span className="block font-semibold text-gray-900">{c.label}</span>
                      <span className="block text-xs text-gray-500">{meta.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {err("categories")}
          </div>
        )}

        {step === "zones" && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Where can you work?</h2>
            <p className="text-sm text-gray-500">
              Choose every area you can reach comfortably. ⭐ areas have the most customers waiting for pros right now.
            </p>
            {zonesByCity.map((g) => (
              <div key={g.city}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                  {g.city}
                  {!g.live && <span className="ml-2 normal-case font-medium text-gray-400">· launching soon</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.zones.map((z) => {
                    const on = d.zoneIds.includes(z.id);
                    return (
                      <button
                        key={z.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("zoneIds", on ? d.zoneIds.filter((x) => x !== z.id) : [...d.zoneIds, z.id])}
                        className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
                          on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 glass-card text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {z.priority ? "⭐ " : ""}{z.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {err("zoneIds")}
          </div>
        )}

        {step === "bank" && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">How should we pay you?</h2>
            <p className="text-sm text-gray-500">
              Optional now, needed before your first payout. We confirm the account name with your bank.
            </p>
            <div>
              <label htmlFor="f-bank" className="input-label mb-1">Bank</label>
              <select
                id="f-bank"
                value={d.bankCode}
                onChange={(e) => { set("bankCode", e.target.value); setBankName(null); setBankError(""); }}
                className="input"
              >
                <option value="">Choose your bank…</option>
                {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-acct" className="input-label mb-1">Account number</label>
              <input
                id="f-acct"
                inputMode="numeric"
                autoComplete="off"
                value={d.bankAccount}
                onChange={(e) => { set("bankAccount", e.target.value.replace(/\D/g, "").slice(0, 10)); setBankName(null); setBankError(""); }}
                className="input"
                placeholder="10-digit NUBAN"
                maxLength={10}
              />
            </div>
            {bankName ? (
              <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                ✓ Account name: <strong>{bankName}</strong>
              </p>
            ) : (
              <button type="button" onClick={confirmBank} disabled={resolving || !d.bankCode || d.bankAccount.length !== 10} className="btn-secondary btn-md">
                {resolving ? "Checking…" : "Confirm account"}
              </button>
            )}
            {bankError && <p className="text-xs font-medium text-red-500" role="alert">{bankError}</p>}
            {err("bank")}
            {(d.bankCode || d.bankAccount) && !bankName && (
              <button
                type="button"
                onClick={() => { set("bankCode", ""); set("bankAccount", ""); setBankError(""); setErrors((x) => ({ ...x, bank: "" })); }}
                className="block text-xs font-semibold text-gray-500 underline"
              >
                Clear and add it later
              </button>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <h2 className="font-display text-lg font-bold text-gray-900">Check and submit</h2>
            <dl className="space-y-2 rounded-xl bg-white/60 p-4 text-sm">
              <Row label="Name" value={d.name || "-"} />
              <Row label="Services" value={d.categories.map((c) => status.options.categories.find((x) => x.id === c)?.label ?? c).join(", ") || "-"} />
              <Row label="Areas" value={d.zoneIds.map((id) => status.options.zones.find((z) => z.id === id)?.name ?? "").filter(Boolean).join(", ") || "-"} />
              <Row label="Payouts" value={bankName ? `Verified · ${bankName}` : "Add after approval"} />
            </dl>
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
              <p className="font-semibold">How you earn</p>
              <ul className="mt-1 space-y-1 text-brand-700">
                <li>• You keep 80% of the service price, and 70% of urgency and after-hours fees.</li>
                <li>• Transport money lands in your wallet when you accept and set off.</li>
                <li>• No sign-up fee, no salon rent, no monthly charge.</li>
              </ul>
            </div>
            <details className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              <summary className="cursor-pointer font-semibold text-gray-800">Groomee Partner Terms (summary)</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Maintain professional, hygienic standards of service</li>
                <li>Arrive on time for every booking you accept</li>
                <li>Treat every customer with respect and dignity</li>
                <li>Keep your online/offline status accurate</li>
                <li>Accept the platform commission on bookings made through Groomee</li>
                <li>Complete ID verification before your first booking</li>
                <li>Follow the cancellation and dispute policies</li>
              </ul>
            </details>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setFormError(""); }} className="mt-0.5 h-5 w-5 rounded border-gray-300 text-brand-600" />
              <span className="text-sm text-gray-700">I agree to Groomee&apos;s Partner Terms</span>
            </label>
          </div>
        )}

        {formError && <p className="mt-4 text-sm font-medium text-red-500" role="alert">{formError}</p>}

        <div className="mt-6 flex gap-3">
          {idx > 0 ? (
            <button type="button" onClick={prev} className="btn-ghost btn-md">← Back</button>
          ) : onCancelEdit ? (
            <button type="button" onClick={onCancelEdit} className="btn-ghost btn-md">Cancel</button>
          ) : null}
          {step === "review" ? (
            <button type="button" onClick={submit} disabled={submitting} className="btn-primary btn-lg flex-1">
              {submitting ? "Submitting…" : app ? "Save application →" : "Submit application →"}
            </button>
          ) : (
            <button type="button" onClick={next} className="btn-primary btn-lg flex-1">
              {step === "bank" && !d.bankCode && !d.bankAccount ? "Skip for now →" : "Next →"}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        💰 Keep 80% · 👛 Wallet &amp; payouts · 🏦 Earnings Reserve · 🛡️ Health cover · 🎓 Apprenticeships
      </p>
    </div>
  );
}
