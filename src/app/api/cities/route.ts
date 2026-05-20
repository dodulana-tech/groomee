import { NextResponse } from "next/server";
import { getPublicCities } from "@/lib/cities";

// GET /api/cities - public list of LIVE + WAITLIST cities. HIDDEN never
// appears here. Drives the landing-page nav + city selector + jsonLd.
export async function GET() {
  try {
    const cities = await getPublicCities();
    return NextResponse.json({
      success: true,
      data: cities.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        status: c.status,
        launchedAt: c.launchedAt,
        tagline: c.tagline,
        sortOrder: c.sortOrder,
      })),
    });
  } catch (err) {
    console.error("[api/cities GET] error", err);
    return NextResponse.json(
      { success: false, error: "Failed to load cities." },
      { status: 500 },
    );
  }
}
