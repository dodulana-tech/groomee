import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
  availability: z.enum(["ONLINE", "BUSY", "OFFLINE"]).optional(),
  commission: z.number().min(0.05).max(0.4).optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  serviceIds: z.array(z.string()).optional(),
  zoneIds: z.array(z.string()).optional(),
  bio: z.string().optional(),
  idVerified: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, "pros.view")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const pro = await db.pro.findUnique({
      where: { id: id },
      include: {
        services: { include: { service: true } },
        zones: { include: { zone: true } },
        earnings: { where: { paid: false }, take: 1 },
        _count: { select: { bookings: true } },
      },
    });
    if (!pro)
      return NextResponse.json(
        { success: false, error: "Not found." },
        { status: 404 },
      );
    const pendingEarnings = await db.earning.aggregate({
      where: { proId: id, paid: false },
      _sum: { amount: true },
    });
    return NextResponse.json({
      success: true,
      data: { ...pro, pendingEarnings: pendingEarnings._sum.amount ?? 0 },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, "pros.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const input = updateSchema.parse(body);

    const { serviceIds, zoneIds, ...rest } = input;

    const pro = await db.pro.update({
      where: { id: id },
      data: {
        ...rest,
        ...(serviceIds !== undefined && {
          services: {
            deleteMany: {},
            create: serviceIds.map((serviceId) => ({ serviceId })),
          },
        }),
        ...(zoneIds !== undefined && {
          zones: {
            deleteMany: {},
            create: zoneIds.map((zoneId) => ({ zoneId })),
          },
        }),
      },
    });

    // If suspended/removed, force offline
    if (input.status === "SUSPENDED" || input.status === "REMOVED") {
      await db.pro.update({
        where: { id: id },
        data: { availability: "OFFLINE" },
      });
    }

    // Sync user role when pro status changes
    if (input.status && pro.userId) {
      if (input.status === "ACTIVE") {
        await db.user.update({
          where: { id: pro.userId },
          data: { role: "PRO" },
        }).catch(() => {});
      } else if (input.status === "SUSPENDED" || input.status === "REMOVED") {
        await db.user.update({
          where: { id: pro.userId },
          data: { role: "CUSTOMER" },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, data: pro });
  } catch (err) {
    if (err instanceof z.ZodError)
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    return NextResponse.json(
      { success: false, error: "Failed to update." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!hasPermission(session, "pros.manage")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await db.pro.update({
      where: { id: id },
      data: { status: "REMOVED", availability: "OFFLINE" },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to remove." },
      { status: 500 },
    );
  }
}
