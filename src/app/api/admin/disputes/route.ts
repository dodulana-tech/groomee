import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRefund } from "@/lib/paystack";
import { z } from "zod";

// GET /api/admin/disputes
export async function GET() {
  try {
    const session = await getSession();
    if (!hasPermission(session, "disputes.view")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const disputes = await db.dispute.findMany({
      include: {
        booking: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            pro: true,
            service: true,
            payment: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: disputes });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}
