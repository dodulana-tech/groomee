import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateSurcharge, calculateEarnings } from "@/lib/surcharge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  const isAsap = searchParams.get("asap") === "true";
  const scheduledFor = searchParams.get("scheduledFor");

  if (!serviceId) {
    return NextResponse.json(
      { success: false, error: "serviceId required." },
      { status: 400 },
    );
  }

  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    return NextResponse.json(
      { success: false, error: "Service not found." },
      { status: 404 },
    );
  }

  const scheduled = scheduledFor ? new Date(scheduledFor) : null;
  const surcharge = await calculateSurcharge(
    isAsap ? null : scheduled,
    service.basePrice,
  );
  const { totalAmount, platformFee, groomerEarning } = calculateEarnings({
    baseAmount: service.basePrice,
    surchargeAmount: surcharge.amount,
    surchargeType: surcharge.type,
    commissionRate: 0.2,
  });

  return NextResponse.json({
    success: true,
    data: {
      baseAmount: service.basePrice,
      surcharge,
      totalAmount,
      breakdown: {
        serviceFee: service.basePrice,
        surchargeAmount: surcharge.amount,
        surchargeLabel: surcharge.label,
        platformFee: 0, // shown as free to customer
        total: totalAmount,
      },
    },
  });
}
