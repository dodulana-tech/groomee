import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const pro = await db.pro.findFirst({ where: { phone: session.phone } });
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

  const pro = await db.pro.findFirst({ where: { phone: session.phone } });
  if (!pro) return NextResponse.json({ success: false, error: "Pro not found" }, { status: 404 });

  const { schedule } = await request.json();

  const saved = await db.$transaction(async (tx) => {
    await tx.proSchedule.deleteMany({ where: { proId: pro.id } });
    const created = await tx.proSchedule.createMany({
      data: (schedule as Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }>).map(
        (entry) => ({
          proId: pro.id,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          isActive: entry.isActive ?? true,
        }),
      ),
    });
    return created;
  });

  return NextResponse.json({ success: true, data: { saved } });
}
