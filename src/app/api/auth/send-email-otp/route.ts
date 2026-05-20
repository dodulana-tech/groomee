import { NextRequest, NextResponse } from "next/server";
import { createOtpByEmail, isAdminEmail, isValidEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkSendLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email, purpose } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const normalised = email.toLowerCase().trim();

    // For admin sign-in, refuse to send the OTP unless the email is whitelisted
    // (env list) or already attached to an existing admin user. Avoids burning
    // an OTP on an address that will fail the role check after verify.
    if (purpose === "admin") {
      const allowed =
        isAdminEmail(normalised) ||
        Boolean(
          await db.user.findFirst({
            where: { email: normalised, role: "ADMIN" },
            select: { id: true },
          }),
        );
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: "This email does not have admin access." },
          { status: 403 },
        );
      }
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkSendLimit(normalised, ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again in a few minutes." },
        { status: 429 },
      );
    }

    const { otp } = await createOtpByEmail(normalised);

    // Send OTP via email (ZeptoMail) or log in dev
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Email OTP for ${email}: ${otp}`);
    } else if (process.env.SMTP_USER) {
      const { sendEmail } = await import("@/lib/email");
      const { otpEmail } = await import("@/lib/email-templates");
      const { subject, html } = otpEmail(otp);
      await sendEmail({ to: email, subject, html }).catch((err) =>
        console.error("Email send error:", err),
      );
    } else {
      console.warn(`[WARN] No SMTP_USER set — email OTP for ${email} not delivered`);
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
