import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session = await requireSession();
    const { reason } = await req.json();

    const sub = await db.subscription.findUnique({
      where: { id },
    });

    if (!sub)
      return NextResponse.json(
        { success: false, error: "Not found." },
        { status: 404 },
      );

    if (sub.userId !== session.userId && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden." },
        { status: 403 },
      );
    }

    if (sub.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "Subscription is not active." },
        { status: 400 },
      );
    }

    await db.subscription.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason ?? "Customer request",
      },
    });

    return NextResponse.json({
      success: true,
      data: { cancelled: true },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed." },
      { status: 500 },
    );
  }
}
