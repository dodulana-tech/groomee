import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  required: z.boolean().optional(),
  gatesIndependence: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

    const apprenticeship = await db.apprenticeship.findUnique({
      where: { id },
      select: { id: true, masterId: true, status: true },
    });
    if (!apprenticeship) {
      return NextResponse.json({ success: false, error: "Apprenticeship not found." }, { status: 404 });
    }
    if (apprenticeship.masterId !== master.id) {
      return NextResponse.json({ success: false, error: "Not your apprentice." }, { status: 403 });
    }
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const input = parsed.data;

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const last = await db.curriculumModule.findFirst({
        where: { apprenticeshipId: id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? -1) + 1;
    }

    const created = await db.curriculumModule.create({
      data: {
        apprenticeshipId: id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        required: input.required ?? false,
        gatesIndependence: input.gatesIndependence ?? false,
        sortOrder,
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (err) {
    console.error("[partner/apprentices/[id]/modules POST] error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to create module." },
      { status: 500 },
    );
  }
}
