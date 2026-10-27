import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import { PERMISSIONS } from "@/lib/permissions";
import { insertMentions } from "@/lib/listening";
import { classifyPending } from "@/lib/listening/classify";

const manualSchema = z
  .object({
    text: z.string().min(3).max(4000),
    url: z.string().url().max(1000).optional(),
    authorHandle: z.string().max(100).optional(),
  })
  .strict();

// POST /api/admin/listening — log a post an admin spotted (Stories, WhatsApp
// status, TikTok…) so it gets classified and tracked like the rest.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, PERMISSIONS.LISTENING_MANAGE)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const parsed = manualSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { text, url, authorHandle } = parsed.data;
  const externalId = createHash("sha1").update(url ?? `${authorHandle}:${text}`).digest("hex");
  const inserted = await insertMentions([
    { source: "MANUAL", externalId, url, authorHandle, text, postedAt: new Date(), matchedTerm: "manual" },
  ]);
  if (inserted === 0) {
    return NextResponse.json({ success: false, error: "That post is already in the inbox." }, { status: 409 });
  }
  try {
    await classifyPending(20);
  } catch (err) {
    console.error("[api/admin/listening POST] classify failed", err);
  }
  const mention = await db.socialMention.findUnique({
    where: { source_externalId: { source: "MANUAL", externalId } },
  });
  await logAdminAction({
    adminId: session!.userId,
    action: "listening.manual_add",
    entityType: "social_mention",
    entityId: mention!.id,
  });
  return NextResponse.json({ success: true, data: mention }, { status: 201 });
}
