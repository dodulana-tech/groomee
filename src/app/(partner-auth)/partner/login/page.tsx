"use client";

import { Suspense, useState } from "react";
import { LOGO_TEAL_BASE64 } from "@/lib/logo";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatPhone, isValidNigerianPhone } from "@/lib/utils";

type Method = "phone" | "email";
type Step = "choose" | "input" | "otp";

export default function PartnerLoginPage() {
  return (
    <Suspense fallback={null}>
      <PartnerLoginContent />
    </Suspense>
  );
}

function PartnerLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/partner";

  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<Step>("choose");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (method === "phone" && !isValidNigerianPhone(phone)) {
      setError("Please enter a valid Nigerian phone number.");
      return;
    }
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const url =
        method === "phone"
          ? "/api/auth/send-otp"
          : "/api/auth/send-email-otp";
      const body =
        method === "phone"
          ? { phone: formatPhone(phone) }
          : { email };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send code");
      setStep("otp");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url =
        method === "phone"
          ? "/api/auth/verify-otp"
          : "/api/auth/verify-email-otp";
      const body =
        method === "phone"
          ? { phone: formatPhone(phone), otp }
          : { email, otp };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      if (data.data?.role !== "PRO" && data.data?.role !== "ADMIN") {
        throw new Error(
          "Looks like you don't have a partner account yet. Apply to join and start earning!"
        );
      }
      router.push(redirect);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.08)",
    border: "1.5px solid rgba(255,255,255,0.12)",
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #014342 0%, #0D1B12 100%)" }}
    >
      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <img
          src={LOGO_TEAL_BASE64}
          alt="Groomee"
          width={40}
          height={40}
          className="rounded-full"
        />
        <span
          className="text-xl font-black tracking-tight text-white"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          Groomee<span style={{ color: "#53eb64" }}>.</span>
        </span>
      </Link>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-3xl p-8"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="mb-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
            style={{
              background: "rgba(83,235,100,0.15)",
              color: "#53eb64",
              border: "1px solid rgba(83,235,100,0.3)",
            }}
          >
            Partner Portal
          </div>
          <h1
            className="text-2xl font-black text-white mb-1"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            {step === "otp" ? "Enter your code" : "Partner sign in"}
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            {step === "choose"
              ? "Sign in to manage your bookings & earnings"
              : step === "input"
                ? method === "phone"
                  ? "Enter your registered phone number"
                  : "Enter your registered email"
                : `Enter the code sent to ${method === "phone" ? phone : email}`}
          </p>
        </div>

        {/* Choose method */}
        {step === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => {
                setMethod("phone");
                setStep("input");
              }}
              className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-all hover:bg-white/10"
              style={{ ...inputStyle }}
            >
              <span className="text-xl">📱</span>
              <div>
                <p className="text-sm font-bold text-white">Phone number</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Get a code via SMS
                </p>
              </div>
            </button>
            <button
              onClick={() => {
                setMethod("email");
                setStep("input");
              }}
              className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-all hover:bg-white/10"
              style={{ ...inputStyle }}
            >
              <span className="text-xl">✉️</span>
              <div>
                <p className="text-sm font-bold text-white">Email</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Get a code to your inbox
                </p>
              </div>
            </button>

            {/* Apply CTA */}
            <div
              className="mt-4 rounded-xl p-4 text-center"
              style={{
                background: "rgba(83,235,100,0.08)",
                border: "1px solid rgba(83,235,100,0.15)",
              }}
            >
              <p className="text-xs text-white/50 mb-2">
                Not a partner yet?
              </p>
              <Link
                href="/partner/onboarding"
                className="text-sm font-bold transition-colors"
                style={{ color: "#53eb64" }}
              >
                Apply to join Groomee →
              </Link>
            </div>
          </div>
        )}

        {/* Input step */}
        {step === "input" && (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {method === "phone" ? "Phone number" : "Email address"}
              </label>
              {method === "phone" ? (
                <input
                  type="tel"
                  className="w-full rounded-xl px-4 py-3 text-white text-sm font-medium outline-none transition-all"
                  style={inputStyle}
                  placeholder="+234 801 234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                  onFocus={(e) => (e.target.style.borderColor = "#53eb64")}
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.12)")
                  }
                />
              ) : (
                <input
                  type="email"
                  className="w-full rounded-xl px-4 py-3 text-white text-sm font-medium outline-none transition-all"
                  style={inputStyle}
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  onFocus={(e) => (e.target.style.borderColor = "#53eb64")}
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.12)")
                  }
                />
              )}
            </div>
            {error && (
              <p className="text-sm font-medium" style={{ color: "#FF4D2E" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "#53eb64",
                color: "#014342",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Sending..." : "Send verification code →"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("choose");
                setError("");
              }}
              className="w-full text-xs py-2"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              ← Other sign-in options
            </button>
          </form>
        )}

        {/* OTP step */}
        {step === "otp" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setStep("input");
                setOtp("");
                setError("");
              }}
              className="text-xs font-medium mb-2 flex items-center gap-1"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              ← Change {method === "phone" ? "number" : "email"}
            </button>
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="w-full rounded-xl px-4 py-3 text-white text-xl font-bold tracking-[0.3em] sm:tracking-[0.5em] text-center outline-none"
                style={inputStyle}
                placeholder="· · · · · ·"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                autoFocus
                onFocus={(e) => (e.target.style.borderColor = "#53eb64")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.12)")
                }
              />
            </div>
            {error && (
              <p className="text-sm font-medium" style={{ color: "#FF4D2E" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "#53eb64",
                color: "#014342",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Verifying..." : "Access dashboard →"}
            </button>
          </form>
        )}
      </div>

      <Link
        href="/auth"
        className="mt-6 text-xs"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        ← Back to customer login
      </Link>
    </div>
  );
}
