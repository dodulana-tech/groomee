import { NextRequest, NextResponse } from "next/server";
import { createOtp, formatPhone } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyCustomerOtp } from "@/lib/whatsapp";
import { isValidNigerianPhone } from "@/lib/utils";
import { checkSendLimit } from "@/lib/rate-limit";

function isAdminPhoneEnv(phone: string): boolean {
  return (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .includes(phone);
}

export async function POST(req: NextRequest) {
  try {
    const { phone: rawPhone, purpose } = await req.json();
    const phone = formatPhone(rawPhone);

    if (!isValidNigerianPhone(rawPhone)) {
      return NextResponse.json(
        { success: false, error: "Invalid Nigerian phone number." },
        { status: 400 },
      );
    }

    // For admin sign-in, refuse to send the OTP unless the phone is whitelisted
    // (env list) or already attached to an existing admin user.
    if (purpose === "admin") {
      const allowed =
        isAdminPhoneEnv(phone) ||
        Boolean(
          await db.user.findFirst({
            where: { phone, role: "ADMIN" },
            select: { id: true },
          }),
        );
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: "This phone number does not have admin access." },
          { status: 403 },
        );
      }
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkSendLimit(phone, ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again in a few minutes." },
        { status: 429 },
      );
    }

    const { otp } = await createOtp(phone);

    // In dev, log OTP instead of sending
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
    } else {
      await notifyCustomerOtp(phone, otp);
    }

    return NextResponse.json({ success: true, data: { message: "OTP sent." } });
  } catch (err) {
    console.error("send-otp error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to send OTP." },
      { status: 500 },
    );
  }
}
