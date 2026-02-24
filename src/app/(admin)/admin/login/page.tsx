"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send OTP");
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
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      if (data.role !== "ADMIN") {
        throw new Error("You do not have admin access.");
      }
      router.push("/admin");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#0D1B12" }}
    >
      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base border border-white/20"
          style={{
            fontFamily: "Georgia, serif",
            color: "#D4A853",
            background: "rgba(255,255,255,0.08)",
          }}
        >
          G
        </div>
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
            {step === "phone" ? "Admin sign in" : "Verify identity"}
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            {step === "phone"
              ? "Enter your registered admin phone number"
              : `Enter the code sent to ${phone}`}
          </p>
        </div>

        {step === "phone" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-2"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Phone number
              </label>
              <input
                type="tel"
                className="w-full rounded-xl px-4 py-3 text-white text-sm font-medium outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                }}
                placeholder="+234 801 234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
              {loading ? "Sending…" : "Send verification code →"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="text-xs font-medium mb-2 flex items-center gap-1"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              ← Change number
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
                className="w-full rounded-xl px-4 py-3 text-white text-xl font-bold tracking-[0.5em] text-center outline-none"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                }}
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
