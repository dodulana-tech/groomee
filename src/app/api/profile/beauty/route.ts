import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const profileSchema = z.object({
  hairType: z.string().optional(),
  hairLength: z.string().optional(),
  hairTexture: z.string().optional(),
  scalpCondition: z.string().optional(),
  colourTreated: z.boolean().optional(),
  skinTone: z.string().optional(),
  skinType: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  preferredProducts: z.array(z.string()).optional(),
  avoidProducts: z.array(z.string()).optional(),
  favouriteStyles: z.array(z.string()).optional(),
  styleNotes: z.string().max(1000).optional(),
});

export async function GET() {
  try {
    const session = await requireSession();
    const profile = await db.beautyProfile.findUnique({
      where: { userId: session.userId },
    });
    return NextResponse.json({ success: true, data: profile });
  } catch {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const data = profileSchema.parse(body);

    const profile = await db.beautyProfile.upsert({
      where: { userId: session.userId },
      update: data,
      create: { userId: session.userId, ...data },
    });

    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to save profile." },
      { status: 500 },
    );
  }
}
