import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { name, email, bio, services, zones, bankName, bankAccount } = body;

    // Use the authenticated user's phone — never trust the request body
    const sessionUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { phone: true },
    });
    if (!sessionUser?.phone) {
      return NextResponse.json(
        { success: false, error: "Could not resolve your phone number" },
        { status: 400 },
      );
    }
    const phone = sessionUser.phone;

    // Validate required fields
    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: "Name and phone are required" },
        { status: 400 },
      );
    }

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one service is required" },
        { status: 400 },
      );
    }

    if (!zones || !Array.isArray(zones) || zones.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one zone is required" },
        { status: 400 },
      );
    }

    // Upsert the Pro record by phone, linking to the authenticated user
    const pro = await db.pro.upsert({
      where: { phone },
      update: {
        name,
        bio: bio || null,
        bankName: bankName || null,
        bankAccountNo: bankAccount || null,
        userId: session.userId,
      },
      create: {
        name,
        phone,
        bio: bio || null,
        bankName: bankName || null,
        bankAccountNo: bankAccount || null,
        status: "PENDING",
        availability: "OFFLINE",
        userId: session.userId,
      },
    });

    // Note: User role stays CUSTOMER until admin approves the Pro (PENDING → ACTIVE).
    // The signUserToken function auto-detects approved Pro records and upgrades the role.

    // Update the user email if provided
    if (email) {
      await db.user.update({
        where: { id: session.userId },
        data: { email },
      }).catch(() => {
        // Non-critical: email update may fail if duplicate
      });
    }

    // Resolve service IDs from category names (e.g. "HAIR", "MAKEUP")
    const serviceRecords = await db.service.findMany({
      where: { category: { in: services }, isActive: true },
    });

    // Resolve zone IDs from zone names (e.g. "Lekki Phase 1")
    const zoneRecords = await db.zone.findMany({
      where: { name: { in: zones } },
    });

    // Clear existing services and zones, then re-create
    await db.$transaction([
      db.proService.deleteMany({ where: { proId: pro.id } }),
      db.proZone.deleteMany({ where: { proId: pro.id } }),

      // Create new service links
      ...(serviceRecords.length > 0
        ? [
            db.proService.createMany({
              data: serviceRecords.map((s) => ({
                proId: pro.id,
                serviceId: s.id,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),

      // Create new zone links
      ...(zoneRecords.length > 0
        ? [
            db.proZone.createMany({
              data: zoneRecords.map((z) => ({
                proId: pro.id,
                zoneId: z.id,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return NextResponse.json({
      success: true,
      data: { proId: pro.id },
      message: "Onboarding application submitted",
    });
  } catch (err) {
    console.error("partner onboarding POST error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to submit onboarding" },
      { status: 500 },
    );
  }
}
