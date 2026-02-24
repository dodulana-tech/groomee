import { db } from "./db";
import type { SurchargeResult } from "@/types";

// ─── SETTINGS CACHE ───────────────────────────────────────────────────────────

let settingsCache: Record<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

async function getSettings(): Promise<Record<string, string>> {
  if (settingsCache && Date.now() - cacheTime < CACHE_TTL) return settingsCache;
  const rows = await db.setting.findMany();
  settingsCache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cacheTime = Date.now();
  return settingsCache;
}

// ─── SURCHARGE LOGIC ─────────────────────────────────────────────────────────

export async function calculateSurcharge(
  scheduledFor: Date | null, // null = ASAP
  baseAmount: number,
): Promise<SurchargeResult> {
  const s = await getSettings();

  const now = new Date();
  const targetTime = scheduledFor ?? now;
  const minutesUntilService = scheduledFor
    ? (scheduledFor.getTime() - now.getTime()) / 60_000
    : 0;

  const hour = targetTime.getHours();

  const emergencyThreshold = parseInt(s.EMERGENCY_THRESHOLD_MINUTES ?? "120");
  const lateNightStart = parseInt(s.LATENIGHT_START_HOUR ?? "22");
  const lateNightEnd = parseInt(s.LATENIGHT_END_HOUR ?? "5");
  const earlyMorningStart = parseInt(s.EARLYMORNING_START_HOUR ?? "5");
  const earlyMorningEnd = parseInt(s.EARLYMORNING_END_HOUR ?? "7");
  const surgeActive = s.SURGE_ACTIVE === "true";

  // Surge takes priority
  if (surgeActive) {
    const rate = parseFloat(s.SURGE_RATE ?? "0.30");
    return {
      type: "surge",
      rate,
      amount: baseAmount * rate,
      label: `Surge pricing (+${Math.round(rate * 100)}%)`,
    };
  }

  // Late night: 10pm–5am
  const isLateNight = hour >= lateNightStart || hour < lateNightEnd;
  if (isLateNight) {
    const rate = parseFloat(s.LATENIGHT_SURCHARGE_RATE ?? "0.25");
    return {
      type: "latenight",
      rate,
      amount: baseAmount * rate,
      label: `Late night fee (+${Math.round(rate * 100)}%)`,
    };
  }

  // Early morning: 5am–7am
  const isEarlyMorning = hour >= earlyMorningStart && hour < earlyMorningEnd;
  if (isEarlyMorning) {
    const rate = parseFloat(s.EARLYMORNING_SURCHARGE_RATE ?? "0.20");
    return {
      type: "earlymorning",
      rate,
      amount: baseAmount * rate,
      label: `Early morning fee (+${Math.round(rate * 100)}%)`,
    };
  }

  // Emergency: booking < threshold ahead
  const isEmergency = !scheduledFor || minutesUntilService < emergencyThreshold;
  if (isEmergency) {
    const rate = parseFloat(s.EMERGENCY_SURCHARGE_RATE ?? "0.20");
    return {
      type: "emergency",
      rate,
      amount: baseAmount * rate,
      label: `Emergency fee (+${Math.round(rate * 100)}%)`,
    };
  }

  return { type: null, rate: 0, amount: 0, label: null };
}

// ─── EARNINGS SPLIT ───────────────────────────────────────────────────────────

export function calculateEarnings({
  baseAmount,
  surchargeAmount,
  surchargeType,
  commissionRate,
}: {
  baseAmount: number;
  surchargeAmount: number;
  surchargeType: string | null;
  commissionRate: number;
}) {
  // Platform takes full commission on base
  const platformOnBase = baseAmount * commissionRate;
  const groomerOnBase = baseAmount - platformOnBase;

  // Surcharge split: groomer gets 70%, platform 30%
  const groomerOnSurcharge = surchargeAmount * 0.7;
  const platformOnSurcharge = surchargeAmount * 0.3;

  return {
    totalAmount: baseAmount + surchargeAmount,
    platformFee: platformOnBase + platformOnSurcharge,
    groomerEarning: groomerOnBase + groomerOnSurcharge,
  };
}

export async function invalidateSettingsCache() {
  settingsCache = null;
}
