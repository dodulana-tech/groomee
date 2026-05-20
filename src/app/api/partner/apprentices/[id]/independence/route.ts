import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyApprenticeIndependenceGranted } from "@/lib/whatsapp";
import { emailApprenticeIndependenceGranted } from "@/lib/email-notify";

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
      master: { select: { id: true, name: true } },
      modules: {
        where: { required: true, gatesIndependence: true },
        select: {
          id: true,
          title: true,
          completedAt: true,
          masterSignoffAt: true,
        },
      },
    },
  });
  if (!apprenticeship) return { error: "Apprenticeship not found.", status: 404 as const };
  if (apprenticeship.masterId !== master.id) {
    return { error: "Not your apprentice.", status: 403 as const };
  }
  return { master, apprenticeship };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    if (apprenticeship.status === "PENDING_ACCEPT") {
      return NextResponse.json(
        { success: false, error: "Apprentice has not accepted yet." },
        { status: 409 },
      );
    }

    // Server-side enforcement: every required-and-gating module must be complete and signed off.
    if (apprenticeship.modules.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No gating modules configured. Add required modules before granting independence.",
        },
        { status: 422 },
      );
    }
    const incomplete = apprenticeship.modules.filter(
      (m) => m.completedAt === null || m.masterSignoffAt === null,
    );
    if (incomplete.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot grant independence — ${incomplete.length} required module${incomplete.length === 1 ? "" : "s"} not yet completed and signed off.`,
          missing: incomplete.map((m) => ({ id: m.id, title: m.title })),
        },
        { status: 422 },
      );
    }

    if (apprenticeship.masterApprovedIndependence !== null) {
      return NextResponse.json(
        { success: false, error: "Independence already granted." },
        { status: 409 },
      );
    }

    const now = new Date();
    await db.apprenticeship.update({
      where: { id: apprenticeship.id },
      data: { masterApprovedIndependence: now },
    });

    if (apprenticeship.apprentice.phone) {
      notifyApprenticeIndependenceGranted(
        apprenticeship.apprentice.phone,
        apprenticeship.master.name,
      ).catch((err) =>
        console.error("[independence.POST] WA failed:", err),
      );
    }
    if (apprenticeship.apprentice.userId) {
      const u = await db.user.findUnique({
        where: { id: apprenticeship.apprentice.userId },
        select: { email: true },
      });
      if (u?.email) {
        emailApprenticeIndependenceGranted({
          to: u.email,
          apprenticeName: apprenticeship.apprentice.name,
          masterName: apprenticeship.master.name,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { masterApprovedIndependence: now },
    });
  } catch (err) {
    console.error("[partner/apprentices/[id]/independence POST] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to grant independence." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    if (apprenticeship.masterApprovedIndependence === null) {
      return NextResponse.json(
        { success: false, error: "Independence is not currently granted." },
        { status: 409 },
      );
    }

    await db.apprenticeship.update({
      where: { id: apprenticeship.id },
      data: { masterApprovedIndependence: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[partner/apprentices/[id]/independence DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to revoke independence." },
      { status: 500 },
    );
  }
}
