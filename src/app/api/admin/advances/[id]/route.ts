import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

// POST /api/admin/advances/[id]
//
// Body: { action: "approve" | "reject" | "repay", adminNote?: string }
//   - approve: PENDING → APPROVED, advance is now scheduled to pay out
//   - reject:  PENDING → REJECTED, requires adminNote
//   - repay:   APPROVED → REPAID, manually mark as recouped
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!hasPermission(session, "advances.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { action, adminNote } = await req.json();

    if (!["approve", "reject", "repay"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Unknown action" },
        { status: 400 },
      );
    }

    const advance = await db.proAdvance.findUnique({
      where: { id },
      include: { pro: { select: { id: true, name: true } } },
    });
    if (!advance) {
      return NextResponse.json({ success: false, error: "Advance not found" }, { status: 404 });
    }

    if (action === "approve" && advance.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: `Cannot approve from status ${advance.status}` },
        { status: 400 },
      );
    }
    if (action === "reject") {
      if (advance.status !== "PENDING") {
        return NextResponse.json(
          { success: false, error: `Cannot reject from status ${advance.status}` },
          { status: 400 },
        );
      }
      if (!adminNote?.trim()) {
        return NextResponse.json(
          { success: false, error: "Please provide a reason for rejection." },
          { status: 400 },
        );
      }
    }
    if (action === "repay" && advance.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: `Cannot mark repaid from status ${advance.status}` },
        { status: 400 },
      );
    }

    const newStatus =
      action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "REPAID";

    const updated = await db.proAdvance.update({
      where: { id },
      data: { status: newStatus },
      include: { pro: { select: { id: true, name: true, phone: true } } },
    });

    // Persist the admin note as a Note attached to the advance, since the
    // ProAdvance model doesn't have a notes column.
    if (adminNote?.trim()) {
      await db.note.create({
        data: {
          entityType: "advance",
          entityId: id,
          authorId: session!.userId,
          content: adminNote.trim(),
        },
      });
    }

    await logAdminAction({
      adminId: session!.userId,
      action: `advance.${action}`,
      entityType: "advance",
      entityId: id,
      metadata: {
        proId: advance.proId,
        proName: advance.pro.name,
        amount: advance.amount,
        fromStatus: advance.status,
        toStatus: newStatus,
        ...(adminNote ? { adminNote } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("advance action error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to process advance" },
      { status: 500 },
    );
  }
}
