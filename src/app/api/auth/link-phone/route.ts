import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  linkPhoneToUser,
  formatPhone,
  signUserToken,
  setSessionCookie,
} from "@/lib/auth";
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

    const { phone: rawPhone } = await req.json();

    if (!isValidNigerianPhone(rawPhone)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Nigerian phone number." },
        { status: 400 },
      );
    }

    const phone = formatPhone(rawPhone);
    const linked = await linkPhoneToUser(session.userId, phone);

    if (!linked) {
      // Phone is taken by another account. If the current session is on a
      // temp email-only user, treat this as the user re-finding their original
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
        // Only copy the email over if the existing account doesn't already have one,
        // so we never silently overwrite a user-set address.
        if (!owner.email && sessionUser.email) {
          await db.user.update({
            where: { id: owner.id },
            data: { email: sessionUser.email },
          });
        }
        await db.user.delete({ where: { id: sessionUser.id } });

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
