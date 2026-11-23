/**
 * Beauty-professional recruitment pipeline: application state, ops alerts,
 * applicant notifications and the post-approval activation checklist.
 *
 * Status model (no new enum values, so existing ProStatus switches keep
 * working):
 *   PENDING                     → application under review
 *   ACTIVE                      → approved
 *   REMOVED + rejectedAt set    → application declined (may re-apply)
 *   REMOVED / SUSPENDED (other) → account closed / on hold (contact support)
 */
import type { Pro } from "@prisma/client";
import { db } from "./db";
import { sendMessage, sendProWelcome } from "./whatsapp";
import { sendEmail } from "./email";
import {
  proApplicationApprovedEmail,
  proApplicationReceivedEmail,
  proApplicationRejectedEmail,
} from "./email-templates";
import { envAdminEmails, envAdminPhones } from "./admin-bootstrap";

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomeeapp.com";

/** Zones the Lagos launch needs covered first, and the active-pro target for each. */
export const PRIORITY_ZONES = [
  "Lekki Phase 1",
  "Victoria Island",
  "Ikoyi",
  "Yaba",
  "Surulere",
] as const;
export const ACTIVE_PRO_TARGET_PER_ZONE = 15;

/**
 * Abuja is WAITLIST in City.status but runs as a WhatsApp-concierge city, so
 * every Abuja zone is a recruiting priority with its own (smaller) target.
 */
export const ABUJA_CITY_SLUG = "abuja";
export const ABUJA_ACTIVE_PRO_TARGET_PER_ZONE = 10;

export interface CoverageZone {
  name: string;
  missing: boolean;
  active: number;
  online: number;
  pending: number;
  target: number;
  pct: number;
}

/** Active / online / applying pros per priority zone, grouped by city. */
export async function loadZoneCoverage(): Promise<{ city: string; target: number; zones: CoverageZone[] }[]> {
  const zones = await db.zone.findMany({
    where: {
      OR: [{ name: { in: [...PRIORITY_ZONES] } }, { cityRel: { slug: ABUJA_CITY_SLUG } }],
    },
    select: {
      name: true,
      cityRel: { select: { slug: true } },
      pros: { select: { pro: { select: { status: true, availability: true } } } },
    },
    orderBy: { name: "asc" },
  });
  const summarise = (name: string, target: number): CoverageZone => {
    const z = zones.find((x) => x.name === name);
    const pros = z?.pros.map((p) => p.pro) ?? [];
    const active = pros.filter((p) => p.status === "ACTIVE").length;
    return {
      name,
      missing: !z,
      active,
      online: pros.filter((p) => p.status === "ACTIVE" && p.availability === "ONLINE").length,
      pending: pros.filter((p) => p.status === "PENDING").length,
      target,
      pct: Math.min(100, Math.round((active / target) * 100)),
    };
  };
  const abuja = zones.filter((z) => z.cityRel?.slug === ABUJA_CITY_SLUG).map((z) => z.name);
  return [
    { city: "Lagos", target: ACTIVE_PRO_TARGET_PER_ZONE, zones: PRIORITY_ZONES.map((n) => summarise(n, ACTIVE_PRO_TARGET_PER_ZONE)) },
    ...(abuja.length
      ? [{ city: "Abuja", target: ABUJA_ACTIVE_PRO_TARGET_PER_ZONE, zones: abuja.map((n) => summarise(n, ABUJA_ACTIVE_PRO_TARGET_PER_ZONE)) }]
      : []),
  ];
}

export const CATEGORY_LABEL: Record<string, string> = {
  HAIR: "Hair styling",
  MAKEUP: "Makeup",
  NAILS: "Nails",
  LASHES: "Lashes",
  BARBING: "Barbing",
  SKINCARE: "Skincare",
  OTHER: "Other",
};

export type ApplicationState =
  | "NONE"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED"
  | "CLOSED";

export function applicationState(
  pro: Pick<Pro, "status" | "rejectedAt"> | null | undefined,
): ApplicationState {
  if (!pro) return "NONE";
  switch (pro.status) {
    case "PENDING":
      return "PENDING";
    case "ACTIVE":
      return "APPROVED";
    case "SUSPENDED":
      return "SUSPENDED";
    case "REMOVED":
      return pro.rejectedAt ? "REJECTED" : "CLOSED";
    default:
      return "NONE";
  }
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
// All best-effort: a Twilio/SMTP failure must never fail the underlying
// application or review action. sendMessage already logs to Notification.

async function safeEmail(to: string | null | undefined, tpl: { subject: string; html: string }) {
  if (!to) return;
  try {
    await sendEmail({ to, subject: tpl.subject, html: tpl.html });
  } catch (err) {
    console.error("[pro-onboarding] email failed", to, err);
  }
}

async function safeWhatsApp(to: string, message: string) {
  try {
    await sendMessage(to, message);
  } catch (err) {
    console.error("[pro-onboarding] whatsapp failed", to, err);
  }
}

export async function notifyApplicationReceived(args: {
  pro: Pick<Pro, "id" | "name" | "phone">;
  email: string | null;
  services: string[];
  zones: string[];
  resubmission: boolean;
}) {
  const { pro, email, services, zones, resubmission } = args;
  const first = pro.name.split(" ")[0] || pro.name;

  const applicantMsg =
    `Hi ${first}, thanks for applying to Groomee! 💚\n\n` +
    `We've received your application (${services.join(", ")} in ${zones.join(", ")}).\n\n` +
    `*What happens next*\n` +
    `1. Our team reviews it, usually within 24 hours on weekdays.\n` +
    `2. We may message you here for photos of recent work.\n` +
    `3. Once approved, you'll get your partner portal link.\n\n` +
    `Check your status any time: ${APP_URL}/partner/onboarding`;

  const opsMsg =
    `🆕 *${resubmission ? "Re-application" : "New pro application"}*\n\n` +
    `${pro.name} · ${pro.phone}\n` +
    `Services: ${services.join(", ") || "-"}\n` +
    `Zones: ${zones.join(", ") || "-"}\n\n` +
    `Review: ${APP_URL}/admin/pros/applicants`;

  await Promise.allSettled([
    safeWhatsApp(pro.phone, applicantMsg),
    safeEmail(email, proApplicationReceivedEmail({ name: pro.name, services, zones })),
    ...envAdminPhones().map((p) => safeWhatsApp(p, opsMsg)),
    ...envAdminEmails().map((e) =>
      safeEmail(e, {
        subject: `New pro application: ${pro.name} (${zones.join(", ")})`,
        html: `<p>${escapeHtml(opsMsg).replace(/\n/g, "<br/>")}</p>`,
      }),
    ),
  ]);
}

export async function notifyApplicationApproved(args: {
  pro: Pick<Pro, "name" | "phone">;
  email: string | null;
}) {
  const { pro, email } = args;
  try {
    await sendProWelcome(pro.phone, pro.name);
  } catch (err) {
    console.error("[pro-onboarding] welcome failed", err);
  }
  await Promise.allSettled([
    safeWhatsApp(
      pro.phone,
      `📲 *Your partner portal*\n\nSign in with this phone number: ${APP_URL}/partner/login\n\n` +
        `Finish your checklist (photo, prices, areas, bank details) so customers can book you. ` +
        `Pros with a complete profile get offered jobs first.`,
    ),
    safeEmail(email, proApplicationApprovedEmail({ name: pro.name })),
  ]);
}

export async function notifyApplicationRejected(args: {
  pro: Pick<Pro, "name" | "phone">;
  email: string | null;
  reason: string;
}) {
  const { pro, email, reason } = args;
  const first = pro.name.split(" ")[0] || pro.name;
  await Promise.allSettled([
    safeWhatsApp(
      pro.phone,
      `Hi ${first}, thank you for applying to Groomee.\n\n` +
        `We can't approve your application just yet:\n_${reason}_\n\n` +
        `This isn't a final no. When you're ready, update your application here and we'll take another look: ${APP_URL}/partner/onboarding 💚`,
    ),
    safeEmail(email, proApplicationRejectedEmail({ name: pro.name, reason })),
  ]);
}

function escapeHtml(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── ACTIVATION CHECKLIST ────────────────────────────────────────────────────

export interface ChecklistItem {
  key: "photo" | "bio" | "services" | "zones" | "bank" | "online";
  label: string;
  hint: string;
  done: boolean;
  href: string;
}

type ChecklistPro = Pick<
  Pro,
  "photo" | "bio" | "bankAccount" | "bankCode" | "bankVerifiedAt" | "availability" | "totalJobs"
> & {
  services: { customPrice: number | null }[];
  zones: unknown[];
};

export const MIN_BIO_LENGTH = 40;

export function activationChecklist(pro: ChecklistPro): {
  items: ChecklistItem[];
  done: number;
  total: number;
  complete: boolean;
  readyToGoOnline: boolean;
} {
  const items: ChecklistItem[] = [
    {
      key: "photo",
      label: "Add a clear profile photo",
      hint: "Customers book faces they can see. A bright, front-facing photo works best.",
      done: Boolean(pro.photo),
      href: "/partner/profile#photo",
    },
    {
      key: "bio",
      label: "Write a short bio",
      hint: `Your experience and specialities, at least ${MIN_BIO_LENGTH} characters.`,
      done: (pro.bio ?? "").trim().length >= MIN_BIO_LENGTH,
      href: "/partner/profile#about",
    },
    {
      key: "services",
      label: "Confirm your services and prices",
      hint: "Set a price for every service you offer, within Groomee's fair range.",
      done: pro.services.length > 0 && pro.services.every((s) => s.customPrice != null),
      href: "/partner/profile#services",
    },
    {
      key: "zones",
      label: "Choose the areas you cover",
      hint: "We only send you jobs in areas you pick.",
      done: pro.zones.length > 0,
      href: "/partner/profile#zones",
    },
    {
      key: "bank",
      label: "Verify your bank account",
      hint: "So we can pay you. We confirm the account name with your bank.",
      done: Boolean(pro.bankVerifiedAt && pro.bankAccount && pro.bankCode),
      href: "/partner/profile#bank",
    },
    {
      key: "online",
      label: "Go online for your first job",
      hint: "Tap the Offline button on your dashboard, or text ON to Groomee on WhatsApp.",
      done: pro.availability !== "OFFLINE" || pro.totalJobs > 0,
      href: "/partner",
    },
  ];
  const done = items.filter((i) => i.done).length;
  const requiredBeforeOnline = items.filter((i) => i.key !== "online");
  return {
    items,
    done,
    total: items.length,
    complete: done === items.length,
    readyToGoOnline: requiredBeforeOnline.every((i) => i.done),
  };
}

export async function loadActivationChecklist(proId: string) {
  const pro = await db.pro.findUnique({
    where: { id: proId },
    include: {
      services: { select: { customPrice: true } },
      zones: { select: { zoneId: true } },
    },
  });
  if (!pro) return null;
  return activationChecklist(pro);
}
