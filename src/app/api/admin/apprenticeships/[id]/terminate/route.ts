import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPRENTICESHIP_PERMISSIONS } from "@/lib/apprenticeships";
import { logAdminAction } from "@/lib/admin-audit";
import { z } from "zod";

const terminateSchema = z.object({
  reason: z.string().trim().min(3, "Reason is required"),
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
    const { reason } = terminateSchema.parse(body);

    const apprenticeship = await db.apprenticeship.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        apprenticeId: true,
        masterId: true,
      },
    });

    if (!apprenticeship) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    if (apprenticeship.status === "TERMINATED") {
      return NextResponse.json(
        { success: false, error: "Already terminated" },
        { status: 400 },
      );
    }

    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.apprenticeship.update({
        where: { id },
        data: {
          status: "TERMINATED",
          terminatedAt: now,
          terminationReason: reason,
        },
      });
      await tx.pro.update({
        where: { id: apprenticeship.apprenticeId },
        data: {
          parentProId: null,
          relationship: "INDEPENDENT",
        },
      });
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "apprenticeship.terminate",
      entityType: "apprenticeship",
      entityId: id,
      metadata: {
        previousStatus: apprenticeship.status,
        apprenticeId: apprenticeship.apprenticeId,
        masterId: apprenticeship.masterId,
        reason,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("[admin/apprenticeships terminate] error", err);
    return NextResponse.json(
      { success: false, error: "Failed to terminate" },
      { status: 500 },
    );
  }
}
