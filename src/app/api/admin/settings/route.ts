import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateSettingsCache } from "@/lib/surcharge";

export async function GET() {
  try {
    await requireAdmin();
    const settings = await db.setting.findMany({ orderBy: { key: "asc" } });
    return NextResponse.json({ success: true, data: settings });
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
    const { settings } = (await req.json()) as {
      settings: Record<string, string>;
    };

    await Promise.all(
      Object.entries(settings).map(([key, value]) =>
        db.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );

    // Bust the surcharge cache
    await invalidateSettingsCache();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to save settings." },
      { status: 500 },
    );
  }
}
