import { NextRequest, NextResponse } from "next/server";
import {
  verifyOtp,
  signToken,
  setSessionCookie,
  formatPhone,
} from "@/lib/auth";
import { db } from "@/lib/db";

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

    const token = await signToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        role: user.role,
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
