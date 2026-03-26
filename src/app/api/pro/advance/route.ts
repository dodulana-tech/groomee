import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const advanceSchema = z.object({
  amount: z.number().min(5000),
  reason: z.string().min(10).max(500),
});

// POST /api/pro/advance - request advance (authenticated)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { amount, reason } = advanceSchema.parse(body);

    // Find pro by session phone — only the pro themselves can request
    const pro = await db.pro.findFirst({
      where: { phone: session.phone, status: "ACTIVE" },
    });

    if (!pro) {
      return NextResponse.json(
        { success: false, error: "Pro not found or not active." },
        { status: 404 },
      );
    }

    const proId = pro.id;

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

    if (pro.totalJobs < minJobs) {
      return NextResponse.json(
        {
          success: false,
          error: `You need at least ${minJobs} completed jobs to request an advance. You have ${pro.totalJobs}.`,
        },
        { status: 400 },
      );
    }

    if (pro.avgRating < minRating) {
      return NextResponse.json(
        {
          success: false,
          error: `Your rating must be at least ${minRating} to request an advance. Yours is ${pro.avgRating.toFixed(1)}.`,
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
    const pendingAdvance = await db.proAdvance.findFirst({
      where: {
        proId,
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

    const advance = await db.proAdvance.create({
      data: { proId, amount, reason },
    });

    // Notify admin via WhatsApp (optional)
    const adminPhones = (process.env.ADMIN_PHONES ?? "")
      .split(",")
      .filter(Boolean);
    if (adminPhones.length > 0) {
      const { sendMessage } = await import("@/lib/whatsapp");
      await sendMessage(
        adminPhones[0].trim(),
        `💰 *Advance Request*\n\nPro: ${pro.name}\nAmount: ₦${amount.toLocaleString()}\nReason: ${reason}\n\nReview at admin.groomee.ng/admin/advances`,
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

// GET /api/pro/advance - get advance history (authenticated)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const pro = await db.pro.findFirst({ where: { phone: session.phone } });
  if (!pro) {
    return NextResponse.json(
      { success: false, error: "Pro not found." },
      { status: 404 },
    );
  }

  const advances = await db.proAdvance.findMany({
    where: { proId: pro.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: advances });
}
