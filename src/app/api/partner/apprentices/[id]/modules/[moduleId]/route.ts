import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isFreedomReady } from "@/lib/apprenticeships";
import {
  notifyApprenticeModuleCompleted,
  notifyMasterApprenticeReadyForFreedom,
} from "@/lib/whatsapp";
import {
  emailApprenticeModuleCompleted,
  emailMasterApprenticeReadyForFreedom,
} from "@/lib/email-notify";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  required: z.boolean().optional(),
  gatesIndependence: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().max(2000).nullable().optional(),
  // Toggle controls — when present (boolean), set the timestamp accordingly.
  completed: z.boolean().optional(),
  signedOff: z.boolean().optional(),
}).strict();

async function authMaster(id: string) {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    return { error: "Forbidden", status: 403 as const };
  }
  const master = await db.pro.findFirst({ where: { userId: session.userId } });
  if (!master) return { error: "Pro not found", status: 404 as const };

  const apprenticeship = await db.apprenticeship.findUnique({
    where: { id },
    include: {
      apprentice: { select: { id: true, name: true, phone: true, userId: true } },
      master: { select: { id: true, name: true, phone: true, userId: true } },
    },
  });
  if (!apprenticeship) return { error: "Apprenticeship not found.", status: 404 as const };
  if (apprenticeship.masterId !== master.id) {
    return { error: "Not your apprentice.", status: 403 as const };
  }
  return { master, apprenticeship };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> },
) {
  const { id, moduleId } = await params;
  try {
    const auth = await authMaster(id);
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { apprenticeship } = auth;
    if (apprenticeship.status === "FREED" || apprenticeship.status === "TERMINATED") {
      return NextResponse.json(
        { success: false, error: "This apprenticeship is closed." },
        { status: 409 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const input = parsed.data;

    const existing = await db.curriculumModule.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        apprenticeshipId: true,
        title: true,
        completedAt: true,
        masterSignoffAt: true,
      },
    });
    if (!existing || existing.apprenticeshipId !== id) {
      return NextResponse.json({ success: false, error: "Module not found." }, { status: 404 });
    }

    const now = new Date();
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.description !== undefined) {
      data.description = input.description ? input.description.trim() : null;
    }
    if (input.required !== undefined) data.required = input.required;
    if (input.gatesIndependence !== undefined) data.gatesIndependence = input.gatesIndependence;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.notes !== undefined) {
      data.notes = input.notes ? input.notes.trim() : null;
    }
    if (input.completed !== undefined) {
      data.completedAt = input.completed ? (existing.completedAt ?? now) : null;
      // If marking incomplete, also revoke any existing sign-off — sign-off implies completion.
      if (!input.completed) data.masterSignoffAt = null;
    }
    // Sign-off transition is handled separately below as an atomic
    // updateMany so concurrent PATCHes can't both fire the apprentice
    // notification.
    let pendingSignoff: false | "grant" | "revoke" = false;
    if (input.signedOff === true) {
      pendingSignoff = "grant";
    } else if (input.signedOff === false) {
      pendingSignoff = "revoke";
    }

    // Atomically transition the sign-off only when state actually changes.
    // This is the only field where duplicate notifications would matter.
    let signoffNewlyGranted = false;
    if (pendingSignoff === "grant") {
      const result = await db.curriculumModule.updateMany({
        where: { id: moduleId, masterSignoffAt: null },
        data: {
          masterSignoffAt: now,
          // Sign-off implies completion.
          ...(existing.completedAt === null && data.completedAt === undefined
            ? { completedAt: now }
            : {}),
        },
      });
      signoffNewlyGranted = result.count === 1;
    } else if (pendingSignoff === "revoke") {
      data.masterSignoffAt = null;
    }

    const updated = await db.curriculumModule.update({
      where: { id: moduleId },
      data,
    });
    if (signoffNewlyGranted && apprenticeship.apprentice.phone) {
      notifyApprenticeModuleCompleted(
        apprenticeship.apprentice.phone,
        updated.title,
      ).catch((err) => console.error("[modules.PATCH] WA failed:", err));
    }
    if (signoffNewlyGranted && apprenticeship.apprentice.userId) {
      const u = await db.user.findUnique({
        where: { id: apprenticeship.apprentice.userId },
        select: { email: true },
      });
      if (u?.email) {
        emailApprenticeModuleCompleted({
          to: u.email,
          apprenticeName: apprenticeship.apprentice.name,
          moduleTitle: updated.title,
          masterName: apprenticeship.master.name,
        });
      }
    }

    // Auto-flip readiness check.
    const ready = await isFreedomReady(apprenticeship.id);
    if (ready && apprenticeship.status === "IN_TRAINING") {
      await db.apprenticeship.update({
        where: { id: apprenticeship.id },
        data: {
          status: "READY_FOR_FREEDOM",
          readyForFreedomAt: new Date(),
        },
      });
      // Notify master.
      if (apprenticeship.master.phone) {
        notifyMasterApprenticeReadyForFreedom(
          apprenticeship.master.phone,
          apprenticeship.apprentice.name,
        ).catch((err) =>
          console.error("[modules.PATCH] master ready WA failed:", err),
        );
      }
      if (apprenticeship.master.userId) {
        const mu = await db.user.findUnique({
          where: { id: apprenticeship.master.userId },
          select: { email: true },
        });
        if (mu?.email) {
          emailMasterApprenticeReadyForFreedom({
            to: mu.email,
            masterName: apprenticeship.master.name,
            apprenticeName: apprenticeship.apprentice.name,
          });
        }
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[partner/apprentices/[id]/modules/[moduleId] PATCH] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update module." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> },
) {
  const { id, moduleId } = await params;
  try {
    const auth = await authMaster(id);
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const { apprenticeship } = auth;
    if (apprenticeship.status === "FREED" || apprenticeship.status === "TERMINATED") {
      return NextResponse.json(
        { success: false, error: "This apprenticeship is closed." },
        { status: 409 },
      );
    }

    const existing = await db.curriculumModule.findUnique({
      where: { id: moduleId },
      select: { id: true, apprenticeshipId: true, completedAt: true },
    });
    if (!existing || existing.apprenticeshipId !== id) {
      return NextResponse.json({ success: false, error: "Module not found." }, { status: 404 });
    }
    if (existing.completedAt !== null) {
      return NextResponse.json(
        { success: false, error: "Cannot delete a completed module." },
        { status: 409 },
      );
    }

    await db.curriculumModule.delete({ where: { id: moduleId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[partner/apprentices/[id]/modules/[moduleId] DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete module." },
      { status: 500 },
    );
  }
}
