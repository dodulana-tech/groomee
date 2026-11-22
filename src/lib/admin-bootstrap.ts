/**
 * Env allow-list bootstrap for admins.
 *
 * ADMIN_PHONES / ADMIN_EMAILS are the hand-maintained list of people who
 * must always have admin access (founders, ops lead). Anyone on that list is
 * guaranteed role=ADMIN *and* an admin role on every login and every deploy,
 * so the first admin can never be locked out of /admin/team.
 *
 * Kept free of Next.js imports so scripts/sync-roles.ts can use it.
 */
import type { PrismaClient } from "@prisma/client";

/** Role slug given to allow-listed admins that have none. */
export const ENV_ADMIN_ROLE_SLUG = process.env.ADMIN_DEFAULT_ROLE?.trim() || "super-admin";

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function envAdminPhones(): string[] {
  return splitList(process.env.ADMIN_PHONES);
}

export function envAdminEmails(): string[] {
  // ADMIN_EMAIL (singular) is what prisma/seed.ts reads; accept both.
  return [...splitList(process.env.ADMIN_EMAILS), ...splitList(process.env.ADMIN_EMAIL)].map(
    (e) => e.toLowerCase(),
  );
}

export function isEnvAdminPhone(phone: string | null | undefined): boolean {
  return Boolean(phone) && envAdminPhones().includes(phone!);
}

export function isEnvAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && envAdminEmails().includes(email!.trim().toLowerCase());
}

/**
 * If the user is on the env allow-list, make sure they are ADMIN with a role.
 * Never overwrites a role that was already assigned (e.g. via /admin/team).
 * Returns true if anything changed.
 */
export async function ensureEnvAdmin(
  prisma: PrismaClient,
  user: { id: string; phone: string | null; email: string | null; role: string; adminRoleId: string | null },
  /** The email the caller just proved with an email OTP, if any. Stored
   *  emails are self-asserted, so only a proven one counts. Phones are
   *  always OTP-verified before they reach a user row. */
  opts: { verifiedEmail?: string | null } = {},
): Promise<boolean> {
  const emailProven =
    !!opts.verifiedEmail &&
    !!user.email &&
    opts.verifiedEmail.trim().toLowerCase() === user.email.trim().toLowerCase() &&
    isEnvAdminEmail(user.email);
  if (!isEnvAdminPhone(user.phone) && !emailProven) return false;
  if (user.role === "ADMIN" && user.adminRoleId) return false;

  const role = await prisma.adminRole.findUnique({
    where: { slug: ENV_ADMIN_ROLE_SLUG },
    select: { id: true },
  });
  if (!role) {
    console.error(
      `[admin-bootstrap] role "${ENV_ADMIN_ROLE_SLUG}" not found — run npm run sync:roles`,
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: "ADMIN",
      ...(user.adminRoleId || !role ? {} : { adminRoleId: role.id }),
    },
  });
  return true;
}

/**
 * May this user put `email` on their account without proving they own it?
 * Returns a reason when not. Emails are self-asserted (profile, pro
 * application), so an allow-listed admin address or one already on another
 * account must never be claimable this way — otherwise typing an admin's
 * email into a profile would hand out admin access on the next login.
 */
export async function emailClaimError(
  prisma: PrismaClient,
  userId: string,
  email: string,
): Promise<string | null> {
  const normalised = email.trim().toLowerCase();
  const self = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (self?.email?.toLowerCase() === normalised) return null;
  if (isEnvAdminEmail(normalised)) return "That email can't be used here.";
  const taken = await prisma.user.findFirst({
    where: { email: normalised, id: { not: userId } },
    select: { id: true },
  });
  return taken ? "That email is already linked to another account." : null;
}
