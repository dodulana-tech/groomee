import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

// Groomers authenticate via their phone — passed as header from WhatsApp webhook context
// For web usage: identify by phone query param + simple token (MVP approach)
// In production: add proper groomer JWT auth

const advanceSchema = z.object({
  groomerId: z.string(), // groomer ID (passed from admin context or WhatsApp webhook)
  amount: z.number().min(5000),
  reason: z.string().min(10).max(500),
});

// POST /api/groomer/advance — request advance
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { groomerId, amount, reason } = advanceSchema.parse(body);

    const groomer = await db.groomer.findUnique({
      where: { id: groomerId, status: "ACTIVE" },
    });

    if (!groomer) {
      return NextResponse.json(
        { success: false, error: "Groomer not found." },
        { status: 404 },
      );
    }

    // Eligibility checks
    const settings = await db.setting.findMany({
      where: {
        key: {
          in: ["ADVANCE_MAX_AMOUNT", "ADVANCE_MIN_JOBS", "ADVANCE_MIN_RATING"],
        },
      },
    });
    const settingsMap = Object.fromEntries(
      settings.map((s) => [s.key, s.value]),
    );
    const maxAmount = parseFloat(settingsMap.ADVANCE_MAX_AMOUNT ?? "30000");
    const minJobs = parseInt(settingsMap.ADVANCE_MIN_JOBS ?? "10");
    const minRating = parseFloat(settingsMap.ADVANCE_MIN_RATING ?? "4.0");

    if (groomer.totalJobs < minJobs) {
      return NextResponse.json(
        {
          success: false,
          error: `You need at least ${minJobs} completed jobs to request an advance. You have ${groomer.totalJobs}.`,
        },
        { status: 400 },
      );
    }

    if (groomer.avgRating < minRating) {
      return NextResponse.json(
        {
          success: false,
          error: `Your rating must be at least ${minRating} to request an advance. Yours is ${groomer.avgRating.toFixed(1)}.`,
        },
        { status: 400 },
      );
    }

    if (amount > maxAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum advance is ₦${maxAmount.toLocaleString()}.`,
        },
        { status: 400 },
      );
    }

    // Check no pending advance
    const pendingAdvance = await db.groomerAdvance.findFirst({
      where: {
        groomerId,
        status: { in: ["PENDING", "APPROVED", "DISBURSED"] },
      },
    });

    if (pendingAdvance) {
      return NextResponse.json(
        {
          success: false,
          error: "You already have an outstanding advance. Repay it first.",
        },
        { status: 400 },
      );
    }

    const advance = await db.groomerAdvance.create({
      data: { groomerId, amount, reason },
    });

    // Notify admin via WhatsApp (optional)
    const adminPhones = (process.env.ADMIN_PHONES ?? "")
      .split(",")
      .filter(Boolean);
    if (adminPhones.length > 0) {
      const { sendMessage } = await import("@/lib/whatsapp");
      await sendMessage(
        adminPhones[0].trim(),
        `💰 *Advance Request*\n\nGroomer: ${groomer.name}\nAmount: ₦${amount.toLocaleString()}\nReason: ${reason}\n\nReview at admin.groomee.ng/admin/advances`,
      );
    }

    return NextResponse.json({ success: true, data: advance }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed." },
      { status: 500 },
    );
  }
}

// GET /api/groomer/advance — get advance history for a groomer
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groomerId = searchParams.get("groomerId");
  if (!groomerId)
    return NextResponse.json(
      { success: false, error: "groomerId required." },
      { status: 400 },
    );

  const advances = await db.groomerAdvance.findMany({
    where: { groomerId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: advances });
}
