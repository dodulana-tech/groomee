"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";
import type { Service, Zone } from "@/types";

function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00+01:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return new Date(d.getTime() + 60 * 60_000).toISOString().slice(0, 10);
}
function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

interface ProServiceItem {
  service: Service;
  customPrice: number | null;
}

interface Props {
  pro: {
    id: string;
    name: string;
    availability: string;
    commissionRate: number;
    // ─── Apprenticeship gating (Slice 5) ───
    // When false, the apprentice has not earned independence yet — booking is
    // disabled here and the customer is sent to the master's profile instead.
    canTakeIndependent?: boolean;
    parent?: { id: string; name: string; slug?: string | null } | null;
    relationship?: "INDEPENDENT" | "APPRENTICE" | "STAFF";
  };
  preSelectedService?: Service;
  proServices: ProServiceItem[];
  zones: Zone[];
}

export default function BookingPanel({
  pro,
  preSelectedService,
  proServices,
  zones,
}: Props) {
  const router = useRouter();
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    preSelectedService?.id ?? "",
  );
  const [isAsap, setIsAsap] = useState(true);
  const [scheduledFor, setScheduledFor] = useState("");
  const [slotDate, setSlotDate] = useState<string>(nextDay(todayYmd()));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedGs = proServices.find(
    (gs) => gs.service.id === selectedServiceId,
  );
  const selectedService = selectedGs?.service;
  const price = selectedGs
    ? (selectedGs.customPrice ?? selectedGs.service.basePrice)
    : 0;

  // Calculate surcharge based on booking time, not current time
  const bookingHour = isAsap
    ? new Date().getHours()
    : scheduledFor
      ? new Date(scheduledFor).getHours()
      : new Date().getHours();
  const isLateNight = bookingHour >= 22 || bookingHour < 5;
  const isEarlyMorning = bookingHour >= 5 && bookingHour < 7;

  let surchargeRate = 0;
  let surchargeLabel = "";
  if (isLateNight) {
    surchargeRate = 0.25;
    surchargeLabel = "Late night fee (+25%)";
  } else if (isEarlyMorning) {
    surchargeRate = 0.2;
    surchargeLabel = "Early morning fee (+20%)";
  } else if (isAsap) {
    surchargeRate = 0.2;
    surchargeLabel = "Emergency fee (+20%)";
  }

  const surchargeAmt = Math.round(price * surchargeRate);
  const total = price + surchargeAmt;

  // Fetch real availability whenever the customer is in Schedule mode and we
  // know what service / day. Slots respect the pro's working hours, existing
  // bookings, and travel buffers from the customer's zone.
  useEffect(() => {
    if (isAsap || !selectedServiceId) {
      setSlots(null);
      setScheduledFor("");
      return;
    }
    const controller = new AbortController();
    setSlotsLoading(true);
    const qs = new URLSearchParams({
      date: `${slotDate}T12:00:00.000Z`,
      serviceId: selectedServiceId,
      ...(zoneId ? { zoneId } : {}),
    });
    fetch(`/api/pros/${pro.id}/availability?${qs.toString()}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("avail-fetch-failed");
        return r.json();
      })
      .then((d) => {
        setSlots(d.data?.slots ?? []);
        // Clear stale selection if it's no longer in the list.
        if (scheduledFor && !d.data?.slots?.includes(scheduledFor)) {
          setScheduledFor("");
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setSlots([]);
      })
      .finally(() => setSlotsLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAsap, selectedServiceId, slotDate, zoneId, pro.id]);

  async function handleBook() {
    if (!selectedServiceId) {
      setError("Please select a service.");
      return;
    }
    if (!address.trim()) {
      setError("Please enter your address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (!isAsap && !scheduledFor) {
        setError("Please pick a time slot.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedServiceId,
          proId: pro.id,
          address,
          zoneId: zoneId || undefined,
          isAsap,
          scheduledFor: isAsap ? undefined : scheduledFor || undefined,
          customerNotes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(
            "/auth?redirect=" + encodeURIComponent(window.location.pathname),
          );
          return;
        }
        setError(data.error ?? "Failed to create booking.");
        return;
      }
      if (data.data?.authorizationUrl) {
        window.location.href = data.data.authorizationUrl;
      } else {
        router.push(`/booking/${data.data?.id}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Apprentice not yet cleared for independent bookings — route customers to
  // their master, who can deploy the apprentice on this job. We hide pricing
  // and the booking form entirely; the master's profile handles the booking.
  if (pro.canTakeIndependent === false && pro.parent) {
    const masterHref = `/pro/${pro.parent.slug ?? pro.parent.id}`;
    return (
      <div className="card shadow-lg overflow-hidden">
        <div
          className="px-5 py-4 border-b border-gray-100"
          style={{ background: "#FFFBEB" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "#FEF3C7", color: "#92400E" }}
            >
              🎓 Apprentice
            </span>
            <h3 className="font-bold text-gray-900 text-sm">
              Available via master
            </h3>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            <span className="font-semibold">{pro.name.split(" ")[0]}</span> is
            still in training under{" "}
            <span className="font-semibold">{pro.parent.name}</span> and isn't
            taking independent bookings yet. Book{" "}
            <span className="font-semibold">{pro.parent.name}</span> instead —
            they may deploy {pro.name.split(" ")[0]} for your job.
          </p>
          <Link
            href={masterHref}
            className="btn-primary btn-lg w-full text-center inline-flex items-center justify-center"
          >
            Book this pro via {pro.parent.name} →
          </Link>
          <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 text-center">
            <span>🛡️</span>
            Apprentice work is signed off by the master
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">
            Book {pro.name.split(" ")[0]}
          </h3>
          {pro.availability === "ONLINE" ? (
            <span className="pill pill-green">
              <span
                className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brand-500"
                style={{ background: "none" }}
              />
              Online now
            </span>
          ) : (
            <span className="pill pill-gray">Unavailable</span>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Service selector */}
        <div>
          <label className="input-label">Select service</label>
          <div className="space-y-2">
            {proServices.map((gs) => {
              const p = gs.customPrice ?? gs.service.basePrice;
              const isSelected = selectedServiceId === gs.service.id;
              return (
                <button
                  key={gs.service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(gs.service.id)}
                  className={`w-full flex items-center justify-between gap-3 rounded-2xl border-2 p-3 text-left transition-all ${
                    isSelected
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-100 bg-white hover:border-gray-200"
                  }`}
                >
                  <div>
                    <p
                      className={`font-semibold text-sm ${isSelected ? "text-brand-700" : "text-gray-800"}`}
                    >
                      {gs.service.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      ~{gs.service.durationMins} mins
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`font-bold ${isSelected ? "text-brand-700" : "text-gray-900"}`}
                    >
                      {formatNaira(p)}
                    </p>
                    {isSelected && (
                      <p className="text-[10px] text-brand-500">Selected ✓</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time */}
        <div>
          <label className="input-label">When?</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsAsap(true)}
              className={`rounded-2xl border-2 p-3 text-center transition-all ${
                isAsap
                  ? "border-accent bg-orange-50"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <div className="text-xl mb-1">⚡</div>
              <div
                className={`text-xs font-bold ${isAsap ? "text-accent" : "text-gray-700"}`}
              >
                ASAP
              </div>
              <div className="text-[10px] text-gray-400">~30–45 min</div>
              {isAsap && !isLateNight && !isEarlyMorning && (
                <div className="mt-1 text-[9px] font-bold text-accent">
                  +20% fee
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsAsap(false)}
              className={`rounded-2xl border-2 p-3 text-center transition-all ${
                !isAsap
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <div className="text-xl mb-1">📅</div>
              <div
                className={`text-xs font-bold ${!isAsap ? "text-brand-700" : "text-gray-700"}`}
              >
                Schedule
              </div>
              <div className="text-[10px] text-gray-400">Pick a time</div>
            </button>
          </div>
          {!isAsap && (
            <div className="mt-3 space-y-3">
              {/* Day picker */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSlotDate(nextDay(slotDate))}
                  aria-hidden
                  className="hidden"
                />
                <input
                  type="date"
                  value={slotDate}
                  min={todayYmd()}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="input text-sm"
                />
              </div>

              {/* Slot chips */}
              {!selectedServiceId ? (
                <p className="text-xs text-gray-400">
                  Select a service first to see available times.
                </p>
              ) : slotsLoading ? (
                <p className="text-xs text-gray-400">Loading times…</p>
              ) : slots && slots.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {slots.map((iso) => {
                    const sel = scheduledFor === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setScheduledFor(iso)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                          sel
                            ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        {fmtTime(iso)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                  No times available on this day. Try another date or book ASAP.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="input-label">Your location</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 14 Kofo Abayomi, Victoria Island"
            className="input mb-2 text-sm"
          />
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="input text-sm"
          >
            <option value="">Select your zone (optional)</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="input-label">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Hair length, style refs, allergies, access notes…"
            className="input resize-none text-sm"
            rows={2}
          />
        </div>

        {/* Price summary */}
        {selectedService && (
          <div className="rounded-2xl bg-gray-50 p-4 space-y-2 text-sm border border-gray-100">
            <div className="flex justify-between text-gray-600">
              <span>{selectedService.name}</span>
              <span className="font-medium">{formatNaira(price)}</span>
            </div>
            {surchargeAmt > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>{surchargeLabel}</span>
                <span className="font-medium">
                  +{formatNaira(surchargeAmt)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
              <span>Total</span>
              <span>{formatNaira(total)}</span>
            </div>
          </div>
        )}

        {/* Surcharge info */}
        {surchargeAmt > 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-700">
            <span className="shrink-0">⚡</span>
            <p>
              {surchargeLabel.includes("Emergency")
                ? "Emergency bookings have a 20% surcharge to ensure immediate availability."
                : "Time-of-day surcharges apply to incentivise off-hours coverage."}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleBook}
          disabled={loading || !selectedServiceId}
          className="btn-primary btn-lg w-full"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Processing…
            </span>
          ) : selectedServiceId ? (
            `Confirm & Pay ${formatNaira(total)} →`
          ) : (
            "Select a service to book"
          )}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <span className="text-brand-500">🛡️</span>
          Payment held securely until you confirm the service is complete
        </p>
      </div>
    </div>
  );
}
