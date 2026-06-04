import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { runSingleDebit } from "@/lib/benefits";
import { logAdminAction } from "@/lib/admin-audit";
import {
  notifyProBenefitDebitSuccess,
  notifyProBenefitInsufficientFunds,
} from "@/lib/whatsapp";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const result = await runSingleDebit(id);

  await logAdminAction({
    adminId: session!.userId,
    action: "benefits.debit_now",
    entityType: "enrolment",
    entityId: id,
    metadata: {
      status: result.status,
      amountDebited: result.amountDebited,
      newEnrolmentStatus: result.newEnrolmentStatus,
    },
  });

  // Notify pro on outcome.
  try {
    const enr = await db.proBenefitEnrollment.findUnique({
      where: { id },
      include: { pro: { select: { phone: true } }, plan: { select: { name: true } } },
    });
    if (enr?.pro?.phone && enr.plan?.name) {
      const now = new Date();
      const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      if (result.status === "SUCCESS") {
        await notifyProBenefitDebitSuccess(
          enr.pro.phone,
          enr.plan.name,
          result.amountDebited,
          period,
        );
      } else if (result.status === "INSUFFICIENT_FUNDS" && enr.graceUntil) {
        await notifyProBenefitInsufficientFunds(
          enr.pro.phone,
          enr.plan.name,
          result.amountDebited,
          enr.graceUntil,
        );
      }
    }
  } catch (err) {
    console.error("[benefits] debit-now notify failed", err);
  }

  return NextResponse.json({ success: true, data: result });
}
