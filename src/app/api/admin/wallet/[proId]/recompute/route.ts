import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ledgerSum, getWallet } from "@/lib/wallet";
import { logAdminAction } from "@/lib/admin-audit";

// POST /api/admin/wallet/[proId]/recompute
//
// Forensic compare: sums every ledger row for the pro and reports the diff
// against the cached `available` on ProWallet. Read-only diagnostic — no
// auto-fix (admins must post a MANUAL_ADJUSTMENT if they want to heal drift).
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ proId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "wallet.view")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const { proId } = await params;
  const pro = await db.pro.findUnique({
    where: { id: proId },
    select: { id: true, name: true },
  });
  if (!pro) {
    return NextResponse.json(
      { success: false, error: "Pro not found" },
      { status: 404 },
    );
  }

  try {
    const [wallet, sum] = await Promise.all([
      getWallet(proId),
      ledgerSum(proId),
    ]);
    const cached = wallet?.available ?? 0;
    const drift = Math.round((cached - sum) * 100) / 100;

    await logAdminAction({
      adminId: session!.userId,
      action: "wallet.recompute",
      entityType: "wallet",
      entityId: proId,
      metadata: { proName: pro.name, cached, ledgerSum: sum, drift },
    });

    return NextResponse.json({
      success: true,
      data: {
        cached,
        ledgerSum: sum,
        drift,
        ok: Math.abs(drift) < 0.01,
      },
    });
  } catch (err) {
    console.error("wallet recompute error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to recompute" },
      { status: 500 },
    );
  }
}
