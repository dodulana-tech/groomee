/**
 * POST /api/profile/health/check
 *
 * Live preview of contraindications between the signed-in customer's health
 * profile and a candidate list of services. Used by BookingPanel to surface
 * BLOCK / WARN / INFO notices BEFORE the customer attempts to book — better
 * UX than failing on submit.
 *
 * This is a pure read: it does NOT write an access log (that happens at
 * booking-creation time and again when the pro is briefed). It only ever
 * runs against the caller's own profile.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkContraindications, highestLevel } from "@/lib/health";
import { z } from "zod";

const bodySchema = z
  .object({
    serviceIds: z.array(z.string().min(1)).min(1).max(16),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { serviceIds } = bodySchema.parse(body);

    // De-dupe so the caller can pass [primary, ...additional] verbatim.
    const uniqueIds = Array.from(new Set(serviceIds));

    const hits = await checkContraindications(session.userId, uniqueIds);
    const level = highestLevel(hits);

    return NextResponse.json({
      success: true,
      data: { hits, level },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0].message },
        { status: 400 },
      );
    }
    console.error("health check preview error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to check health profile." },
      { status: 500 },
    );
  }
}
