"use client";

import { Suspense, useState } from "react";
import { LOGO_TEAL_BASE64 } from "@/lib/logo";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPhone, isValidNigerianPhone } from "@/lib/utils";

type AuthMethod = "phone" | "email";
type Step = "choose" | "phone" | "email" | "otp" | "link-phone" | "name";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const [method, setMethod] = useState<AuthMethod>("phone");
  const [step, setStep] = useState<Step>("choose");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [needsPhone, setNeedsPhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneCollision, setPhoneCollision] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  function getSubtitle(): string {
    switch (step) {
      case "choose":
        return "Welcome to Groomee! Let's get you in";
      case "phone":
        return "What's your phone number?";
      case "email":
        return "What's your email?";
      case "otp":
        return method === "phone"
          ? `We just sent a code to ${phone}`
          : `We just sent a code to ${email}`;
      case "link-phone":
        return "One more thing — we need your number for booking updates and WhatsApp notifications";
      case "name":
        return "Almost done! What should we call you?";
      default:
        return "";
    }
  }

  async function resendOtp() {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
    try {
      const url = method === "phone" ? "/api/auth/send-otp" : "/api/auth/send-email-otp";
      const body = method === "phone" ? { phone: formatPhone(phone) } : { email };
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {}
  }

  // ─── Phone OTP ─────────────────────────────────────────────────────────────
  async function sendPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isValidNigerianPhone(phone)) {
      setError("Please enter a valid Nigerian phone number.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatPhone(phone) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setStep("otp");
    } catch {
      setError("Hmm, that didn't work. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhoneOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatPhone(phone), otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      if (data.data.isNewUser) {
        setStep("name");
      } else {
        router.push(redirect);
        router.refresh();
      }
    } catch {
      setError("That code didn't work. Double-check and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Email OTP ─────────────────────────────────────────────────────────────
  async function sendEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setStep("otp");
    } catch {
      setError("Hmm, that didn't work. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmailOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      if (data.data.needsPhone) {
        setNeedsPhone(true);
        setStep("link-phone");
      } else if (data.data.isNewUser) {
        setStep("name");
      } else {
        router.push(redirect);
        router.refresh();
      }
    } catch {
      setError("That code didn't work. Double-check and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Link Phone ────────────────────────────────────────────────────────────
  async function linkPhone(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPhoneCollision(false);
    if (!isValidNigerianPhone(phone)) {
      setError("Please enter a valid Nigerian phone number.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/link-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatPhone(phone) }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409: phone belongs to a different account. Offer "sign in with phone".
        if (res.status === 409) {
          setPhoneCollision(true);
          setError(data.error);
          return;
        }
        setError(data.error);
        return;
      }
      // If the API merged this email onto the existing phone-linked account,
      // there is no fresh signup — drop the user back into their account.
      if (data.data?.merged) {
        router.push(redirect);
        router.refresh();
        return;
      }
      setStep("name");
    } catch {
      setError("We couldn't link that number. Please check it and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function switchToPhoneSignIn() {
    // User landed on link-phone but the number belongs to a different account.
    // Send an SMS OTP to that number so they can sign into the right account.
    setError("");
    setPhoneCollision(false);
    setMethod("phone");
    setOtp("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatPhone(phone) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send a code. Please try again.");
        setMethod("email");
        return;
      }
      setStep("otp");
    } catch {
      setError("Hmm, that didn't work. Please try again.");
      setMethod("email");
    } finally {
      setLoading(false);
    }
  }

  // ─── Save Name ─────────────────────────────────────────────────────────────
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    try {
      await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      router.push(redirect);
      router.refresh();
    } catch {
      setError("Couldn't save your name. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={LOGO_TEAL_BASE64}
            alt="Groomee"
            width={56}
            height={56}
            className="mb-3 rounded-full"
          />
          <p className="text-sm text-gray-500">{getSubtitle()}</p>
        </div>

        <div className="glass-card p-6 shadow-xl">
          {/* ─── Step: Choose method ─── */}
          {step === "choose" && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setMethod("phone");
                  setStep("phone");
                  setError("");
                }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-brand-200 hover:bg-brand-50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-lg">
                  📱
                </span>
                <div>
                  <p className="font-semibold text-gray-900">
                    Continue with phone
                  </p>
                  <p className="text-xs text-gray-500">
                    Get a code via SMS or WhatsApp
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setMethod("email");
                  setStep("email");
                  setError("");
                }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-brand-200 hover:bg-brand-50"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg">
                  ✉️
                </span>
                <div>
                  <p className="font-semibold text-gray-900">
                    Continue with email
                  </p>
                  <p className="text-xs text-gray-500">
                    Get a code to your inbox
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* ─── Step: Phone input ─── */}
          {step === "phone" && (
            <form onSubmit={sendPhoneOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Phone number
                </label>
                <div className="flex gap-2">
                  <span className="flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-600">
                    🇳🇬 +234
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0801 234 5678"
                    className="input flex-1"
                    autoComplete="tel"
                    autoFocus
                    required
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-lg w-full"
              >
                {loading ? "Sending…" : "Send me a code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("choose");
                  setError("");
                }}
                className="btn-ghost btn-md w-full"
              >
                ← Other sign-in options
              </button>
            </form>
          )}

          {/* ─── Step: Email input ─── */}
          {step === "email" && (
            <form onSubmit={sendEmailOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="input"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-lg w-full"
              >
                {loading ? "Sending…" : "Send me a code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("choose");
                  setError("");
                }}
                className="btn-ghost btn-md w-full"
              >
                ← Other sign-in options
              </button>
            </form>
          )}

          {/* ─── Step: OTP verification ─── */}
          {step === "otp" && (
            <form
              onSubmit={method === "phone" ? verifyPhoneOtp : verifyEmailOtp}
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Enter your code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="input text-center text-xl sm:text-2xl font-mono tracking-wider sm:tracking-widest"
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Code sent to{" "}
                <strong>
                  {method === "phone" ? phone : email}
                </strong>
              </p>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="btn-primary btn-lg w-full"
              >
                {loading ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(method === "phone" ? "phone" : "email");
                  setOtp("");
                  setError("");
                }}
                className="btn-ghost btn-md w-full"
              >
                ← Change {method === "phone" ? "number" : "email"}
              </button>
              <button
                type="button"
                onClick={resendOtp}
                disabled={resendCooldown > 0}
                className="btn-ghost btn-md w-full"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
            </form>
          )}

          {/* ─── Step: Link phone (for email sign-ups) ─── */}
          {step === "link-phone" && (
            <form onSubmit={linkPhone} className="space-y-4">
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                📱 We need your phone number for booking confirmations,
                WhatsApp updates, and pro communication.
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Phone number
                </label>
                <div className="flex gap-2">
                  <span className="flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-600">
                    🇳🇬 +234
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (phoneCollision) setPhoneCollision(false);
                    }}
                    placeholder="0801 234 5678"
                    className="input flex-1"
                    autoComplete="tel"
                    autoFocus
                    required
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {phoneCollision ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={switchToPhoneSignIn}
                    disabled={loading}
                    className="btn-primary btn-lg w-full"
                  >
                    {loading ? "Sending…" : "Sign in with this phone instead"}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-ghost btn-md w-full"
                  >
                    Try a different number
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary btn-lg w-full"
                >
                  {loading ? "Linking…" : "Continue"}
                </button>
              )}
            </form>
          )}

          {/* ─── Step: Name ─── */}
          {step === "name" && (
            <form onSubmit={saveName} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Your name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Temi Adeyemi"
                  className="input"
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-lg w-full"
              >
                {loading ? "Saving…" : "Let's go! 🎉"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          By continuing, you agree to Groomee&apos;s Terms of Service and
          Privacy Policy.
        </p>
      </div>
    </div>
  );
}
