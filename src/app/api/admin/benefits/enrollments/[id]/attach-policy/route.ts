import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { attachExternalPolicy } from "@/lib/benefits";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  if (typeof body.externalPolicyNo !== "string" || !body.externalPolicyNo.trim()) {
    return NextResponse.json(
      { success: false, error: "externalPolicyNo required" },
      { status: 400 },
    );
  }
  const updated = await attachExternalPolicy(
    id,
    body.externalPolicyNo.trim(),
    session!.userId,
  );
  return NextResponse.json({ success: true, data: updated });
}
