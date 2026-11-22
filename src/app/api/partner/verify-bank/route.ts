import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankNameForCode, resolveBankAccount } from "@/lib/banks";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/partner/verify-bank { bankCode, accountNumber }
// Resolves the account with Paystack and, on success, saves it as the pro's
// payout account (code + number + resolved holder name + verified stamp).
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const pro = await db.pro.findFirst({ where: { userId: session.userId }, select: { id: true } });
    if (!pro) return NextResponse.json({ success: false, error: "Partner profile not found." }, { status: 404 });

    if (!rateLimit(`bank-resolve:${session.userId}`, 10, 15 * 60 * 1000).success) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please wait a few minutes and try again." },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const bankCode = String(body.bankCode ?? "").trim();
    const accountNumber = String(body.accountNumber ?? "").replace(/\D/g, "");

    const result = await resolveBankAccount(accountNumber, bankCode);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const bankName = (await bankNameForCode(bankCode)) ?? bankCode;
    await db.pro.update({
      where: { id: pro.id },
      data: {
        bankCode,
        bankAccount: accountNumber,
        bankAccountNo: accountNumber,
        bankName,
        bankAccountName: result.accountName,
        bankVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      accountName: result.accountName,
      data: { accountName: result.accountName, bankName, bankCode, accountNumber },
    });
  } catch (err) {
    console.error("bank verify error:", err);
    return NextResponse.json({ success: false, error: "Verification failed. Please try again." }, { status: 500 });
  }
}
