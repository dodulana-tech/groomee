import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  initializeTransaction,
  generatePaymentReference,
} from "@/lib/paystack";
import { sendMessage } from "@/lib/whatsapp";
import { addDays } from "date-fns";
import { z } from "zod";
import crypto from "crypto";

const sendGiftSchema = z.object({
  recipientPhone: z.string().min(10),
  recipientName: z.string().optional(),
  message: z.string().max(500).optional(),
  serviceId: z.string().optional(), // specific service or leave null for any
  amount: z.number().min(5000).max(200000),
});

const redeemSchema = z.object({
  code: z.string().length(12),
  bookingId: z.string(),
});

// GET /api/gifts — list sent/received gift cards
export async function GET() {
  try {
    const session = await requireSession();
    const sent = await db.giftCard.findMany({
      where: { senderId: session.userId },
      include: { sender: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: { sent } });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}

// POST /api/gifts — send a gift card
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const input = sendGiftSchema.parse(body);

    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user)
      return NextResponse.json(
        { success: false, error: "Not found." },
        { status: 404 },
      );

    const expiryDays = 180;
    const code = crypto.randomBytes(6).toString("hex").toUpperCase(); // 12-char code

    const settings = await db.setting.findFirst({
      where: { key: "GIFT_CARD_EXPIRY_DAYS" },
    });
    const expiresAt = addDays(new Date(), parseInt(settings?.value ?? "180"));

    const giftCard = await db.giftCard.create({
      data: {
        code,
        senderId: session.userId,
        recipientPhone: input.recipientPhone,
        recipientName: input.recipientName,
        message: input.message,
        serviceId: input.serviceId,
        amount: input.amount,
        expiresAt,
      },
    });

    // Initialize payment for the gift card value
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const ref = generatePaymentReference(`GIFT-${code}`);
    const paystack = await initializeTransaction({
      email: user.email ?? `${user.phone.replace(/\+/g, "")}@groomee.ng`,
      phone: user.phone,
      amount: input.amount,
      reference: ref,
      callbackUrl: `${appUrl}/api/gifts/${giftCard.id}/confirm?ref=${ref}`,
      metadata: { type: "gift", giftCardId: giftCard.id },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          giftCardId: giftCard.id,
          code,
          authorizationUrl: paystack.authorization_url,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to send gift." },
      { status: 500 },
    );
  }
}
