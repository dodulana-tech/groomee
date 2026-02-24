import { NextRequest, NextResponse } from "next/server";
import { createOtp, formatPhone } from "@/lib/auth";
import { notifyCustomerOtp } from "@/lib/whatsapp";
import { isValidNigerianPhone } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { phone: rawPhone } = await req.json();
    const phone = formatPhone(rawPhone);

    if (!isValidNigerianPhone(rawPhone)) {
      return NextResponse.json(
        { success: false, error: "Invalid Nigerian phone number." },
        { status: 400 },
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
