// Pro-side helpers for the Earnings Reserve API surface.
//
// Always resolve the pro from the session, never from request input — every
// route here scopes data to the session-bound pro. Routes that need to act on
// a specific entity (e.g. cancel a withdrawal) still must assert ownership
// against `pro.id`.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export interface SessionPro {
  userId: string;
  proId: string;
}

export type SessionResult =
  | { ok: true; pro: SessionPro }
  | { ok: false; response: NextResponse };

export async function requireSessionPro(): Promise<SessionResult> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }
  if (session.role !== "PRO") {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      ),
    };
  }
  const pro = await db.pro.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!pro) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Pro not found" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, pro: { userId: session.userId, proId: pro.id } };
}
