import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import { postMovement } from "@/lib/wallet";
import {
  createTransferRecipient,
  initiateTransfer,
} from "@/lib/paystack";
import { notifyProAdvanceDisbursed } from "@/lib/whatsapp";

// POST /api/admin/advances/[id]
//
// Body: { action: "approve" | "reject" | "repay" | "disburse" | "disburse_paystack", adminNote?: string }
//   - approve: PENDING → APPROVED, advance is now scheduled to pay out
//   - reject:  PENDING → REJECTED, requires adminNote
//   - disburse: APPROVED → DISBURSED — posts ADVANCE_DISBURSED to wallet
//               (admin will pay externally, this records the receivable)
//   - disburse_paystack: APPROVED → DISBURSED — initiates a Paystack
//                        transfer to the pro's bank AND posts the wallet row
//   - repay:   DISBURSED → REPAID, manually mark as recouped
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

    const VALID_ACTIONS = ["approve", "reject", "repay", "disburse", "disburse_paystack"];
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, error: "Unknown action" },
        { status: 400 },
      );
    }

    const advance = await db.proAdvance.findUnique({
      where: { id },
      include: {
        pro: {
          select: {
            id: true,
            name: true,
            phone: true,
            bankAccount: true,
            bankName: true,
          },
        },
      },
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
    if ((action === "disburse" || action === "disburse_paystack") && advance.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: `Cannot disburse from status ${advance.status}` },
        { status: 400 },
      );
    }
    if (action === "repay" && advance.status !== "DISBURSED" && advance.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: `Cannot mark repaid from status ${advance.status}` },
        { status: 400 },
      );
    }

    let newStatus: string;
    switch (action) {
      case "approve":
        newStatus = "APPROVED";
        break;
      case "reject":
        newStatus = "REJECTED";
        break;
      case "disburse":
      case "disburse_paystack":
        newStatus = "DISBURSED";
        break;
      case "repay":
      default:
        newStatus = "REPAID";
    }

    // ─── Paystack transfer (optional) ──────────────────────────────────────
    let transferRef: string | null = null;
    if (action === "disburse_paystack") {
      if (!advance.pro.bankAccount || !advance.pro.bankName) {
        return NextResponse.json(
          { success: false, error: "Pro bank details are missing — cannot initiate transfer." },
          { status: 400 },
        );
      }
      try {
        const recipientCode = await createTransferRecipient({
          accountName: advance.pro.name,
          accountNumber: advance.pro.bankAccount,
          bankCode: advance.pro.bankName,
        });
        transferRef = `ADV-${id.slice(-8)}-${Date.now()}`;
        await initiateTransfer({
          amount: advance.amount,
          recipientCode,
          reason: `Groomee advance disbursement ${id}`,
          reference: transferRef,
        });
      } catch (err) {
        console.error("advance paystack transfer failed", err);
        const reason = err instanceof Error ? err.message : "Paystack call failed";
        return NextResponse.json(
          { success: false, error: `Paystack transfer failed: ${reason}` },
          { status: 502 },
        );
      }
    }

    const updated = await db.proAdvance.update({
      where: { id },
      data: { status: newStatus },
      include: { pro: { select: { id: true, name: true, phone: true } } },
    });

    // ─── Wallet posting on DISBURSED ───────────────────────────────────────
    if (action === "disburse" || action === "disburse_paystack") {
      try {
        await postMovement({
          proId: advance.proId,
          type: "ADVANCE_DISBURSED",
          amount: Math.abs(advance.amount),
          advanceId: id,
          note:
            transferRef
              ? `Advance disbursed via Paystack (${transferRef})`
              : `Advance disbursed (manual settlement)`,
          idempotencyKey: `advance:${id}:DISBURSED`,
        });
        if (advance.pro.phone) {
          notifyProAdvanceDisbursed(advance.pro.phone, advance.amount).catch((err) => {
            console.error("[advance.disburse] notify failed", err);
          });
        }
      } catch (err) {
        // We've already mutated state — log loud and continue. Manual repair
        // is the wallet ADJUSTMENT form.
        console.error("[advance.disburse] wallet post failed", err);
      }
    }

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
        ...(transferRef ? { transferRef } : {}),
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
