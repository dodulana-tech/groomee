import { NextRequest, NextResponse } from "next/server";
import { verifyOtpByEmail, signUserToken, setSessionCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkVerifyLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required." },
        { status: 400 },
      );
    }

    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { success: false, error: "Invalid code." },
        { status: 400 },
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkVerifyLimit(email, ip)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 },
      );
    }

    const result = await verifyOtpByEmail(email.toLowerCase().trim(), otp);
    if (!result) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired code." },
        { status: 401 },
      );
    }

    // Fetch user to get actual phone (may be temp placeholder if registered via email)
    const user = await db.user.findUnique({ where: { id: result.userId } });
    const token = await signUserToken({
      id: result.userId,
      phone: user?.phone ?? "",
      role: user?.role ?? result.role,
    });
    await setSessionCookie(token);

    // Refetch to get resolved role (signUserToken may upgrade CUSTOMER→PRO)
    const updatedUser = await db.user.findUnique({ where: { id: result.userId } });

    return NextResponse.json({
      success: true,
      data: {
        userId: result.userId,
        role: updatedUser?.role ?? result.role,
        isNewUser: result.isNewUser,
        needsPhone: result.needsPhone,
      },
    });
  } catch (err) {
    console.error("verify-email-otp error:", err);
    return NextResponse.json(
      { success: false, error: "Verification failed." },
      { status: 500 },
    );
  }
}
