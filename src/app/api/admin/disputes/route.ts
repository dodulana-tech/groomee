import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { createRefund } from "@/lib/paystack";
import { z } from "zod";

// GET /api/admin/disputes
export async function GET() {
  try {
    await requireAdmin();
    const disputes = await db.dispute.findMany({
      include: {
        booking: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            groomer: true,
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
