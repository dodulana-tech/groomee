import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateFreedomCertCode } from "@/lib/apprenticeships";
import {
  notifyMasterFreedomComplete,
  notifyApprenticeFreedomGranted,
} from "@/lib/whatsapp";
import {
  emailApprenticeFreedomGranted,
  emailMasterFreedomComplete,
} from "@/lib/email-notify";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng";

const bodySchema = z.object({
  note: z.string().trim().max(500).optional(),
});

/**
 * POST /api/partner/apprentices/[id]/freedom
 *
 * Master-initiated Freedom ceremony. Mirrors the mechanics of the admin
 * force-freedom override (slice 7) with two key differences:
 *
 *   1. Status MUST be READY_FOR_FREEDOM — masters can't bypass the gate;
 *      only admins can (slice 7's force-freedom does that).
 *   2. After commit, fires celebration notifications to BOTH master and
 *      apprentice (admin override does NOT — those notifications are
 *      this slice's responsibility).
 *
 * The transactional updates here intentionally mirror slice 7 — copy-paste
 * with comments rather than a shared helper, since the pre-conditions and
 * post-commit semantics differ enough that abstracting would obscure intent.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { note } = bodySchema.parse(body);

    const master = await db.pro.findFirst({
      where: { userId: session.userId },
      select: { id: true, name: true, phone: true },
    });
    if (!master) {
      return NextResponse.json(
        { success: false, error: "Pro not found" },
        { status: 404 },
      );
    }

    const apprenticeship = await db.apprenticeship.findUnique({
      where: { id },
      include: {
        apprentice: {
          select: {
            id: true,
            name: true,
            phone: true,
            userId: true,
            parentProId: true,
          },
        },
        master: { select: { id: true, name: true, phone: true, userId: true } },
      },
    });

    if (!apprenticeship) {
      return NextResponse.json(
        { success: false, error: "Apprenticeship not found" },
        { status: 404 },
      );
    }

    // Master-only: only the master on this apprenticeship can initiate freedom
    // through this endpoint. (Admins use /api/admin/apprenticeships/[id]/force-freedom.)
    if (apprenticeship.masterId !== master.id) {
      return NextResponse.json(
        { success: false, error: "Not your apprentice." },
        { status: 403 },
      );
    }

    // Hard gate: master may only confirm Freedom when the system has flipped
    // status to READY_FOR_FREEDOM. Anything else is rejected.
    if (apprenticeship.status !== "READY_FOR_FREEDOM") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot bestow Freedom — apprenticeship is in ${apprenticeship.status}, not READY_FOR_FREEDOM. The Freedom gate has not been cleared.`,
        },
        { status: 422 },
      );
    }

    // Generate a unique cert code; retry on the rare collision against the
    // unique index on Apprenticeship.freedomCertCode / Pro.freedomCertCode.
    // (Pattern lifted from slice 7's force-freedom route.)
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

    // The master under whom they're freed: snapshot their parentProId before
    // we clear it. Falls back to apprenticeship.masterId for safety.
    const freedUnderProId =
      apprenticeship.apprentice.parentProId ?? apprenticeship.masterId;

    await db.$transaction(async (tx) => {
      await tx.apprenticeship.update({
        where: { id },
        data: {
          status: "FREED",
          freedomDate: now,
          freedomCertCode: certCode,
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

    // ── Celebration notifications ────────────────────────────────────────
    // The Freedom moment is the platform's emotional peak. Fire-and-forget so
    // the response doesn't block on Twilio / SMTP. Log on failure but never
    // bounce the success response.
    const certUrl = `${APP_URL}/cert/${certCode}`;

    if (master.phone) {
      notifyMasterFreedomComplete(
        master.phone,
        apprenticeship.apprentice.name,
        certCode,
        certUrl,
      ).catch((err) =>
        console.error("[freedom.POST] master WA failed:", err),
      );
    }
    if (apprenticeship.apprentice.phone) {
      notifyApprenticeFreedomGranted(
        apprenticeship.apprentice.phone,
        master.name,
        certCode,
        certUrl,
      ).catch((err) =>
        console.error("[freedom.POST] apprentice WA failed:", err),
      );
    }

    // Email celebrations
    try {
      const masterUser = apprenticeship.master.userId
        ? await db.user.findUnique({
            where: { id: apprenticeship.master.userId },
            select: { email: true },
          })
        : null;
      if (masterUser?.email) {
        await emailMasterFreedomComplete({
          to: masterUser.email,
          masterName: master.name,
          apprenticeName: apprenticeship.apprentice.name,
          certCode,
          certUrl,
        });
      }

      const apprenticeUser = apprenticeship.apprentice.userId
        ? await db.user.findUnique({
            where: { id: apprenticeship.apprentice.userId },
            select: { email: true },
          })
        : null;
      if (apprenticeUser?.email) {
        await emailApprenticeFreedomGranted({
          to: apprenticeUser.email,
          apprenticeName: apprenticeship.apprentice.name,
          masterName: master.name,
          certCode,
          certUrl,
          freedomDate: now,
        });
      }
    } catch (err) {
      console.error("[freedom.POST] email send failed:", err);
    }

    return NextResponse.json({
      success: true,
      data: {
        certCode,
        certUrl,
        freedomDate: now,
        note: note ?? null,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("[partner/apprentices/[id]/freedom POST] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to bestow Freedom." },
      { status: 500 },
    );
  }
}
