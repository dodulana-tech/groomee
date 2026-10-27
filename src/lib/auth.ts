import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "./db";
import type { SessionPayload } from "@/types";
import "./env";
import { ensureEnvAdmin, isEnvAdminEmail, isEnvAdminPhone } from "./admin-bootstrap";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const SESSION_DURATION = parseInt(process.env.SESSION_DURATION ?? "2592000");
const COOKIE_NAME = "groomee_session";

// ─── JWT ──────────────────────────────────────────────────────────────────────

export async function signToken(payload: Omit<SessionPayload, "iat" | "exp">) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(SECRET);
}

export async function verifyToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ─── COOKIE SESSION ───────────────────────────────────────────────────────────

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

// ─── SERVER-SIDE SESSION ──────────────────────────────────────────────────────

// Admin sessions are re-hydrated from the DB so role / permission changes
// apply without a re-login (the JWT only proves identity). In-memory cache
// with a short TTL coalesces burst traffic.
const ADMIN_STATE_TTL_MS = 30_000;
type AdminState = {
  validFrom: number;
  adminRoleId?: string;
  adminRoleName?: string;
  permissions: string[];
  checkedAt: number;
};
const adminStateCache = new Map<string, AdminState>();

async function loadAdminState(userId: string): Promise<AdminState | null> {
  const cached = adminStateCache.get(userId);
  const now = Date.now();
  if (cached && now - cached.checkedAt < ADMIN_STATE_TTL_MS) return cached;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sessionsValidFrom: true, role: true, adminRole: true },
  });
  if (!user || user.role !== "ADMIN") {
    // User gone or demoted — kill the session.
    adminStateCache.delete(userId);
    return null;
  }
  const state: AdminState = {
    validFrom: user.sessionsValidFrom ? Math.floor(user.sessionsValidFrom.getTime() / 1000) : 0,
    adminRoleId: user.adminRole?.id,
    adminRoleName: user.adminRole?.name,
    permissions: user.adminRole?.permissions ?? [],
    checkedAt: now,
  };
  adminStateCache.set(userId, state);
  return state;
}

/**
 * Returns null if the session is revoked; otherwise the payload with admin
 * role + permissions refreshed from the DB. Non-admin sessions pass through
 * without a DB hit.
 */
async function resolveSession(payload: SessionPayload): Promise<SessionPayload | null> {
  if (payload.role !== "ADMIN") return payload;
  const state = await loadAdminState(payload.userId);
  if (!state) return null;
  if ((payload.iat ?? 0) < state.validFrom) return null;
  return {
    ...payload,
    adminRoleId: state.adminRoleId,
    adminRoleName: state.adminRoleName,
    permissions: state.permissions,
  };
}

export function invalidateSessionCache(userId?: string) {
  if (userId) adminStateCache.delete(userId);
  else adminStateCache.clear();
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return resolveSession(payload);
}

export async function getSessionFromRequest(
  req: NextRequest,
): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  return resolveSession(payload);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session;
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

export function generateOtp(): string {
  const { randomInt } = require("crypto");
  return randomInt(100000, 999999).toString();
}

export async function createOtp(phone: string): Promise<{ otp: string }> {
  // Invalidate old OTPs for this phone
  await db.otpCode.updateMany({
    where: { phone, usedAt: null },
    data: { usedAt: new Date() },
  });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.otpCode.create({
    data: { phone, code: otp, expiresAt },
  });

  return { otp };
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{
  userId: string;
  role: "CUSTOMER" | "ADMIN" | "PRO";
  isNewUser: boolean;
} | null> {
  // Atomic find + mark-used to prevent concurrent OTP consumption
  const otpRecord = await db.otpCode.findFirst({
    where: { phone, code, usedAt: null, expiresAt: { gt: new Date() } },
  });

  if (!otpRecord) return null;

  // Conditional update: only mark used if still unused (race-safe)
  const consumed = await db.otpCode.updateMany({
    where: { id: otpRecord.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  if (consumed.count === 0) return null; // Another request consumed it first

  // Defer user creation until first successful verification.
  const existingUser = await db.user.findUnique({ where: { phone } });
  const isNewUser = !existingUser?.name;

  const user = await db.user.upsert({
    where: { phone },
    update: {},
    create: { phone, role: isEnvAdminPhone(phone) ? "ADMIN" : "CUSTOMER" },
  });

  return {
    userId: user.id,
    role: user.role as "CUSTOMER" | "ADMIN" | "PRO",
    isNewUser,
  };
}

// ─── EMAIL OTP ───────────────────────────────────────────────────────────────

// Prefer a fully linked user (has a real phone) over an email-only user when
// the same email appears on multiple records.
async function findUserByEmailPreferLinked(email: string) {
  return (
    (await db.user.findFirst({ where: { email, NOT: { phone: null } } })) ??
    (await db.user.findFirst({ where: { email } }))
  );
}

export async function createOtpByEmail(email: string): Promise<{ otp: string }> {
  // Invalidate old OTPs for this email
  await db.otpCode.updateMany({
    where: { phone: `email:${email}`, usedAt: null },
    data: { usedAt: new Date() },
  });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Store with email: prefix to distinguish from phone OTPs
  await db.otpCode.create({
    data: { phone: `email:${email}`, code: otp, expiresAt },
  });

  return { otp };
}

export async function verifyOtpByEmail(
  email: string,
  code: string,
): Promise<{
  userId: string;
  role: "CUSTOMER" | "ADMIN" | "PRO";
  isNewUser: boolean;
  needsPhone: boolean;
} | null> {
  const otpRecord = await db.otpCode.findFirst({
    where: {
      phone: `email:${email}`,
      code,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otpRecord) return null;

  await db.otpCode.update({
    where: { id: otpRecord.id },
    data: { usedAt: new Date() },
  });

  let user = await findUserByEmailPreferLinked(email);

  // Defer user creation until verification: only create the record once the
  // user proves ownership of the email by entering the OTP. Phone is null
  // until the user links one via the link-phone flow.
  if (!user) {
    user = await db.user.create({
      data: {
        phone: null,
        email,
        role: isAdminEmail(email) ? "ADMIN" : "CUSTOMER",
      },
    });
  }

  const isNewUser = !user.name;
  const needsPhone = user.phone === null;

  return {
    userId: user.id,
    role: user.role as "CUSTOMER" | "ADMIN" | "PRO",
    isNewUser,
    needsPhone,
  };
}

export async function linkPhoneToUser(
  userId: string,
  phone: string,
): Promise<boolean> {
  // Check if phone is already taken by another user
  const existing = await db.user.findFirst({
    where: { phone, id: { not: userId } },
  });
  if (existing) return false;

  await db.user.update({
    where: { id: userId },
    data: { phone },
  });
  return true;
}

// ─── ADMIN ROLE HELPERS ───────────────────────────────────────────────────────

export async function getAdminRoleData(userId: string): Promise<{
  adminRoleId?: string;
  adminRoleName?: string;
  permissions?: string[];
} | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { adminRole: true },
  });
  if (!user || user.role !== "ADMIN" || !user.adminRole) return null;
  return {
    adminRoleId: user.adminRole.id,
    adminRoleName: user.adminRole.name,
    permissions: user.adminRole.permissions,
  };
}

export async function signUserToken(user: {
  id: string;
  phone: string | null;
  role: string;
}): Promise<string> {
  let role = user.role as "CUSTOMER" | "ADMIN" | "PRO";

  // Env allow-listed admins always get role=ADMIN plus an admin role, even
  // if their account pre-dates the list or was created without one.
  const fullUser = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, phone: true, email: true, role: true, adminRoleId: true },
  });
  if (fullUser && (await ensureEnvAdmin(db, fullUser))) {
    role = "ADMIN";
    invalidateSessionCache(user.id);
  }

  // If role is CUSTOMER, check if this user has an approved Pro record.
  // Match on userId, plus phone when one is set (covers legacy Pro rows
  // created before user-linking).
  if (role === "CUSTOMER") {
    const proPhoneClause = user.phone ? [{ phone: user.phone }] : [];
    const pro = await db.pro.findFirst({
      where: {
        OR: [{ userId: user.id }, ...proPhoneClause],
        status: "ACTIVE",
      },
    });
    if (pro) {
      role = "PRO";
      // Auto-link Pro→User if not yet linked
      if (!pro.userId) {
        await db.pro.update({
          where: { id: pro.id },
          data: { userId: user.id },
        });
      }
      // Update user role in DB to match
      await db.user.update({
        where: { id: user.id },
        data: { role: "PRO" },
      });
    }
  }

  const roleData = role === "ADMIN" ? await getAdminRoleData(user.id) : null;
  return signToken({
    userId: user.id,
    phone: user.phone,
    role,
    ...(roleData ?? {}),
  });
}

/**
 * Check if the current session has ALL of the given permissions.
 * Super admins (with "*" permission) always pass.
 */
export function hasPermission(
  session: SessionPayload | null,
  ...requiredPermissions: string[]
): boolean {
  if (!session || session.role !== "ADMIN") return false;
  const perms = session.permissions ?? [];
  if (perms.includes("*")) return true;
  return requiredPermissions.every((p) => perms.includes(p));
}

/**
 * Check if the current session has ANY of the given permissions.
 */
export function hasAnyPermission(
  session: SessionPayload | null,
  ...permissions: string[]
): boolean {
  if (!session || session.role !== "ADMIN") return false;
  const perms = session.permissions ?? [];
  if (perms.includes("*")) return true;
  return permissions.some((p) => perms.includes(p));
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function isAdminEmail(email: string): boolean {
  return isEnvAdminEmail(email);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11)
    return "+234" + digits.slice(1);
  if (digits.startsWith("234")) return "+" + digits;
  return phone;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
