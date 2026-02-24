import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { code, bookingId } = await req.json();

    if (!code)
      return NextResponse.json(
        { success: false, error: "Gift code required." },
        { status: 400 },
      );

    const giftCard = await db.giftCard.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!giftCard)
      return NextResponse.json(
        { success: false, error: "Invalid gift code." },
        { status: 404 },
      );
    if (giftCard.isRedeemed)
      return NextResponse.json(
        { success: false, error: "This gift card has already been used." },
        { status: 400 },
      );
    if (new Date() > new Date(giftCard.expiresAt))
      return NextResponse.json(
        { success: false, error: "This gift card has expired." },
        { status: 400 },
      );

    await db.giftCard.update({
      where: { id: giftCard.id },
      data: {
        isRedeemed: true,
        redeemedAt: new Date(),
        redeemedBy: session.userId,
        bookingId: bookingId ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        amount: giftCard.amount,
        serviceId: giftCard.serviceId,
        message: `Gift card applied! ₦${giftCard.amount.toLocaleString()} credit added.`,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed." },
      { status: 500 },
    );
  }
}
