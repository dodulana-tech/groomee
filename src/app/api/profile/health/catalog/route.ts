import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { HEALTH_CONDITIONS, type HealthCategoryKey } from "@/lib/health";

// Human-readable labels for each category. Kept inline rather than in the lib
// because they're presentational (the lib stays headless).
const CATEGORY_LABELS: Record<HealthCategoryKey, string> = {
  SKIN_SENSITIVITY: "Skin",
  ALLERGY: "Allergies",
  MOBILITY: "Mobility",
  REPRODUCTIVE: "Reproductive",
  CHRONIC: "Chronic conditions",
  MEDICATION: "Medication",
  OTHER: "Other",
};

const CATEGORY_ORDER: HealthCategoryKey[] = [
  "SKIN_SENSITIVITY",
  "ALLERGY",
  "REPRODUCTIVE",
  "CHRONIC",
  "MOBILITY",
  "MEDICATION",
  "OTHER",
];

// GET /api/profile/health/catalog — controlled vocab for the picker modal.
// Auth required (signed-in user) but does not need to own a profile yet.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const categories = CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
  }));

  return NextResponse.json({
    success: true,
    data: { categories, conditions: HEALTH_CONDITIONS },
  });
}
