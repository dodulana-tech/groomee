import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import { PERMISSIONS } from "@/lib/permissions";

const patchSchema = z.object({ active: z.boolean() }).strict();

// PATCH /api/admin/listening/terms/:id — pause / resume a term.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!hasPermission(session, PERMISSIONS.LISTENING_MANAGE)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
  }
  const term = await db.listeningTerm.findUnique({ where: { id } });
  if (!term) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  if (parsed.data.active && term.kind === "HASHTAG" && !term.active) {
    const active = await db.listeningTerm.count({ where: { kind: "HASHTAG", active: true } });
    if (active >= 25) {
      return NextResponse.json({ success: false, error: "25 active hashtags max." }, { status: 409 });
    }
  }
  const updated = await db.listeningTerm.update({ where: { id }, data: { active: parsed.data.active } });
  await logAdminAction({
    adminId: session!.userId,
    action: parsed.data.active ? "listening.term_resume" : "listening.term_pause",
    entityType: "listening_term",
    entityId: id,
  });
  return NextResponse.json({ success: true, data: updated });
}

// DELETE /api/admin/listening/terms/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!hasPermission(session, PERMISSIONS.LISTENING_MANAGE)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const term = await db.listeningTerm.findUnique({ where: { id } });
  if (!term) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  await db.listeningTerm.delete({ where: { id } });
  await logAdminAction({
    adminId: session!.userId,
    action: "listening.term_delete",
    entityType: "listening_term",
    entityId: id,
    metadata: { term: term.term, kind: term.kind },
  });
  return NextResponse.json({ success: true });
}
