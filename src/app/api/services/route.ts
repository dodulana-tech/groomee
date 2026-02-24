import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const services = await db.service.findMany({
    where: {
      isActive: true,
      ...(category ? { category: category as never } : {}),
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json({ success: true, data: services });
}
