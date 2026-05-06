import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

// GET /api/admin/notes?entityType=booking&entityId=xxx
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "notes.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  if (!entityType || !entityId) {
    return NextResponse.json(
      { success: false, error: "entityType and entityId are required" },
      { status: 400 },
    );
  }
  const notes = await db.note.findMany({
    where: { entityType, entityId },
    include: { author: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: notes });
}

// POST /api/admin/notes  { entityType, entityId, content }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "notes.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { entityType, entityId, content } = await req.json();
  if (!entityType || !entityId || typeof content !== "string" || !content.trim()) {
    return NextResponse.json(
      { success: false, error: "entityType, entityId, and content are required" },
      { status: 400 },
    );
  }
  const note = await db.note.create({
    data: {
      entityType,
      entityId,
      authorId: session!.userId,
      content: content.trim(),
    },
    include: { author: { select: { id: true, name: true, phone: true, email: true } } },
  });
  await logAdminAction({
    adminId: session!.userId,
    action: "note.create",
    entityType,
    entityId,
    metadata: { noteId: note.id },
  });
  return NextResponse.json({ success: true, data: note });
}
