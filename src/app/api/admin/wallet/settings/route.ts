import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  SETTING_KEYS,
  loadReleaseFractions,
  loadDefaultCreditLimit,
  loadAdvanceRepayRate,
} from "@/lib/wallet";
import { logAdminAction } from "@/lib/admin-audit";

const TOLERANCE = 0.001;

// GET /api/admin/wallet/settings — current fractions + default credit limit
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "wallet.view")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  try {
    const [fractions, creditLimit, advanceRepayRate] = await Promise.all([
      loadReleaseFractions(),
      loadDefaultCreditLimit(),
      loadAdvanceRepayRate(),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        ...fractions,
        defaultCreditLimit: creditLimit,
        advanceRepayRate,
      },
    });
  } catch (err) {
    console.error("wallet settings GET error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load settings" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/wallet/settings
//
// Body: { mobilization: number, completion: number, confirm: number, defaultCreditLimit?: number }
// Fractions must each be in [0, 1] and sum to ~1.0 (TOLERANCE).
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "wallet.manage")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  let body: {
    mobilization?: unknown;
    completion?: unknown;
    confirm?: unknown;
    defaultCreditLimit?: unknown;
    advanceRepayRate?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const m = Number(body.mobilization);
  const c = Number(body.completion);
  const f = Number(body.confirm);
  const limit = body.defaultCreditLimit !== undefined
    ? Number(body.defaultCreditLimit)
    : undefined;
  const repayRate = body.advanceRepayRate !== undefined
    ? Number(body.advanceRepayRate)
    : undefined;

  for (const [name, v] of [
    ["mobilization", m],
    ["completion", c],
    ["confirm", f],
  ] as const) {
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      return NextResponse.json(
        {
          success: false,
          error: `${name} must be a number between 0 and 1`,
        },
        { status: 400 },
      );
    }
  }
  const sum = m + c + f;
  if (Math.abs(sum - 1) > TOLERANCE) {
    return NextResponse.json(
      {
        success: false,
        error: `Fractions must sum to 1.0 (got ${sum.toFixed(4)})`,
      },
      { status: 400 },
    );
  }
  if (limit !== undefined && (!Number.isFinite(limit) || limit < 0)) {
    return NextResponse.json(
      { success: false, error: "defaultCreditLimit must be a non-negative number" },
      { status: 400 },
    );
  }
  if (
    repayRate !== undefined &&
    (!Number.isFinite(repayRate) || repayRate < 0 || repayRate > 1)
  ) {
    return NextResponse.json(
      { success: false, error: "advanceRepayRate must be a number in [0, 1]" },
      { status: 400 },
    );
  }

  const writes: Array<{ key: string; value: string }> = [
    { key: SETTING_KEYS.mobilizationFraction, value: m.toString() },
    { key: SETTING_KEYS.completionFraction, value: c.toString() },
    { key: SETTING_KEYS.confirmFraction, value: f.toString() },
  ];
  if (limit !== undefined) {
    writes.push({ key: SETTING_KEYS.defaultCreditLimit, value: limit.toString() });
  }
  if (repayRate !== undefined) {
    writes.push({ key: SETTING_KEYS.advanceRepayRate, value: repayRate.toString() });
  }

  try {
    await db.$transaction(
      writes.map((w) =>
        db.setting.upsert({
          where: { key: w.key },
          create: { key: w.key, value: w.value },
          update: { value: w.value },
        }),
      ),
    );

    await logAdminAction({
      adminId: session!.userId,
      action: "wallet.settings.update",
      entityType: "wallet_settings",
      entityId: "global",
      metadata: {
        mobilization: m,
        completion: c,
        confirm: f,
        ...(limit !== undefined ? { defaultCreditLimit: limit } : {}),
        ...(repayRate !== undefined ? { advanceRepayRate: repayRate } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        mobilization: m,
        completion: c,
        confirm: f,
        ...(limit !== undefined ? { defaultCreditLimit: limit } : {}),
        ...(repayRate !== undefined ? { advanceRepayRate: repayRate } : {}),
      },
    });
  } catch (err) {
    console.error("wallet settings PUT error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
