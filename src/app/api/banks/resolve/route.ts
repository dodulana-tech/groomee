import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveBankAccount } from "@/lib/banks";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/banks/resolve { bankCode, accountNumber } → { accountName }
// Signed-in users only, rate limited (Paystack resolve is metered).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(`bank-resolve:${session.userId}`, 10, 15 * 60 * 1000).success) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const accountNumber = String(body.accountNumber ?? "").replace(/\D/g, "");
  const bankCode = String(body.bankCode ?? "").trim();
  const result = await resolveBankAccount(accountNumber, bankCode);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: { accountName: result.accountName } });
}
