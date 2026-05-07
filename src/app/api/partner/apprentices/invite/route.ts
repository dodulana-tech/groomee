import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, formatPhone } from "@/lib/auth";
import { isValidNigerianPhone } from "@/lib/utils";
import { DEFAULT_CURRICULUM, DEFAULT_MASTER_COMMISSION } from "@/lib/apprenticeships";
import { notifyApprenticeInvited } from "@/lib/whatsapp";
import { emailApprenticeInvitation } from "@/lib/email-notify";

const inviteSchema = z.object({
  phone: z.string().min(10),
  apprenticeName: z.string().min(1).max(100).optional(),
  commission: z.number().min(0.10).max(0.50).optional(),
  expectedFreedom: z.string().datetime().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// GET — list this master's pending invitations.
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const master = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!master) {
      return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });
    }

    const invitations = await db.apprenticeship.findMany({
      where: { masterId: master.id, status: "PENDING_ACCEPT" },
      orderBy: { invitedAt: "desc" },
      include: { apprentice: { select: { id: true, name: true, phone: true } } },
    });

    return NextResponse.json({
      success: true,
      data: invitations.map((inv) => ({
        id: inv.id,
        apprenticeName: inv.apprentice.name,
        apprenticePhone: inv.apprentice.phone,
        masterCommission: inv.masterCommission,
        invitedAt: inv.invitedAt,
        expectedFreedom: inv.expectedFreedom,
      })),
    });
  } catch (err) {
    console.error("[partner/apprentices/invite GET] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load invitations." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "PRO" && session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const master = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!master) {
      return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });
    }
    if (master.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Your account must be active to invite apprentices." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
    }
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const input = parsed.data;

    if (!isValidNigerianPhone(input.phone)) {
      return NextResponse.json(
        { success: false, error: "Enter a valid Nigerian phone number." },
        { status: 400 },
      );
    }
    const phone = formatPhone(input.phone);

    if (phone === master.phone) {
      return NextResponse.json(
        { success: false, error: "You cannot invite yourself." },
        { status: 400 },
      );
    }

    // Look up or create the apprentice Pro record. New ones land in PENDING and stay there until accept.
    let apprentice = await db.pro.findUnique({ where: { phone } });
    if (!apprentice) {
      const fallbackName = input.apprenticeName?.trim() || `Apprentice ${phone.slice(-4)}`;
      apprentice = await db.pro.create({
        data: {
          name: fallbackName,
          phone,
          status: "PENDING",
          availability: "OFFLINE",
        },
      });
    }

    if (apprentice.id === master.id) {
      return NextResponse.json(
        { success: false, error: "You cannot invite yourself." },
        { status: 400 },
      );
    }

    // Block if this phone is already in an active apprenticeship (pending or training).
    const conflict = await db.apprenticeship.findFirst({
      where: {
        apprenticeId: apprentice.id,
        status: { in: ["PENDING_ACCEPT", "IN_TRAINING", "READY_FOR_FREEDOM"] },
      },
    });
    if (conflict) {
      return NextResponse.json(
        {
          success: false,
          error:
            conflict.status === "PENDING_ACCEPT"
              ? "This person already has a pending apprenticeship invitation."
              : "This person is already in an active apprenticeship.",
        },
        { status: 409 },
      );
    }

    // Reject if they're already a freed/independent active pro working solo.
    if (apprentice.status === "ACTIVE" && apprentice.relationship === "INDEPENDENT") {
      return NextResponse.json(
        {
          success: false,
          error: "This pro is already independent on Groomee. They cannot be apprenticed.",
        },
        { status: 409 },
      );
    }

    const masterCommission = input.commission ?? DEFAULT_MASTER_COMMISSION;
    const expectedFreedom = input.expectedFreedom ? new Date(input.expectedFreedom) : null;

    // Create the apprenticeship + curriculum modules in a single transaction.
    const apprenticeship = await db.$transaction(async (tx) => {
      const created = await tx.apprenticeship.create({
        data: {
          apprenticeId: apprentice!.id,
          masterId: master.id,
          status: "PENDING_ACCEPT",
          masterCommission,
          expectedFreedom,
          terminationReason: input.notes ?? null,
          modules: {
            create: DEFAULT_CURRICULUM.map((m, idx) => ({
              title: m.title,
              description: m.description,
              required: m.required,
              gatesIndependence: m.gatesIndependence,
              sortOrder: idx,
            })),
          },
        },
        include: { modules: true },
      });
      return created;
    });

    // Build accept URL — apprentice clicks this from WhatsApp/email.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng";
    const acceptUrl = `${appUrl}/partner/invitation/${apprenticeship.id}`;

    // Fire notifications. Don't block on WhatsApp failure — record was created.
    notifyApprenticeInvited(phone, master.name, acceptUrl).catch((err) =>
      console.error("[invite] WA send failed:", err),
    );

    // Email if there's an associated user with an email.
    const apprenticeUser = apprentice.userId
      ? await db.user.findUnique({
          where: { id: apprentice.userId },
          select: { email: true },
        })
      : await db.user.findFirst({
          where: { phone },
          select: { email: true },
        });
    if (apprenticeUser?.email) {
      emailApprenticeInvitation({
        to: apprenticeUser.email,
        masterName: master.name,
        acceptUrl,
        commissionPct: Math.round(masterCommission * 100),
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          apprenticeshipId: apprenticeship.id,
          apprenticeId: apprentice.id,
          phone,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[partner/apprentices/invite] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to send invitation." },
      { status: 500 },
    );
  }
}
