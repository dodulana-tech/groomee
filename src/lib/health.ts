import { db } from "./db";
import type {
  HealthProfile,
  HealthCondition,
  ServiceContraindication,
  Prisma,
} from "@prisma/client";

// ─── CONTROLLED VOCABULARY ───────────────────────────────────────────────────
//
// The set of conditions the customer can attach. The picker UI sources from
// this list; free-form text lives in HealthProfile.notes. Codes are stable;
// labels can be refreshed (existing rows keep their captured label).

export type HealthCategoryKey =
  | "SKIN_SENSITIVITY"
  | "ALLERGY"
  | "MOBILITY"
  | "REPRODUCTIVE"
  | "CHRONIC"
  | "MEDICATION"
  | "OTHER";

export interface ConditionDef {
  code: string;
  label: string;
  category: HealthCategoryKey;
  hint?: string;
}

export const HEALTH_CONDITIONS: ConditionDef[] = [
  // Skin
  { code: "SKIN_ECZEMA", label: "Eczema", category: "SKIN_SENSITIVITY", hint: "Patchy dry/irritated skin; avoid harsh chemicals." },
  { code: "SKIN_PSORIASIS", label: "Psoriasis", category: "SKIN_SENSITIVITY" },
  { code: "SKIN_SENSITIVE", label: "Generally sensitive skin", category: "SKIN_SENSITIVITY" },
  { code: "SKIN_ACNE", label: "Active acne", category: "SKIN_SENSITIVITY" },
  { code: "SKIN_RECENT_PEEL", label: "Recent chemical peel or laser", category: "SKIN_SENSITIVITY" },
  // Allergies
  { code: "ALLERGY_LATEX", label: "Latex allergy", category: "ALLERGY", hint: "Pro should use nitrile gloves." },
  { code: "ALLERGY_FORMALDEHYDE", label: "Formaldehyde allergy", category: "ALLERGY", hint: "Some relaxers/keratin products contain it." },
  { code: "ALLERGY_FRAGRANCE", label: "Fragrance allergy", category: "ALLERGY" },
  { code: "ALLERGY_NICKEL", label: "Nickel allergy", category: "ALLERGY" },
  { code: "ALLERGY_ACRYLIC", label: "Acrylic allergy", category: "ALLERGY" },
  // Mobility
  { code: "MOBILITY_PLANTAR_FASCIITIS", label: "Plantar fasciitis", category: "MOBILITY", hint: "Avoid sustained foot pressure during pedicure." },
  { code: "MOBILITY_ARTHRITIS", label: "Arthritis", category: "MOBILITY" },
  { code: "MOBILITY_RECENT_SURGERY", label: "Recent surgery", category: "MOBILITY", hint: "Tell your pro the area and the recovery timeline." },
  // Reproductive
  { code: "REPRO_PREGNANT", label: "Pregnant", category: "REPRODUCTIVE", hint: "Avoid chemical relaxers, certain essential oils, and some peels." },
  { code: "REPRO_BREASTFEEDING", label: "Breastfeeding", category: "REPRODUCTIVE" },
  // Chronic
  { code: "CHRONIC_DIABETES", label: "Diabetes", category: "CHRONIC", hint: "Extra care with cuticles — small cuts can become serious." },
  { code: "CHRONIC_HEART", label: "Heart condition", category: "CHRONIC" },
  { code: "CHRONIC_BLOOD_THINNERS", label: "On blood thinners", category: "CHRONIC", hint: "Even minor cuts may bleed longer." },
  // Medication
  { code: "MED_ACCUTANE", label: "Currently on accutane / isotretinoin", category: "MEDICATION", hint: "Skin is fragile — no waxing." },
  { code: "MED_CHEMO", label: "Receiving chemotherapy", category: "MEDICATION", hint: "Hair is fragile; skin is sensitive." },
];

export function findConditionDef(code: string): ConditionDef | undefined {
  return HEALTH_CONDITIONS.find((c) => c.code === code);
}

// ─── DEFAULT CONTRAINDICATIONS ───────────────────────────────────────────────
//
// Seed-time default mappings. Admin can edit/add via the admin UI in
// slice H5.

export interface ContraindicationSeed {
  conditionCode: string;
  serviceSlug: string | null; // null = any service
  level: "INFO" | "WARN" | "BLOCK";
  message: string;
}

export const DEFAULT_CONTRAINDICATIONS: ContraindicationSeed[] = [
  // Latex applies to every service
  { conditionCode: "ALLERGY_LATEX", serviceSlug: null, level: "WARN", message: "Customer is allergic to latex — use nitrile gloves." },
  { conditionCode: "ALLERGY_FRAGRANCE", serviceSlug: null, level: "INFO", message: "Customer is sensitive to fragrance — use unscented products where possible." },

  // Reproductive
  { conditionCode: "REPRO_PREGNANT", serviceSlug: null, level: "WARN", message: "Customer is pregnant — avoid chemical relaxers, strong dyes, and certain essential oils." },

  // Skin
  { conditionCode: "SKIN_RECENT_PEEL", serviceSlug: null, level: "WARN", message: "Customer has had a recent chemical peel or laser — skin barrier is compromised. Be gentle, avoid exfoliation." },
  { conditionCode: "SKIN_ECZEMA", serviceSlug: null, level: "INFO", message: "Customer has eczema — avoid harsh products; ask before applying anything new." },

  // Diabetes / blood thinners around nails
  { conditionCode: "CHRONIC_DIABETES", serviceSlug: null, level: "WARN", message: "Customer has diabetes — do not cut cuticles, do not push aggressively, no foot pressure if any sensation loss." },
  { conditionCode: "CHRONIC_BLOOD_THINNERS", serviceSlug: null, level: "WARN", message: "Customer is on blood thinners — even minor cuts will bleed longer than usual." },

  // Mobility — plantar fasciitis on pedicure-adjacent
  { conditionCode: "MOBILITY_PLANTAR_FASCIITIS", serviceSlug: null, level: "WARN", message: "Customer has plantar fasciitis — avoid sustained foot pressure or stretching during pedicure." },
  { conditionCode: "MOBILITY_RECENT_SURGERY", serviceSlug: null, level: "INFO", message: "Customer had recent surgery — confirm the recovery area before starting." },

  // Accutane → no waxing
  { conditionCode: "MED_ACCUTANE", serviceSlug: null, level: "BLOCK", message: "Customer is on accutane — waxing is unsafe; skin will tear. Refuse and suggest an alternative." },

  // Chemo
  { conditionCode: "MED_CHEMO", serviceSlug: null, level: "WARN", message: "Customer is on chemotherapy — hair and skin are fragile. Be extra gentle." },
];

// ─── LOOKUPS & ACCESS ────────────────────────────────────────────────────────

export async function getProfileForUser(
  userId: string,
): Promise<(HealthProfile & { conditions: HealthCondition[] }) | null> {
  return db.healthProfile.findUnique({
    where: { userId },
    include: { conditions: { orderBy: { createdAt: "asc" } } },
  });
}

export interface ContraindicationHit {
  conditionCode: string;
  conditionLabel: string;
  serviceId: string | null;
  serviceName: string | null;
  level: "INFO" | "WARN" | "BLOCK";
  message: string;
  severity: "MILD" | "MODERATE" | "SEVERE";
}

/**
 * Walk the customer's conditions × the booking's services × the
 * contraindication catalog. Returns one entry per matching pair.
 */
export async function checkContraindications(
  userId: string,
  serviceIds: string[],
): Promise<ContraindicationHit[]> {
  const profile = await db.healthProfile.findUnique({
    where: { userId },
    include: { conditions: { where: { resolved: false } } },
  });
  if (!profile || profile.conditions.length === 0) return [];

  const conditionCodes = profile.conditions.map((c) => c.code);
  // Match either the explicit service id OR a catalog-wide rule (serviceId null).
  const rules = await db.serviceContraindication.findMany({
    where: {
      conditionCode: { in: conditionCodes },
      OR: [{ serviceId: null }, { serviceId: { in: serviceIds } }],
    },
    include: { service: true },
  });

  const conditionByCode = new Map(profile.conditions.map((c) => [c.code, c]));
  const hits: ContraindicationHit[] = [];
  for (const r of rules) {
    const c = conditionByCode.get(r.conditionCode);
    if (!c) continue;
    hits.push({
      conditionCode: r.conditionCode,
      conditionLabel: c.label,
      serviceId: r.serviceId,
      serviceName: r.service?.name ?? null,
      level: r.level,
      message: r.message,
      severity: c.severity,
    });
  }
  // Sort BLOCK first, then WARN, then INFO.
  const rank = { BLOCK: 0, WARN: 1, INFO: 2 } as const;
  hits.sort((a, b) => rank[a.level] - rank[b.level]);
  return hits;
}

export function highestLevel(hits: ContraindicationHit[]): "INFO" | "WARN" | "BLOCK" | null {
  if (hits.length === 0) return null;
  if (hits.some((h) => h.level === "BLOCK")) return "BLOCK";
  if (hits.some((h) => h.level === "WARN")) return "WARN";
  return "INFO";
}

// ─── ACCESS LOG ──────────────────────────────────────────────────────────────

export async function writeAccessLog(
  profileId: string,
  accessorRole: "PRO" | "ADMIN" | "CUSTOMER" | "SYSTEM",
  accessorId: string | null,
  context: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? db;
  await client.healthAccessLog.create({
    data: { profileId, accessorRole, accessorId: accessorId ?? null, context },
  });
}

// ─── ACKNOWLEDGEMENT SNAPSHOT ────────────────────────────────────────────────

/**
 * Capture a JSON snapshot of the profile + relevant conditions at the moment
 * the pro is briefed. Used to freeze a HealthAcknowledgment so future profile
 * edits don't rewrite history for past bookings.
 */
export async function buildAckSnapshot(profileId: string) {
  const profile = await db.healthProfile.findUnique({
    where: { id: profileId },
    include: { conditions: { where: { resolved: false } } },
  });
  if (!profile) return null;
  return {
    profileId,
    capturedAt: new Date().toISOString(),
    visibility: profile.visibility,
    notes: profile.notes,
    conditions: profile.conditions.map((c) => ({
      code: c.code,
      label: c.label,
      category: c.category,
      severity: c.severity,
      notes: c.notes,
    })),
  };
}

// ─── PERMISSIONS ─────────────────────────────────────────────────────────────

export const HEALTH_PERMISSIONS = {
  view: "health.view",
  manage: "health.manage",
} as const;
