import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "advances.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(
    { error: "Advances not yet implemented" },
    { status: 501 },
  );
}

export async function PATCH() {
  const session = await getSession();
  if (!hasPermission(session, "advances.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(
    { error: "Advances not yet implemented" },
    { status: 501 },
  );
}
