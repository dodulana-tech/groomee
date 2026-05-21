import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";
import {
  INVENTORY_SETTING_KEYS,
  loadInventoryConfig,
} from "@/lib/inventory";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  cooldownHours: z.number().min(0).max(720).optional(),
  thresholdDefault: z.number().min(0).max(1000).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "inventory.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const config = await loadInventoryConfig();
  return NextResponse.json({ data: config });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "inventory.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const parsed = updateSchema.parse(await req.json());

    const writes: Array<Promise<unknown>> = [];
    const changes: Record<string, string> = {};

    if (parsed.enabled !== undefined) {
      const value = parsed.enabled ? "true" : "false";
      changes[INVENTORY_SETTING_KEYS.enabled] = value;
      writes.push(
        db.setting.upsert({
          where: { key: INVENTORY_SETTING_KEYS.enabled },
          update: { value },
          create: { key: INVENTORY_SETTING_KEYS.enabled, value },
        }),
      );
    }
    if (parsed.cooldownHours !== undefined) {
      const value = String(parsed.cooldownHours);
      changes[INVENTORY_SETTING_KEYS.alertCooldownHours] = value;
      writes.push(
        db.setting.upsert({
          where: { key: INVENTORY_SETTING_KEYS.alertCooldownHours },
          update: { value },
          create: {
            key: INVENTORY_SETTING_KEYS.alertCooldownHours,
            value,
          },
        }),
      );
      // Keep the legacy key in lockstep so older consumers don't drift.
      writes.push(
        db.setting.upsert({
          where: { key: INVENTORY_SETTING_KEYS.alertThrottleHoursLegacy },
          update: { value },
          create: {
            key: INVENTORY_SETTING_KEYS.alertThrottleHoursLegacy,
            value,
          },
        }),
      );
    }
    if (parsed.thresholdDefault !== undefined) {
      const value = String(parsed.thresholdDefault);
      changes[INVENTORY_SETTING_KEYS.lowStockThresholdDefault] = value;
      writes.push(
        db.setting.upsert({
          where: { key: INVENTORY_SETTING_KEYS.lowStockThresholdDefault },
          update: { value },
          create: {
            key: INVENTORY_SETTING_KEYS.lowStockThresholdDefault,
            value,
          },
        }),
      );
    }

    await Promise.all(writes);

    await logAdminAction({
      adminId: session!.userId,
      action: "inventory.settings.update",
      entityType: "settings",
      entityId: "inventory",
      metadata: changes,
    });

    const config = await loadInventoryConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("inventory settings error:", err);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 },
    );
  }
}
