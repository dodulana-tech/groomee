import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, setSessionCookie, signUserToken } from "@/lib/auth";

// POST /api/applications/pro/session — re-issue the session after approval.
// Applicants signed in as CUSTOMER; signUserToken upgrades them to PRO once
// their Pro row is ACTIVE, so they can open the portal without a fresh OTP.
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, phone: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const token = await signUserToken(user);
  await setSessionCookie(token);
  const refreshed = await db.user.findUnique({ where: { id: user.id }, select: { role: true } });
  const role = refreshed?.role ?? user.role;
  return NextResponse.json({ success: true, data: { role, isPro: role === "PRO" || role === "ADMIN" } });
}
