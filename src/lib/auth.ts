import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "./db";
import type { SessionPayload } from "@/types";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
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
  return Math.floor(100000 + Math.random() * 900000).toString();
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
  role: "CUSTOMER" | "ADMIN";
  isNewUser: boolean;
} | null> {
  // Find valid OTP
  const otpRecord = await db.otpCode.findFirst({
    where: {
      phone,
      code,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otpRecord) return null;

  // Mark OTP as used
  await db.otpCode.update({
    where: { id: otpRecord.id },
    data: { usedAt: new Date() },
  });

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
    role: user.role as "CUSTOMER" | "ADMIN",
    isNewUser,
  };
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
