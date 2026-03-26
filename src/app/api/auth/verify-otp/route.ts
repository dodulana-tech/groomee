import { NextRequest, NextResponse } from "next/server";
import {
  verifyOtp,
  signUserToken,
  setSessionCookie,
  formatPhone,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { checkVerifyLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { phone: rawPhone, otp } = await req.json();
    const phone = formatPhone(rawPhone);

    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP." },
        { status: 400 },
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkVerifyLimit(phone, ip)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 },
      );
    }

    const result = await verifyOtp(phone, otp);
    if (!result) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired code." },
        { status: 401 },
      );
    }

    const user = await db.user.findUnique({ where: { id: result.userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 },
      );
    }

    const token = await signUserToken(user);
    await setSessionCookie(token);

    // Refetch to get resolved role (signUserToken may upgrade CUSTOMER→PRO)
    const updatedUser = await db.user.findUnique({ where: { id: user.id } });

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        role: updatedUser?.role ?? user.role,
        isNewUser: !user.name,
      },
    });
  } catch (err) {
    console.error("verify-otp error:", err);
    return NextResponse.json(
      { success: false, error: "Verification failed." },
      { status: 500 },
    );
  }
}
