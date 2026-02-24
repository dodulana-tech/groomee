import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { differenceInMonths } from "date-fns";
import type { GroomerCreditScore } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groomerId = searchParams.get("groomerId");
  if (!groomerId)
    return NextResponse.json(
      { success: false, error: "groomerId required." },
      { status: 400 },
    );

  const groomer = await db.groomer.findUnique({
    where: { id: groomerId },
  });

  if (!groomer)
    return NextResponse.json(
      { success: false, error: "Not found." },
      { status: 404 },
    );

  // ─── SCORE CALCULATION ─────────────────────────────────────────
  // Base: 300 points
  // Jobs completed: +5 per job (max 200)
  // Rating: (avgRating - 3) * 100 (max 200)
  // Months active: +10/month (max 100)
  // Strikes: -50 per strike
  // Advance repaid: +50
  // On-time rate: (rate - 0.5) * 200 (max 100)

  const settings = await db.setting.findMany({
    where: {
      key: {
        in: ["ADVANCE_MAX_AMOUNT", "ADVANCE_MIN_JOBS", "ADVANCE_MIN_RATING"],
      },
    },
  });
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  const monthsActive = differenceInMonths(new Date(), groomer.createdAt) + 1;
  const onTimeBookings = await db.booking.count({
    where: { groomerId, status: "CONFIRMED", arrivedAt: { not: null } },
  });
  const onTimeRate =
    groomer.totalJobs > 0 ? onTimeBookings / groomer.totalJobs : 0;

  const jobPoints = Math.min(groomer.totalJobs * 5, 200);
  const ratingPoints =
    groomer.avgRating > 0
      ? Math.min(Math.max((groomer.avgRating - 3) * 100, 0), 200)
      : 0;
  const tenurePoints = Math.min(monthsActive * 10, 100);
  const strikeDeduction = (groomer as any).strikes * 50;
  const advanceRepaidPoints = 0;
  const onTimePoints = Math.min(Math.max((onTimeRate - 0.5) * 200, 0), 100);

  const score = Math.round(
    Math.min(
      850,
      Math.max(
        300,
        300 +
          jobPoints +
          ratingPoints +
          tenurePoints -
          strikeDeduction +
          advanceRepaidPoints +
          onTimePoints,
      ),
    ),
  );

  const tier: GroomerCreditScore["tier"] =
    score >= 750
      ? "platinum"
      : score >= 650
        ? "gold"
        : score >= 550
          ? "silver"
          : "bronze";

  const minJobs = parseInt(settingsMap.ADVANCE_MIN_JOBS ?? "10");
  const minRating = parseFloat(settingsMap.ADVANCE_MIN_RATING ?? "4.0");
  const maxAdvanceBase = parseFloat(settingsMap.ADVANCE_MAX_AMOUNT ?? "30000");

  const advanceEligible =
    groomer.totalJobs >= minJobs &&
    groomer.avgRating >= minRating &&
    groomer.status === "ACTIVE";

  // Scale max advance by score tier
  const tierMultiplier =
    tier === "platinum"
      ? 2.0
      : tier === "gold"
        ? 1.5
        : tier === "silver"
          ? 1.0
          : 0.5;
  const maxAdvanceAmount = Math.min(maxAdvanceBase * tierMultiplier, 100000);

  const result: GroomerCreditScore = {
    score,
    tier,
    completedJobs: groomer.totalJobs,
    avgRating: groomer.avgRating,
    monthsActive,
    onTimeRate,
    advanceEligible,
    maxAdvanceAmount,
    events: [],
  };

  return NextResponse.json({ success: true, data: result });
}

// Helper to award credit points after a booking is confirmed
async function awardCreditForBooking(
  groomerId: string,
  bookingId: string,
  rating: number,
) {
  const events = [
    {
      eventType: "job_complete",
      points: 5,
      description: "Completed a booking",
    },
    ...(rating >= 4.5
      ? [
          {
            eventType: "good_review",
            points: 10,
            description: `Received a ${rating}★ review`,
          },
        ]
      : []),
  ];

  await db.groomerCreditEvent.createMany({
    data: events.map((e) => ({ groomerId, ...e })),
  });
}
