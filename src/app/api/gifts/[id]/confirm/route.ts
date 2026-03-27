import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { verifyTransaction } from "@/lib/paystack";
import { sendMessage } from "@/lib/whatsapp";
import { formatNaira } from "@/lib/utils";
import { format } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!ref) return NextResponse.redirect(`${appUrl}/?error=gift_failed`);

  try {
    // Auth: verify caller is the gift sender
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.redirect(`${appUrl}/auth`);
    }

    const txData = await verifyTransaction(ref);

    if (txData.status !== "success") {
      return NextResponse.redirect(`${appUrl}/gift?error=payment_failed`);
    }

    const giftCard = await db.giftCard.findUnique({
      where: { id },
    });

    if (!giftCard || giftCard.senderId !== session.userId) {
      return NextResponse.redirect(`${appUrl}/?error=not_found`);
    }

    const expiryStr = format(new Date(giftCard.expiresAt), "do MMMM yyyy");

    // Idempotency: only send the notification once (isRedeemed doubles as "notification sent")
    if (!giftCard.isRedeemed) {
      const msg = `🎁 *You've received a Groomee gift!*

${giftCard.message ? `"${giftCard.message}"\n\n` : ""}Your gift code: *${giftCard.code}*
Value: *${formatNaira(giftCard.amount)}*
Valid until: ${expiryStr}

Redeem at: ${appUrl}

Enjoy your glow-up! 💅🏿`;

      await sendMessage(giftCard.recipientPhone, msg);
    }

    return NextResponse.redirect(
      `${appUrl}/gift?success=true&code=${giftCard.code}`,
    );
  } catch (err) {
    console.error("gift confirm error:", err);
    return NextResponse.redirect(`${appUrl}/gift?error=failed`);
  }
}
