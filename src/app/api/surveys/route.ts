import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { awardPoints, POINTS } from "@/lib/points";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, phone, email, answers } = body;

    if (!type || !answers) {
      return NextResponse.json(
        { success: false, error: "type and answers are required" },
        { status: 400 },
      );
    }

    // Check for duplicate submissions by phone
    if (phone) {
      const existing = await db.surveyResponse.findFirst({
        where: { phone, type },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: "You have already completed this survey." },
          { status: 409 },
        );
      }
    }

    const survey = await db.surveyResponse.create({
      data: { type, phone, email, answers },
    });

    // Award points if the user is logged in (matched by phone)
    if (phone) {
      const user = await db.user.findUnique({ where: { phone } });
      if (user) {
        await awardPoints(user.id, POINTS.SURVEY_COMPLETION, "Survey completion", survey.id).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, data: { id: survey.id } });
  } catch (err) {
    console.error("survey submission error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to submit survey." },
      { status: 500 },
    );
  }
}
