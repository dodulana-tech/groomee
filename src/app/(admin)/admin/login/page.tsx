"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Method = "phone" | "email";
type Step = "choose" | "input" | "otp";

export default function AdminLoginPage() {
  const router = useRouter();
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
    setLoading(true);
    try {
      const url =
        method === "phone"
          ? "/api/auth/send-otp"
          : "/api/auth/send-email-otp";
      const body =
        method === "phone" ? { phone } : { email };
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
        method === "phone" ? { phone, otp } : { email, otp };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      if (data.data?.role !== "ADMIN") {
        throw new Error("You do not have admin access.");
      }
      router.push("/admin");
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
      style={{ background: "#0D1B12" }}
    >
      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <Image
          src="/assets/logo/groomee-logo-teal.jpg"
          alt="Groomee"
          width={40}
          height={40}
          className="rounded-full"
          priority
        />
        <span
          className="text-xl font-black tracking-tight text-white"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          Groomee<span style={{ color: "#D4A853" }}>.</span>
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
              background: "rgba(212,168,83,0.15)",
              color: "#D4A853",
              border: "1px solid rgba(212,168,83,0.3)",
            }}
          >
            ⚙️ Admin Portal
          </div>
          <h1
            className="text-2xl font-black text-white mb-1"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            {step === "choose"
              ? "Admin sign in"
              : step === "input"
                ? "Admin sign in"
                : "Verify identity"}
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            {step === "choose"
              ? "Choose how to sign in"
              : step === "input"
                ? method === "phone"
                  ? "Enter your registered admin phone number"
                  : "Enter your registered admin email"
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
              className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-all"
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
              className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-all"
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
                  onFocus={(e) => (e.target.style.borderColor = "#D4A853")}
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.12)")
                  }
                />
              ) : (
                <input
                  type="email"
                  className="w-full rounded-xl px-4 py-3 text-white text-sm font-medium outline-none transition-all"
                  style={inputStyle}
                  placeholder="admin@groomee.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  onFocus={(e) => (e.target.style.borderColor = "#D4A853")}
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
                background: "#D4A853",
                color: "#0D1B12",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Sending…" : "Send verification code →"}
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
                onFocus={(e) => (e.target.style.borderColor = "#D4A853")}
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
                background: "#D4A853",
                color: "#0D1B12",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Verifying…" : "Access dashboard →"}
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
