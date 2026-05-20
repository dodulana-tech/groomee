import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { CITY_PERMISSIONS } from "@/lib/cities";
import { logAdminAction } from "@/lib/admin-audit";

const patchSchema = z
  .object({
    status: z.enum(["HIDDEN", "WAITLIST", "LIVE"]).optional(),
    tagline: z.string().max(200).nullable().optional(),
    sortOrder: z.number().int().optional(),
    launchedAt: z.string().datetime().nullable().optional(),
    name: z.string().min(2).max(40).optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, "Empty patch");

// PATCH /api/admin/cities/[slug] — toggle status / edit metadata.
//
// Flipping a city from non-LIVE → LIVE auto-stamps launchedAt (if not set)
// and queues a best-effort notification to the existing waitlist for that
// city. Notifications never block the response.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await getSession();
  if (!hasPermission(session, CITY_PERMISSIONS.manage)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        },
        { status: 400 },
      );
    }

    const before = await db.city.findUnique({ where: { slug } });
    if (!before) {
      return NextResponse.json(
        { success: false, error: "City not found" },
        { status: 404 },
      );
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.tagline !== undefined) data.tagline = parsed.data.tagline;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.launchedAt !== undefined) {
      data.launchedAt = parsed.data.launchedAt
        ? new Date(parsed.data.launchedAt)
        : null;
    }

    // Stamp launchedAt automatically on first flip to LIVE.
    const isGoingLive =
      parsed.data.status === "LIVE" && before.status !== "LIVE";
    if (isGoingLive && data.launchedAt === undefined && !before.launchedAt) {
      data.launchedAt = new Date();
    }

    const updated = await db.city.update({
      where: { slug },
      data,
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "city.update",
      entityType: "city",
      entityId: updated.id,
      metadata: {
        slug,
        before: { status: before.status, launchedAt: before.launchedAt },
        after: { status: updated.status, launchedAt: updated.launchedAt },
      },
    });

    // Fire-and-forget waitlist notification. Same pattern as the care-notes
    // hook — never block the admin response on a delivery failure.
    if (isGoingLive) {
      import("@/lib/city-notify")
        .then(({ notifyCityLive }) =>
          notifyCityLive(updated.slug, session!.userId),
        )
        .catch(() => {});
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[api/admin/cities PATCH] error", err);
    return NextResponse.json(
      { success: false, error: "Failed to update city." },
      { status: 500 },
    );
  }
}
