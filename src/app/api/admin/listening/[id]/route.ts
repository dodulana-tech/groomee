import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import { PERMISSIONS } from "@/lib/permissions";

const patchSchema = z
  .object({
    status: z.enum(["NEW", "IN_PROGRESS", "REPLIED", "IGNORED"]).optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();

// PATCH /api/admin/listening/:id — triage a mention.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!hasPermission(session, PERMISSIONS.LISTENING_MANAGE)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const existing = await db.socialMention.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  const { status, note } = parsed.data;
  const updated = await db.socialMention.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(status && status !== "NEW" ? { handledById: session!.userId, handledAt: new Date() } : {}),
    },
  });
  await logAdminAction({
    adminId: session!.userId,
    action: "listening.triage",
    entityType: "social_mention",
    entityId: id,
    metadata: { from: existing.status, to: updated.status },
  });
  return NextResponse.json({ success: true, data: updated });
}
