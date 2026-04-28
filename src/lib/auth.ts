import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "./db";
import type { SessionPayload } from "@/types";
import "./env";

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

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionFromRequest(
  req: NextRequest,
): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
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

export async function createOtp(
  phone: string,
): Promise<{ otp: string; userId: string }> {
  // Upsert user by phone
  const user = await db.user.upsert({
    where: { phone },
    update: {},
    create: { phone, role: isAdmin(phone) ? "ADMIN" : "CUSTOMER" },
  });

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

  return { otp, userId: user.id };
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

  // Find or create user
  const existingUser = await db.user.findUnique({ where: { phone } });
  const isNewUser = !existingUser?.name;

  const user = await db.user.upsert({
    where: { phone },
    update: {},
    create: { phone, role: isAdmin(phone) ? "ADMIN" : "CUSTOMER" },
  });

  return {
    userId: user.id,
    role: user.role as "CUSTOMER" | "ADMIN" | "PRO",
    isNewUser,
  };
}

// ─── EMAIL OTP ───────────────────────────────────────────────────────────────

const TEMP_PHONE_PREFIX = "+234_email_";

// Prefer a fully linked user (real phone) over an email-only temp user when
// the same email exists on multiple records.
async function findUserByEmailPreferLinked(email: string) {
  return (
    (await db.user.findFirst({
      where: { email, NOT: { phone: { startsWith: TEMP_PHONE_PREFIX } } },
    })) ?? (await db.user.findFirst({ where: { email } }))
  );
}

export async function createOtpByEmail(
  email: string,
): Promise<{ otp: string; userId: string; isNewUser: boolean }> {
  let user = await findUserByEmailPreferLinked(email);
  const isNewUser = !user;

  if (!user) {
    // Create a temporary user with a placeholder phone
    // The real phone will be collected after email verification
    const tempPhone = `${TEMP_PHONE_PREFIX}${Date.now()}`;
    user = await db.user.create({
      data: { phone: tempPhone, email, role: "CUSTOMER" },
    });
  }

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

  return { otp, userId: user.id, isNewUser };
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

  const user = await findUserByEmailPreferLinked(email);
  if (!user) return null;

  const isNewUser = !user.name;
  // Check if this user has a real phone number (not the temp placeholder)
  const needsPhone = user.phone.startsWith(TEMP_PHONE_PREFIX);

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
  phone: string;
  role: string;
}): Promise<string> {
  let role = user.role as "CUSTOMER" | "ADMIN" | "PRO";

  // If role is CUSTOMER, check if this user has an approved Pro record
  if (role === "CUSTOMER") {
    const pro = await db.pro.findFirst({
      where: {
        OR: [{ userId: user.id }, { phone: user.phone }],
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

function isAdmin(phone: string): boolean {
  const adminPhones = (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => p.trim());
  return adminPhones.includes(phone);
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
