import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission, hasAnyPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateSettingsCache } from "@/lib/surcharge";
import { invalidateBookingModeCache } from "@/lib/booking-mode";
import { revalidatePath } from "next/cache";

export async function GET() {
  try {
    const session = await getSession();
    if (!hasPermission(session, "settings.view")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
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
    const session = await getSession();
    if (!hasAnyPermission(session, "settings.manage_ops", "settings.manage_finance")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
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
    if ("WHATSAPP_BOOKING_MODE" in settings) {
      invalidateBookingModeCache();
      revalidatePath("/", "layout"); // homepage + sitemap are cached
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to save settings." },
      { status: 500 },
    );
  }
}
