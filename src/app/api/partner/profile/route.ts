import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (session.role !== "PRO" && session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const pro = await db.pro.findFirst({
      where: { userId: session.userId },
      include: {
        services: { include: { service: true } },
        zones: { include: { zone: true } },
      },
    });

    if (!pro) return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: pro });
  } catch (err) {
    console.error("partner profile GET error:", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (session.role !== "PRO" && session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    const pro = await db.pro.findFirst({ where: { userId: session.userId } });
    if (!pro) return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });

    const body = await request.json();

    // Suspended / inactive pros cannot change availability
    if (body.availability !== undefined && pro.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Your account is not active. Cannot change availability." },
        { status: 403 },
      );
    }
    const profileSchema = (await import("zod")).z.object({
      name: (await import("zod")).z.string().min(1).max(100).optional(),
      bio: (await import("zod")).z.string().max(500).optional(),
      bankCode: (await import("zod")).z.string().max(20).optional(),
      bankAccount: (await import("zod")).z.string().max(20).optional(),
      bankName: (await import("zod")).z.string().max(100).optional(),
      availability: (await import("zod")).z.enum(["ONLINE", "BUSY", "OFFLINE"]).optional(),
    });
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const validated = parsed.data;

    // Going online with nothing to dispatch on just produces no-pro failures.
    if (validated.availability === "ONLINE") {
      const [svc, zones] = await Promise.all([
        db.proService.count({ where: { proId: pro.id } }),
        db.proZone.count({ where: { proId: pro.id } }),
      ]);
      if (svc === 0 || zones === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Add at least one service and one area on your Profile before going online.",
          },
          { status: 400 },
        );
      }
    }

    // Any change to the payout account voids the previous verification.
    const bankChanged =
      (validated.bankCode !== undefined && validated.bankCode !== (pro.bankCode ?? "")) ||
      (validated.bankAccount !== undefined && validated.bankAccount !== (pro.bankAccount ?? ""));

    await db.pro.update({
      where: { id: pro.id },
      data: {
        ...validated,
        ...(bankChanged ? { bankVerifiedAt: null, bankAccountName: null } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("partner profile PATCH error:", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
