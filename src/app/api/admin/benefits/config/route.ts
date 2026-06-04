import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import { BENEFITS_SETTING_KEYS, loadBenefitsSettings } from "@/lib/benefits";

const KEY_SET = new Set<string>(Object.values(BENEFITS_SETTING_KEYS));

// GET /api/admin/benefits/config
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const settings = await loadBenefitsSettings();
  return NextResponse.json({ success: true, data: settings });
}

// PUT /api/admin/benefits/config
// Body: { BENEFITS_ENABLED?, BENEFITS_MIN_BOOKINGS?, ... }
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const updates: { key: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(body)) {
    if (!KEY_SET.has(key)) continue;
    updates.push({ key, value: String(raw) });
  }

  for (const u of updates) {
    await db.setting.upsert({
      where: { key: u.key },
      update: { value: u.value },
      create: u,
    });
  }

  await logAdminAction({
    adminId: session!.userId,
    action: "benefits.config.update",
    entityType: "settings",
    entityId: "benefits",
    metadata: { keys: updates.map((u) => u.key) },
  });

  const settings = await loadBenefitsSettings();
  return NextResponse.json({ success: true, data: settings });
}
