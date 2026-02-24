"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatNaira, isValidNigerianPhone, formatPhone } from "@/lib/utils";

const GIFT_AMOUNTS = [10000, 15000, 20000, 30000, 50000];

export default function GiftPage() {
  const router = useRouter();
  const [step, setStep] = useState<"compose" | "pay">("compose");
  const [form, setForm] = useState({
    recipientPhone: "",
    recipientName: "",
    message: "",
    amount: 15000,
    customAmount: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const finalAmount = form.customAmount
    ? (parseInt(form.customAmount) * 100) / 100
    : form.amount;

  async function handleSend() {
    setError("");
    if (!isValidNigerianPhone(form.recipientPhone)) {
      setError("Please enter a valid Nigerian phone number.");
      return;
    }
    if (finalAmount < 5000) {
      setError("Minimum gift amount is ₦5,000.");
      return;
    }
    if (!form.recipientName.trim()) {
      setError("Please enter the recipient's name.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientPhone: formatPhone(form.recipientPhone),
          recipientName: form.recipientName,
          message: form.message,
          amount: finalAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth?redirect=/gift");
          return;
        }
        setError(data.error ?? "Failed.");
        return;
      }
      window.location.href = data.data.authorizationUrl;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gradient-to-br from-pink-500 to-accent py-12 text-center text-white">
        <p className="text-4xl mb-2">🎁</p>
        <h1 className="font-display text-4xl font-black">Gift a Glow-up</h1>
        <p className="mt-3 text-white/80">
          Send a professional grooming session to someone special.
        </p>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="card p-6 space-y-5">
          {/* Recipient */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Recipient's name *
            </label>
            <input
              value={form.recipientName}
              onChange={(e) =>
                setForm((f) => ({ ...f, recipientName: e.target.value }))
              }
              placeholder="e.g. Bola Adeyemi"
              className="input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Their WhatsApp number *
            </label>
            <input
              type="tel"
              value={form.recipientPhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, recipientPhone: e.target.value }))
              }
              placeholder="0801 234 5678"
              className="input"
            />
            <p className="mt-1 text-xs text-gray-400">
              We'll send the gift code via WhatsApp.
            </p>
          </div>

          {/* Gift message */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Personal message (optional)
            </label>
            <textarea
              value={form.message}
              onChange={(e) =>
                setForm((f) => ({ ...f, message: e.target.value }))
              }
              placeholder="Treat yourself! Happy birthday! 🎂"
              className="input resize-none"
              rows={2}
              maxLength={300}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Gift amount *
            </label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {GIFT_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, amount: amt, customAmount: "" }))
                  }
                  className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                    form.amount === amt && !form.customAmount
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {formatNaira(amt)}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, customAmount: "20000" }))
                }
                className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-all col-span-1 ${
                  form.customAmount
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                Custom
              </button>
            </div>
            {form.customAmount !== "" && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">₦</span>
                <input
                  type="number"
                  value={form.customAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customAmount: e.target.value }))
                  }
                  placeholder="Enter amount"
                  className="input flex-1"
                  min={5000}
                />
              </div>
            )}
          </div>

          {/* Preview */}
          {form.recipientName && (
            <div className="rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-pink-500 mb-2">
                Gift preview
              </p>
              <p className="text-sm text-gray-700">
                🎁 <strong>{form.recipientName}</strong> will receive a{" "}
                <strong>{formatNaira(finalAmount)}</strong> Groomee gift card
                via WhatsApp.
                {form.message && ` Your message: "${form.message}"`}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Valid for 6 months. Can be used on any service.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            onClick={handleSend}
            disabled={loading}
            className="btn-accent btn-lg w-full"
          >
            {loading
              ? "Processing…"
              : `🎁 Send Gift — ${formatNaira(finalAmount)}`}
          </button>

          <p className="text-center text-xs text-gray-400">
            Secure payment via Paystack · Gift valid 6 months · No refunds after
            sending
          </p>
        </div>
      </div>
    </div>
  );
}
