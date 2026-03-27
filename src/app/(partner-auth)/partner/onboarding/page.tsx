"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOGO_TEAL_BASE64 } from "@/lib/logo";

type Step = "info" | "services" | "zones" | "pricing" | "bank" | "terms";

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: "info", label: "About you", icon: "👤" },
  { key: "services", label: "Services", icon: "✂️" },
  { key: "zones", label: "Zones", icon: "📍" },
  { key: "pricing", label: "Pricing", icon: "💰" },
  { key: "bank", label: "Bank", icon: "🏦" },
  { key: "terms", label: "Terms", icon: "📋" },
];

const SERVICE_OPTIONS = [
  { id: "HAIR", label: "Hair styling", emoji: "💇🏿‍♀️", desc: "Braids, weaves, natural styles" },
  { id: "MAKEUP", label: "Makeup", emoji: "💄", desc: "Full glam, soft glam, bridal" },
  { id: "NAILS", label: "Nails", emoji: "💅🏿", desc: "Gel, acrylic, extensions, mani-pedi" },
  { id: "LASHES", label: "Lashes", emoji: "👁️", desc: "Classic, volume, mega-volume" },
  { id: "BARBING", label: "Barbing", emoji: "✂️", desc: "Fades, cuts, shape-ups, beard" },
  { id: "SKINCARE", label: "Skincare", emoji: "✨", desc: "Facials, treatments, glow packages" },
];

const ZONE_OPTIONS = [
  "Lekki Phase 1",
  "Victoria Island",
  "Ikoyi",
  "Ikeja",
  "Surulere",
  "Yaba",
  "Gbagada",
  "Ajah",
  "Magodo",
  "Maryland",
];

export default function PartnerOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const currentIndex = STEPS.findIndex((s) => s.key === step);
  const pct = ((currentIndex + 1) / STEPS.length) * 100;

  function next() {
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1].key);
    }
  }

  function prev() {
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1].key);
    }
  }

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function toggleZone(z: string) {
    setSelectedZones((prev) =>
      prev.includes(z) ? prev.filter((s) => s !== z) : [...prev, z],
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/partner/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          bio,
          services: selectedServices,
          zones: selectedZones,
          bankName,
          bankAccount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-cream-50">
        <div className="max-w-md text-center">
          <div className="mb-4">
            <img
              src={LOGO_TEAL_BASE64}
              alt="Groomee"
              width={64}
              height={64}
              className="rounded-full mx-auto"
            />
          </div>
          <h1 className="font-display text-3xl font-bold text-gray-900 mb-3">
            Application submitted! 🎉
          </h1>
          <p className="text-base text-gray-500 mb-6">
            Our team will review your application and get back to you within
            24-48 hours. You&apos;ll receive a WhatsApp message when you&apos;re
            approved.
          </p>
          <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg mb-6">
            <h3 className="font-bold text-gray-900 mb-3">What happens next?</h3>
            <div className="space-y-3 text-sm text-left">
              <div className="flex items-start gap-3">
                <span className="text-lg">1️⃣</span>
                <p className="text-gray-600">We review your application and verify your details</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">2️⃣</span>
                <p className="text-gray-600">You receive a welcome WhatsApp from Groomee</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">3️⃣</span>
                <p className="text-gray-600">You go online and start receiving bookings!</p>
              </div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-800 to-brand-400 text-white font-mono text-sm font-medium px-5 py-2.5 rounded-full shadow-lg mb-4">
            ⭐ +10 Groomee Points earned
          </div>
          <br />
          <button
            onClick={() => router.push("/")}
            className="btn-ghost btn-md mt-2"
          >
            ← Back to Groomee
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src={LOGO_TEAL_BASE64}
            alt="Groomee"
            width={48}
            height={48}
            className="rounded-full mx-auto mb-4"
          />
          <h1 className="font-display text-2xl font-bold text-gray-900">
            Join Groomee as a beauty professional
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Set up your profile in 2 minutes. Start earning immediately.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`flex items-center gap-1 text-xs font-semibold ${
                  i <= currentIndex ? "text-brand-700" : "text-gray-400"
                }`}
              >
                <span
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                    i < currentIndex
                      ? "bg-brand-600 text-white"
                      : i === currentIndex
                        ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500"
                        : "bg-gray-100"
                  }`}
                >
                  {i < currentIndex ? "✓" : s.icon}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Form card */}
        <div className="glass rounded-2xl border border-white/20 p-6 sm:p-8 shadow-xl">
          {/* Step: Info */}
          {step === "info" && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-gray-900">
                Tell us about yourself
              </h2>
              <div>
                <label className="input-label mb-1">Full name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Your professional name" required />
              </div>
              <div>
                <label className="input-label mb-1">Phone number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="0801 234 5678" required />
              </div>
              <div>
                <label className="input-label mb-1">Email (optional)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@email.com" />
              </div>
              <div>
                <label className="input-label mb-1">Bio / About you</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input resize-none min-h-[80px]" placeholder="Tell customers about your experience and specialties…" />
              </div>
            </div>
          )}

          {/* Step: Services */}
          {step === "services" && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-gray-900">
                What services do you offer?
              </h2>
              <p className="text-sm text-gray-500">Select all that apply.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SERVICE_OPTIONS.map((svc) => {
                  const selected = selectedServices.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      onClick={() => toggleService(svc.id)}
                      className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                        selected
                          ? "border-brand-500 bg-brand-50 shadow-sm"
                          : "border-gray-100 glass-card hover:border-gray-200"
                      }`}
                    >
                      <span className="text-2xl">{svc.emoji}</span>
                      <div>
                        <p className="font-semibold text-gray-900">{svc.label}</p>
                        <p className="text-xs text-gray-500">{svc.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step: Zones */}
          {step === "zones" && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-gray-900">
                Where do you operate?
              </h2>
              <p className="text-sm text-gray-500">Select the areas you can cover.</p>
              <div className="flex flex-wrap gap-2">
                {ZONE_OPTIONS.map((z) => {
                  const selected = selectedZones.includes(z);
                  return (
                    <button
                      key={z}
                      onClick={() => toggleZone(z)}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-all ${
                        selected
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-gray-200 glass-card text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      📍 {z}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step: Pricing */}
          {step === "pricing" && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-gray-900">
                Pricing
              </h2>
              <p className="text-sm text-gray-500">
                Groomee uses standardized pricing frameworks to ensure fair,
                transparent rates. You can set custom prices for your services
                after onboarding.
              </p>
              <div className="rounded-xl bg-brand-50 border border-brand-200 p-4">
                <h3 className="font-semibold text-brand-800 mb-2">How pricing works</h3>
                <ul className="space-y-2 text-sm text-brand-700">
                  <li>• Base prices are set per service category</li>
                  <li>• You keep 80% of each booking (platform takes 20%)</li>
                  <li>• Urgency fees: you get 70%, platform gets 30%</li>
                  <li>• Pro and Elite tiers earn higher splits</li>
                  <li>• No hidden fees. Ever.</li>
                </ul>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-800">
                  💡 <strong>Tip:</strong> You can customize your prices after
                  onboarding. The admin team will help you set competitive rates
                  for your area.
                </p>
              </div>
            </div>
          )}

          {/* Step: Bank */}
          {step === "bank" && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-gray-900">
                Bank details
              </h2>
              <p className="text-sm text-gray-500">
                We pay you directly to your bank account. Payouts are processed
                weekly on Fridays.
              </p>
              <div>
                <label className="input-label mb-1">Bank name</label>
                <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="input" placeholder="e.g. GTBank" />
              </div>
              <div>
                <label className="input-label mb-1">Account number</label>
                <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="input" placeholder="10-digit account number" maxLength={10} />
              </div>
              <p className="text-xs text-gray-400">
                🔒 Your bank details are encrypted and only used for payouts.
              </p>
            </div>
          )}

          {/* Step: Terms */}
          {step === "terms" && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-bold text-gray-900">
                Almost there!
              </h2>
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 space-y-3 max-h-48 overflow-y-auto">
                <p><strong>Groomee Partner Agreement</strong></p>
                <p>By joining Groomee as a beauty professional, you agree to:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Maintain professional standards of service</li>
                  <li>Arrive on time for all accepted bookings</li>
                  <li>Treat all customers with respect and dignity</li>
                  <li>Keep your availability status accurate</li>
                  <li>Accept the platform&apos;s commission structure</li>
                  <li>Submit to ID verification before first booking</li>
                  <li>Follow the cancellation and dispute policies</li>
                </ul>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-brand-600"
                />
                <span className="text-sm text-gray-700">
                  I agree to Groomee&apos;s Partner Terms of Service
                </span>
              </label>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-3 text-sm font-medium text-red-500">{error}</p>
          )}

          {/* Navigation */}
          <div className="mt-6 flex gap-3">
            {currentIndex > 0 && (
              <button onClick={prev} className="btn-ghost btn-md">
                ← Back
              </button>
            )}
            {step === "terms" ? (
              <button
                onClick={handleSubmit}
                disabled={loading || !agreedTerms}
                className="btn-primary btn-lg flex-1"
              >
                {loading ? "Submitting…" : "Submit application →"}
              </button>
            ) : (
              <button onClick={next} className="btn-primary btn-lg flex-1">
                Next →
              </button>
            )}
          </div>
        </div>

        {/* Value prop reminder */}
        <div className="mt-6 text-center text-xs text-gray-400">
          💰 Predictable income · 📊 Free business tools · 📈 Professional growth · 🛡️ Protection
        </div>
      </div>
    </div>
  );
}
