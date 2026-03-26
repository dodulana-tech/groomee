import { NextRequest, NextResponse } from "next/server";
import { createOtpByEmail, isValidEmail } from "@/lib/auth";
import { checkSendLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkSendLimit(email, ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again in a few minutes." },
        { status: 429 },
      );
    }

    const { otp } = await createOtpByEmail(email.toLowerCase().trim());

    // Send OTP via email (Resend) or log in dev
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Email OTP for ${email}: ${otp}`);
    } else if (process.env.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "Groomee <noreply@groomee.ng>",
          to: email,
          subject: `Your Groomee verification code: ${otp}`,
          html: `<p>Your verification code is: <strong>${otp}</strong></p><p>Valid for 10 minutes. Do not share this code.</p><p>— The Groomee Team 💚</p>`,
        }),
      }).catch((err) => console.error("Resend email error:", err));
    } else {
      console.warn(`[WARN] No RESEND_API_KEY set — email OTP for ${email} not delivered`);
    }

    return NextResponse.json({
      success: true,
      data: { message: "Verification code sent to your email." },
    });
  } catch (err) {
    console.error("send-email-otp error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to send verification code." },
      { status: 500 },
    );
  }
}
