import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { bankCode, accountNumber } = await req.json();

    if (!bankCode || !accountNumber) {
      return NextResponse.json({ error: "bankCode and accountNumber are required" }, { status: 400 });
    }

    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
    );
    const data = await res.json();

    if (!data.status) {
      return NextResponse.json({ error: data.message ?? "Could not verify account" }, { status: 400 });
    }

    return NextResponse.json({ success: true, accountName: data.data.account_name });
  } catch (err) {
    console.error("bank verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
