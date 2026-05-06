import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (session.role !== "PRO" && session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const pro = await db.pro.findFirst({ where: { userId: session.userId } });
  if (!pro) return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });

  const schedule = await db.proSchedule.findMany({
    where: { proId: pro.id },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ success: true, data: { schedule } });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (session.role !== "PRO" && session.role !== "ADMIN") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const pro = await db.pro.findFirst({ where: { userId: session.userId } });
  if (!pro) return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });

  const body = await request.json();

  const { z } = await import("zod");
  const scheduleSchema = z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"),
      isActive: z.boolean().optional(),
    }),
  ).max(14);

  const schedule = scheduleSchema.parse(body.schedule);

  const saved = await db.$transaction(async (tx) => {
    await tx.proSchedule.deleteMany({ where: { proId: pro.id } });
    const created = await tx.proSchedule.createMany({
      data: schedule.map((entry) => ({
        proId: pro.id,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        isActive: entry.isActive ?? true,
      })),
    });
    return created;
  });

  return NextResponse.json({ success: true, data: { saved } });
}
