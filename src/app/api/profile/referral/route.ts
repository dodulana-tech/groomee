import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/profile/referral — get referral link + stats
export async function GET() {
  try {
    const session = await requireSession();

    const referrals = await db.referral.findMany({
      where: { referrerId: session.userId },
      include: { referrer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const totalEarned = referrals.reduce(
      (sum: number, r: any) => sum + (r.bonusPaid ? r.bonusAmount : 0),
      0,
    );
    const pending = referrals.filter(
      (r: any) => r.referredUserId && !r.bonusPaid,
    ).length;

    const referralCode = session.userId.slice(-8).toUpperCase();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng";

    return NextResponse.json({
      success: true,
      data: {
        referralCode,
        referralLink: `${appUrl}/?ref=${referralCode}`,
        whatsappLink: `https://wa.me/?text=${encodeURIComponent(`Get professional grooming at home in Lagos! Use my code ${referralCode} for ₦2,000 off your first booking. Book at ${appUrl}/?ref=${referralCode}`)}`,
        totalReferrals: referrals.length,
        converted: referrals.filter((r: any) => r.referredUserId).length,
        totalEarned,
        pending,
        referrals: referrals.slice(0, 10),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}

// POST /api/profile/referral — track a referral when someone signs up with ref code
export async function POST(req: NextRequest) {
  try {
    const { referralCode, newUserId } = await req.json();
    if (!referralCode || !newUserId) {
      return NextResponse.json(
        { success: false, error: "Missing fields." },
        { status: 400 },
      );
    }

    // Referral code is last 8 chars of userId uppercased
    const referrer = await db.user.findFirst({
      where: { id: { endsWith: referralCode.toLowerCase() } },
    });

    if (!referrer || referrer.id === newUserId) {
      return NextResponse.json({ success: true }); // silently ignore invalid codes
    }

    const existing = await db.referral.findFirst({
      where: { referrerId: referrer.id, referredUserId: newUserId },
    });

    if (!existing) {
      const settings = await db.setting.findFirst({
        where: { key: "REFERRAL_CUSTOMER_BONUS" },
      });
      const bonus = parseFloat(settings?.value ?? "2000");

      await db.referral.create({
        data: {
          referrerId: referrer.id,
          referredPhone: "",
          referredUserId: newUserId,
          bonusAmount: bonus,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed." },
      { status: 500 },
    );
  }
}
