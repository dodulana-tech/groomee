import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendGroomerWelcome } from "@/lib/whatsapp";
import { z } from "zod";

const createGroomerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  serviceIds: z.array(z.string()).min(1),
  zoneIds: z.array(z.string()).min(1),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  commission: z.number().min(0.05).max(0.4).default(0.2),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const availability = searchParams.get("availability");

    const groomers = await db.groomer.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(availability ? { availability: availability as never } : {}),
      },
      include: {
        services: {
          include: { service: { select: { name: true, category: true } } },
        },
        zones: { include: { zone: { select: { name: true } } } },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: groomers });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const input = createGroomerSchema.parse(body);

    const existing = await db.groomer.findFirst({
      where: { phone: input.phone },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "A groomer with this phone number already exists.",
        },
        { status: 400 },
      );
    }

    const groomer = await db.groomer.create({
      data: {
        name: input.name,
        phone: input.phone,
        status: "ACTIVE",
        commission: input.commission,
        bankName: input.bankName,
        bankAccount: input.bankAccount,
        services: {
          create: input.serviceIds.map((serviceId) => ({ serviceId })),
        },
        zones: {
          create: input.zoneIds.map((zoneId) => ({ zoneId })),
        },
      },
    });

    // Send welcome WhatsApp
    await sendGroomerWelcome(groomer.phone, groomer.name.split(" ")[0]);

    return NextResponse.json({ success: true, data: groomer }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("create groomer error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create groomer." },
      { status: 500 },
    );
  }
}
