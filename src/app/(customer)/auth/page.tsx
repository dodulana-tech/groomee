"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPhone, isValidNigerianPhone } from "@/lib/utils";

type Step = "phone" | "otp" | "name";

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

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp(e: React.FormEvent) {
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
      setError("Failed to send code. Try again.");
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
        body: JSON.stringify({ phone: formatPhone(phone), otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      if (data.data.isNewUser) {
        setIsNewUser(true);
        setStep("name");
      } else {
        router.push(redirect);
        router.refresh();
      }
    } catch {
      setError("Verification failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold text-brand-600">
            Groomee
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {step === "phone" && "Enter your phone number to continue"}
            {step === "otp" && `Enter the 6-digit code sent to ${phone}`}
            {step === "name" && "Almost there! What should we call you?"}
          </p>
        </div>

        <div className="card p-6 shadow-md">
          {/* Phone step */}
          {step === "phone" && (
            <form onSubmit={sendOtp} className="space-y-4">
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
                {loading ? "Sending…" : "Send verification code"}
              </button>
            </form>
          )}

          {/* OTP step */}
          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="input text-center text-2xl font-mono tracking-widest"
                  maxLength={6}
                  required
                />
              </div>
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
                  setStep("phone");
                  setOtp("");
                  setError("");
                }}
                className="btn-ghost btn-md w-full"
              >
                ← Change number
              </button>
            </form>
          )}

          {/* Name step */}
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
          By continuing, you agree to Groomee's Terms of Service and Privacy
          Policy.
        </p>
      </div>
    </div>
  );
}
