import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_SQUAD = 3;

// GET /api/profile/squad — list squad
export async function GET() {
  try {
    const session = await requireSession();
    const favourites = await db.favouriteGroomer.findMany({
      where: { userId: session.userId },
      include: {
        groomer: {
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

// POST /api/profile/squad — add groomer to squad
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { groomerId } = await req.json();

    if (!groomerId) {
      return NextResponse.json(
        { success: false, error: "groomerId required." },
        { status: 400 },
      );
    }

    const existing = await db.favouriteGroomer.findMany({
      where: { userId: session.userId },
    });

    if (existing.length >= MAX_SQUAD) {
      return NextResponse.json(
        {
          success: false,
          error: `Your squad can have at most ${MAX_SQUAD} groomers. Remove one first.`,
        },
        { status: 400 },
      );
    }

    if (existing.some((f: any) => f.groomerId === groomerId)) {
      return NextResponse.json(
        { success: false, error: "Already in your squad." },
        { status: 400 },
      );
    }

    const fav = await db.favouriteGroomer.create({
      data: {
        userId: session.userId,
        groomerId,
        priority: existing.length + 1,
      },
      include: { groomer: true },
    });

    return NextResponse.json({ success: true, data: fav }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed." },
      { status: 500 },
    );
  }
}

// DELETE /api/profile/squad — remove groomer from squad
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession();
    const { groomerId } = await req.json();

    await db.favouriteGroomer.deleteMany({
      where: { userId: session.userId, groomerId },
    });

    // Re-number priorities
    const remaining = await db.favouriteGroomer.findMany({
      where: { userId: session.userId },
      orderBy: { priority: "asc" },
    });

    await Promise.all(
      remaining.map((f: any, i: number) =>
        db.favouriteGroomer.update({
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
