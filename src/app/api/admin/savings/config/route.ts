import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { loadSavingsSettings, saveSavingsSettings } from "@/lib/savings";
import { logAdminAction } from "@/lib/admin-audit";

// GET /api/admin/savings/config — read current settings
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "savings.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  try {
    const settings = await loadSavingsSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (err) {
    console.error("[savings/config GET] error", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// PUT /api/admin/savings/config — update settings
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "savings.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const next = await saveSavingsSettings(body);
    await logAdminAction({
      adminId: session!.userId,
      action: "savings.config_update",
      entityType: "savings_config",
      entityId: "global",
      metadata: { input: body, resolved: next },
    });
    return NextResponse.json({ success: true, data: next });
  } catch (err) {
    console.error("[savings/config PUT] error", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
