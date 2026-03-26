import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const pro = await db.pro.findFirst({
    where: { id, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      idVerified: true,
      availability: true,
      avgRating: true,
      reviewCount: true,
      totalJobs: true,
      services: {
        include: { service: true },
        where: { service: { isActive: true } },
      },
      zones: { include: { zone: true } },
    },
  });

  if (!pro) {
    return NextResponse.json(
      { success: false, error: "Pro not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, data: pro });
}
