import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  linkPhoneToUser,
  formatPhone,
  signUserToken,
  setSessionCookie,
  consumePhoneOtp,
} from "@/lib/auth";
import { checkVerifyLimit } from "@/lib/rate-limit";
import { isValidNigerianPhone } from "@/lib/utils";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Not authenticated." },
        { status: 401 },
      );
    }

    const { phone: rawPhone, otp } = await req.json();

    if (!isValidNigerianPhone(rawPhone)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Nigerian phone number." },
        { status: 400 },
      );
    }

    const phone = formatPhone(rawPhone);

    // SECURITY: the caller must prove they control this phone with a code
    // sent to it (POST /api/auth/send-otp first). Without this anyone signed
    // in by email could attach — or merge into — someone else's account,
    // admins included.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (!checkVerifyLimit(phone, ip)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again in a few minutes." },
        { status: 429 },
      );
    }
    if (!(await consumePhoneOtp(phone, String(otp ?? "").trim()))) {
      return NextResponse.json(
        { success: false, error: "Enter the 6-digit code we sent to that number.", needsOtp: true },
        { status: 400 },
      );
    }

    const linked = await linkPhoneToUser(session.userId, phone);

    if (!linked) {
      // Phone is taken by another account. The caller has just proved they
      // own that phone (OTP above). If the current session is on a temp
      // email-only user, treat this as the user re-finding their original
      // phone-based account: merge the temp user's email onto the existing
      // account, drop the temp, and sign in as the existing user.
      const sessionUser = await db.user.findUnique({
        where: { id: session.userId },
      });
      const owner = await db.user.findFirst({ where: { phone } });

      if (
        sessionUser &&
        owner &&
        sessionUser.id !== owner.id &&
        sessionUser.phone === null
      ) {
        // Drop the temp user first: email is unique, so copying it onto the
        // owner while the temp row still holds it always failed. Only copy it
        // if the existing account has none, so a user-set address is kept.
        await db.$transaction(async (tx) => {
          await tx.user.delete({ where: { id: sessionUser.id } });
          if (!owner.email && sessionUser.email) {
            await tx.user.update({
              where: { id: owner.id },
              data: { email: sessionUser.email },
            });
          }
        });

        const merged = await db.user.findUnique({ where: { id: owner.id } });
        if (merged) {
          const token = await signUserToken(merged);
          await setSessionCookie(token);
        }

        return NextResponse.json({
          success: true,
          data: {
            message: "Welcome back! We linked this email to your existing account.",
            merged: true,
          },
        });
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "This phone number is already associated with another account. Please use a different number or log in with that phone.",
        },
        { status: 409 },
      );
    }

    // Re-sign token with the real phone
    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (user) {
      const token = await signUserToken(user);
      await setSessionCookie(token);
    }

    return NextResponse.json({
      success: true,
      data: { message: "Phone number linked successfully." },
    });
  } catch (err) {
    console.error("link-phone error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to link phone number." },
      { status: 500 },
    );
  }
}
