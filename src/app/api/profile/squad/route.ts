import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_SQUAD = 3;

// GET /api/profile/squad - list squad
export async function GET() {
  try {
    const session = await requireSession();
    const favourites = await db.favouritePro.findMany({
      where: { userId: session.userId },
      include: {
        pro: {
          include: {
            services: { include: { service: true }, take: 3 },
            zones: { include: { zone: true }, take: 2 },
          },
        },
      },
      orderBy: { priority: "asc" },
    });
    return NextResponse.json({ success: true, data: favourites });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}

// POST /api/profile/squad - add pro to squad
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { proId } = await req.json();

    if (!proId) {
      return NextResponse.json(
        { success: false, error: "proId required." },
        { status: 400 },
      );
    }

    const existing = await db.favouritePro.findMany({
      where: { userId: session.userId },
    });

    if (existing.length >= MAX_SQUAD) {
      return NextResponse.json(
        {
          success: false,
          error: `Your squad can have at most ${MAX_SQUAD} pros. Remove one first.`,
        },
        { status: 400 },
      );
    }

    if (existing.some((f: any) => f.proId === proId)) {
      return NextResponse.json(
        { success: false, error: "Already in your squad." },
        { status: 400 },
      );
    }

    const fav = await db.favouritePro.create({
      data: {
        userId: session.userId,
        proId,
        priority: existing.length + 1,
      },
      include: { pro: true },
    });

    return NextResponse.json({ success: true, data: fav }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed." },
      { status: 500 },
    );
  }
}

// DELETE /api/profile/squad - remove pro from squad
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession();
    const { proId } = await req.json();

    await db.favouritePro.deleteMany({
      where: { userId: session.userId, proId },
    });

    // Re-number priorities
    const remaining = await db.favouritePro.findMany({
      where: { userId: session.userId },
      orderBy: { priority: "asc" },
    });

    await Promise.all(
      remaining.map((f: any, i: number) =>
        db.favouritePro.update({
          where: { id: f.id },
          data: { priority: i + 1 },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed." },
      { status: 500 },
    );
  }
}
