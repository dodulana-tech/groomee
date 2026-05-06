/**
 * Edge-runtime-safe slice of auth. Imports nothing that touches Prisma so it
 * can be used from middleware. JWT verification only — DB-backed revocation
 * checks remain in `auth.ts` (Node runtime, used by RSC and route handlers).
 */
import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import type { SessionPayload } from "@/types";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE_NAME = "groomee_session";

export async function verifyTokenEdge(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSessionFromRequestEdge(
  req: NextRequest,
): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyTokenEdge(token);
}
