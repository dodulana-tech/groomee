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
