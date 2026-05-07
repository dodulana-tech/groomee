import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  APPRENTICESHIP_PERMISSIONS,
  generateFreedomCertCode,
} from "@/lib/apprenticeships";
import { logAdminAction } from "@/lib/admin-audit";
import { z } from "zod";

const forceFreedomSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, APPRENTICESHIP_PERMISSIONS.manage)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { note } = forceFreedomSchema.parse(body);

    const apprenticeship = await db.apprenticeship.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        apprenticeId: true,
        masterId: true,
        freedomCertCode: true,
      },
    });

    if (!apprenticeship) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    if (
      apprenticeship.status === "FREED" ||
      apprenticeship.status === "TERMINATED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot force freedom from status ${apprenticeship.status}`,
        },
        { status: 400 },
      );
    }

    // Generate a unique cert code; retry on the rare collision against the
    // unique index on Apprenticeship.freedomCertCode / Pro.freedomCertCode.
    let certCode = generateFreedomCertCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const collision = await db.apprenticeship.findUnique({
        where: { freedomCertCode: certCode },
        select: { id: true },
      });
      const proCollision = collision
        ? null
        : await db.pro.findUnique({
            where: { freedomCertCode: certCode },
            select: { id: true },
          });
      if (!collision && !proCollision) break;
      certCode = generateFreedomCertCode();
    }

    const now = new Date();

    // Snapshot apprentice's current parentProId before clearing it; that's
    // the master under whom they were freed.
    const apprentice = await db.pro.findUnique({
      where: { id: apprenticeship.apprenticeId },
      select: { parentProId: true },
    });
    const freedUnderProId =
      apprentice?.parentProId ?? apprenticeship.masterId;

    await db.$transaction(async (tx) => {
      await tx.apprenticeship.update({
        where: { id },
        data: {
          status: "FREED",
          freedomDate: now,
          freedomCertCode: certCode,
          readyForFreedomAt:
            apprenticeship.status === "READY_FOR_FREEDOM"
              ? undefined
              : now,
        },
      });
      await tx.pro.update({
        where: { id: apprenticeship.apprenticeId },
        data: {
          freedUnderProId,
          freedAt: now,
          parentProId: null,
          relationship: "INDEPENDENT",
          freedomCertCode: certCode,
        },
      });
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "apprenticeship.force_freedom",
      entityType: "apprenticeship",
      entityId: id,
      metadata: {
        previousStatus: apprenticeship.status,
        apprenticeId: apprenticeship.apprenticeId,
        masterId: apprenticeship.masterId,
        freedUnderProId,
        certCode,
        note: note ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { certCode, freedAt: now },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("[admin/apprenticeships force-freedom] error", err);
    return NextResponse.json(
      { success: false, error: "Failed to force freedom" },
      { status: 500 },
    );
  }
}
