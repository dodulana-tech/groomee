import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { HEALTH_CONDITIONS, HEALTH_PERMISSIONS } from "@/lib/health";
import { logAdminAction } from "@/lib/admin-audit";
import type { Prisma } from "@prisma/client";

const createSchema = z
  .object({
    conditionCode: z.string().min(1),
    serviceId: z.string().min(1).nullable().optional(),
    level: z.enum(["INFO", "WARN", "BLOCK"]),
    message: z.string().min(2).max(500),
  })
  .strict();

// GET /api/admin/health/contraindications?conditionCode=&serviceId=
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!hasPermission(session, HEALTH_PERMISSIONS.view)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const conditionCode = searchParams.get("conditionCode")?.trim();
    const serviceIdParam = searchParams.get("serviceId");

    const where: Prisma.ServiceContraindicationWhereInput = {};
    if (conditionCode) where.conditionCode = conditionCode;
    if (serviceIdParam !== null) {
      // Empty string or "null" means catalog-wide rules (serviceId IS NULL)
      if (serviceIdParam === "" || serviceIdParam === "null") {
        where.serviceId = null;
      } else if (serviceIdParam) {
        where.serviceId = serviceIdParam;
      }
    }

    const rows = await db.serviceContraindication.findMany({
      where,
      orderBy: [{ conditionCode: "asc" }, { createdAt: "asc" }],
      include: {
        service: { select: { id: true, name: true, slug: true, category: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: rows,
      catalog: HEALTH_CONDITIONS,
    });
  } catch (err) {
    console.error("[admin/health/contraindications GET] error", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}

// POST /api/admin/health/contraindications
export async function POST(req: NextRequest) {
  try {
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

    const input = createSchema.parse(body);

    // Validate condition code against catalog vocabulary.
    if (!HEALTH_CONDITIONS.some((c) => c.code === input.conditionCode)) {
      return NextResponse.json(
        { success: false, error: `Unknown conditionCode: ${input.conditionCode}` },
        { status: 400 },
      );
    }

    const serviceId = input.serviceId ?? null;
    if (serviceId) {
      const svc = await db.service.findUnique({ where: { id: serviceId } });
      if (!svc) {
        return NextResponse.json(
          { success: false, error: "Service not found" },
          { status: 400 },
        );
      }
    }

    // Enforce uniqueness on (conditionCode, serviceId) — schema already has it,
    // but we want a friendly 409 instead of a Prisma exception.
    const existing = await db.serviceContraindication.findFirst({
      where: { conditionCode: input.conditionCode, serviceId },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A rule already exists for this condition + service combination. Edit it instead.",
        },
        { status: 409 },
      );
    }

    const row = await db.serviceContraindication.create({
      data: {
        conditionCode: input.conditionCode,
        serviceId,
        level: input.level,
        message: input.message,
      },
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "health.create_contraindication",
      entityType: "service_contraindication",
      entityId: row.id,
      metadata: {
        conditionCode: row.conditionCode,
        serviceId: row.serviceId,
        level: row.level,
      },
    });

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("[admin/health/contraindications POST] error", err);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
