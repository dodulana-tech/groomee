import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { HEALTH_PERMISSIONS } from "@/lib/health";
import { logAdminAction } from "@/lib/admin-audit";

// PATCH only allows level + message. conditionCode and serviceId are
// immutable — to repoint a rule, delete and recreate. Stops stealth
// changes to policy and keeps the audit trail honest.
const patchSchema = z
  .object({
    level: z.enum(["INFO", "WARN", "BLOCK"]).optional(),
    message: z.string().min(2).max(500).optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, HEALTH_PERMISSIONS.manage)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    const input = patchSchema.parse(body);

    if (input.level === undefined && input.message === undefined) {
      return NextResponse.json(
        { success: false, error: "No changes provided" },
        { status: 400 },
      );
    }

    const existing = await db.serviceContraindication.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    const updated = await db.serviceContraindication.update({
      where: { id },
      data: {
        ...(input.level !== undefined ? { level: input.level } : {}),
        ...(input.message !== undefined ? { message: input.message } : {}),
      },
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "health.update_contraindication",
      entityType: "service_contraindication",
      entityId: id,
      metadata: {
        before: { level: existing.level, message: existing.message },
        after: { level: updated.level, message: updated.message },
        conditionCode: existing.conditionCode,
        serviceId: existing.serviceId,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("[admin/health/contraindications PATCH] error", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, HEALTH_PERMISSIONS.manage)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const existing = await db.serviceContraindication.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    await db.serviceContraindication.delete({ where: { id } });

    await logAdminAction({
      adminId: session!.userId,
      action: "health.delete_contraindication",
      entityType: "service_contraindication",
      entityId: id,
      metadata: {
        conditionCode: existing.conditionCode,
        serviceId: existing.serviceId,
        level: existing.level,
        message: existing.message,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/health/contraindications DELETE] error", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
