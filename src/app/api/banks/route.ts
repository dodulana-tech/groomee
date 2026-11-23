import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBanks } from "@/lib/banks";

// GET /api/banks — Nigerian banks with Paystack codes, for the application
// form and the partner profile. Any signed-in user (applicants are CUSTOMER).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const banks = await getBanks();
  return NextResponse.json({ success: true, data: banks });
}
