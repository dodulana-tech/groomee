import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import { PERMISSIONS } from "@/lib/permissions";

const createSchema = z
  .object({
    term: z.string().trim().min(2).max(80),
    kind: z.enum(["BRAND", "COMPETITOR", "LEAD", "HASHTAG"]),
    competitor: z.string().trim().max(80).optional(),
  })
  .strict();

// POST /api/admin/listening/terms — track a new term.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, PERMISSIONS.LISTENING_MANAGE)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { kind, competitor } = parsed.data;
  const term = kind === "HASHTAG" ? parsed.data.term.replace(/^#/, "").toLowerCase() : parsed.data.term;

  if (kind === "HASHTAG") {
    // Meta allows 30 unique hashtag searches per rolling 7 days; the
    // connector uses the first 25 active ones.
    const active = await db.listeningTerm.count({ where: { kind: "HASHTAG", active: true } });
    if (active >= 25) {
      return NextResponse.json(
        { success: false, error: "25 hashtags max (Instagram allows 30 unique searches per week). Pause one first." },
        { status: 409 },
      );
    }
  }

  const exists = await db.listeningTerm.findUnique({ where: { term_kind: { term, kind } } });
  if (exists) {
    return NextResponse.json({ success: false, error: "Already tracked." }, { status: 409 });
  }
  const created = await db.listeningTerm.create({
    data: { term, kind, competitor: kind === "COMPETITOR" ? competitor || term : null },
  });
  await logAdminAction({
    adminId: session!.userId,
    action: "listening.term_add",
    entityType: "listening_term",
    entityId: created.id,
    metadata: { term, kind },
  });
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
