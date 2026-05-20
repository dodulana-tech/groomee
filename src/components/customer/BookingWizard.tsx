"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  slug: string;
  category: string;
  basePrice: number;
  durationMins: number;
}

interface Zone {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  proId: string;
  proName: string;
  services: Service[];
  zones: Zone[];
  preSelectedService?: string;
}

type Step = "service" | "datetime" | "location" | "notes" | "confirm";

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: "service", label: "Service", icon: "✂️" },
  { key: "datetime", label: "When", icon: "📅" },
  { key: "location", label: "Where", icon: "📍" },
  { key: "notes", label: "Notes", icon: "📝" },
  { key: "confirm", label: "Confirm", icon: "💳" },
];

export default function BookingWizard({
  proId,
  proName,
  services,
  zones,
  preSelectedService,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState(preSelectedService ?? "");
  const [isAsap, setIsAsap] = useState(true);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [address, setAddress] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [notes, setNotes] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);

  const POINTS_THRESHOLD = 100;
  const POINTS_DISCOUNT = 500;

  const selectedService = services.find((s) => s.id === serviceId);
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  function canProceed(): boolean {
    switch (step) {
      case "service":
        return !!serviceId;
      case "datetime":
        return isAsap || (!!scheduledDate && !!scheduledTime);
      case "location":
        return !!address && !!zoneId;
      case "notes":
        return true;
      default:
        return false;
    }
  }

  async function nextStep() {
    const idx = currentStepIndex;
    if (idx < STEPS.length - 1) {
      const next = STEPS[idx + 1].key;
      if (next === "confirm") {
        await loadPreview();
      }
      setStep(next);
    }
  }

  function prevStep() {
    const idx = currentStepIndex;
    if (idx > 0) setStep(STEPS[idx - 1].key);
  }

  async function loadPreview() {
    try {
      const [previewRes, pointsRes] = await Promise.all([
        fetch("/api/payments/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            isAsap,
            scheduledFor: isAsap
              ? undefined
              : `${scheduledDate}T${scheduledTime}:00`,
          }),
        }),
        fetch("/api/profile/points"),
      ]);
      const previewData = await previewRes.json();
      if (previewData.success) setPreview(previewData.data);
      if (pointsRes.ok) {
        const pointsData = await pointsRes.json();
        setPointsBalance(pointsData.points ?? pointsData.data?.points ?? 0);
      }
    } catch {
      /* ignore */
    }
  }

  async function handleBook() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          address,
          zoneId,
          isAsap,
          scheduledFor: isAsap
            ? undefined
            : `${scheduledDate}T${scheduledTime}:00`,
          customerNotes: notes || undefined,
          redeemPoints: redeemPoints || undefined,
          giftCode: giftCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong — please try again");
        return;
      }
      // Redirect to payment or booking detail
      if (data.data?.authorizationUrl) {
        window.location.href = data.data.authorizationUrl;
      } else {
        router.push(`/booking/${data.data.id}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-2xl border border-white/20 shadow-xl overflow-hidden">
      {/* Progress bar */}
      <div className="bg-brand-600/5 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`flex items-center gap-1.5 text-xs font-semibold ${
                i <= currentStepIndex
                  ? "text-brand-700"
                  : "text-gray-400"
              }`}
            >
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                  i < currentStepIndex
                    ? "bg-brand-600 text-white"
                    : i === currentStepIndex
                      ? "bg-brand-100 text-brand-700 ring-2 ring-brand-500"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < currentStepIndex ? "✓" : s.icon}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
              {i < STEPS.length - 1 && (
                <div
                  className={`hidden sm:block w-8 h-px mx-1 ${
                    i < currentStepIndex ? "bg-brand-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300"
            style={{
              width: `${((currentStepIndex + 1) / STEPS.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="p-6">
        {/* Step: Service */}
        {step === "service" && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-gray-900">
              Choose a service
            </h3>
            <p className="text-sm text-gray-500">
              What would you like {proName.split(" ")[0]} to do?
            </p>
            <div className="grid gap-2">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => setServiceId(svc.id)}
                  className={`flex items-center justify-between rounded-xl border-2 p-4 text-left transition-all ${
                    serviceId === svc.id
                      ? "border-brand-500 bg-brand-50 shadow-sm"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-900">{svc.name}</p>
                    <p className="text-xs text-gray-500">
                      ~{svc.durationMins} mins
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-brand-700">
                    {formatNaira(svc.basePrice)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Date/Time */}
        {step === "datetime" && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-gray-900">
              When do you need this?
            </h3>
            <button
              onClick={() => setIsAsap(true)}
              className={`w-full flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                isAsap
                  ? "border-accent bg-accent-50 shadow-sm"
                  : "border-gray-200 hover:border-accent/30"
              }`}
            >
              <span className="text-2xl">⚡</span>
              <div>
                <p className="text-sm font-bold text-orange-600">
                  As soon as possible
                </p>
                <p className="text-xs text-gray-500">
                  Pro arrives within 45 minutes
                </p>
              </div>
            </button>
            <button
              onClick={() => setIsAsap(false)}
              className={`w-full flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                !isAsap
                  ? "border-brand-500 bg-brand-50 shadow-sm"
                  : "border-gray-200 hover:border-brand-200"
              }`}
            >
              <span className="text-2xl">📅</span>
              <div>
                <p className="text-sm font-bold text-brand-700">
                  Schedule for later
                </p>
                <p className="text-xs text-gray-500">Pick a date and time</p>
              </div>
            </button>
            {!isAsap && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="input-label mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="input"
                  />
                </div>
                <div>
                  <label className="input-label mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Location */}
        {step === "location" && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-gray-900">
              Where should the pro come?
            </h3>
            <div>
              <label className="input-label mb-1">Area / Zone</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="input"
                required
              >
                <option value="">Select your area</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label mb-1">Full address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 15 Admiralty Way, Lekki Phase 1"
                className="input min-h-[80px] resize-none"
                required
              />
            </div>
          </div>
        )}

        {/* Step: Notes */}
        {step === "notes" && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-gray-900">
              Any notes for {proName.split(" ")[0]}?
            </h3>
            <p className="text-sm text-gray-500">
              Optional - share any preferences, allergies, or style references.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. I want a natural look, I have sensitive skin…"
              className="input min-h-[120px] resize-none"
            />
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-gray-900">
              Confirm your booking
            </h3>
            <div className="space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Service</span>
                <span className="font-semibold text-gray-900">
                  {selectedService?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">When</span>
                <span className="font-semibold text-gray-900">
                  {isAsap ? "⚡ ASAP" : `${scheduledDate} at ${scheduledTime}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Where</span>
                <span className="font-semibold text-gray-900 text-right max-w-[200px] truncate">
                  {address}
                </span>
              </div>
              {preview && (
                <>
                  <hr className="border-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-gray-500" title="Standard price for this service">Base price</span>
                    <span>{formatNaira(preview.baseAmount)}</span>
                  </div>
                  {preview.surchargeAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500" title="Additional fee for emergency/ASAP bookings">
                        {preview.surchargeLabel ?? "Surcharge"}
                      </span>
                      <span>{formatNaira(preview.surchargeAmount)}</span>
                    </div>
                  )}
                  {redeemPoints && (
                    <div className="flex justify-between text-green-600">
                      <span>✨ Points discount</span>
                      <span>-{formatNaira(POINTS_DISCOUNT)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-brand-700">
                      {formatNaira(
                        Math.max(0, preview.totalAmount - (redeemPoints ? POINTS_DISCOUNT : 0))
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Points redemption */}
            {pointsBalance !== null && pointsBalance >= POINTS_THRESHOLD && (
              <label className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-brand-200 bg-brand-50 p-3 transition-all hover:border-brand-400">
                <input
                  type="checkbox"
                  checked={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-600"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-800">
                    ✨ Redeem 100 points for ₦500 off
                  </p>
                  <p className="text-xs text-brand-600">
                    You have {pointsBalance} points available
                  </p>
                </div>
              </label>
            )}

            {/* Gift card code */}
            <div>
              <label className="input-label mb-1">Gift card code (optional)</label>
              <input
                type="text"
                value={giftCode}
                onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
                placeholder="e.g. GIFT-XXXX-XXXX"
                className="input font-mono tracking-wider"
              />
            </div>

            <p className="text-xs text-gray-400 text-center">
              🛡️ Payment secured by Paystack · Funds held until service is
              confirmed
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="mt-3 text-sm font-medium text-red-500">{error}</p>
        )}

        {/* Navigation */}
        <div className="mt-6 flex gap-3">
          {currentStepIndex > 0 && (
            <button onClick={prevStep} className="btn-ghost btn-md">
              ← Back
            </button>
          )}
          {step !== "confirm" ? (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="btn-primary btn-lg flex-1"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleBook}
              disabled={loading}
              className="btn-primary btn-lg flex-1"
            >
              {loading ? "Processing…" : "💳 Pay & Book"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
