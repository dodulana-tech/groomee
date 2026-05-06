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
      select: { phone: true, email: true },
    });
    if (!sessionUser?.phone) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please add a phone number to your account before applying. We need it to send booking alerts.",
          needsPhone: true,
        },
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

    // Update the user email if provided AND it's different from what's set.
    // Surface a warning instead of silently swallowing — duplicates have
    // historically masked real problems.
    let emailWarning: string | null = null;
    if (email && email !== sessionUser.email) {
      const normalised = String(email).toLowerCase().trim();
      const taken = await db.user.findFirst({
        where: { email: normalised, id: { not: session.userId } },
        select: { id: true },
      });
      if (taken) {
        emailWarning =
          "We kept your existing email — the one you entered is already linked to another account.";
      } else {
        try {
          await db.user.update({
            where: { id: session.userId },
            data: { email: normalised },
          });
        } catch (err) {
          console.error("partner onboarding: email update failed", err);
          emailWarning = "We couldn't update your email — please change it later from your profile.";
        }
      }
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
      data: { proId: pro.id, ...(emailWarning ? { emailWarning } : {}) },
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
