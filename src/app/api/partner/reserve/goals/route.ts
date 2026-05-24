import { NextRequest, NextResponse } from "next/server";
import { setGoalLabels } from "@/lib/savings";
import { requireSessionPro } from "../_shared";

// PATCH /api/partner/reserve/goals
// Body: { goals: Array<{ name: string, sortOrder?: number }> }
//
// Goals are display-only labels stored as a string[] in goalLabels. Max 3
// active in the partner UI; we sanitize aggressively (trim, length cap, dedup)
// before persisting. Sort order is preserved by array index.
const MAX_GOALS = 3;
const NAME_MIN = 1;
const NAME_MAX = 32;

export async function PATCH(req: NextRequest) {
  const guard = await requireSessionPro();
  if (!guard.ok) return guard.response;
  const { proId } = guard.pro;

  const body = await req.json().catch(() => ({}));
  const raw = body?.goals;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { success: false, error: "Body must include a goals array" },
      { status: 400 },
    );
  }

  // Normalize → { name, sortOrder } shape, then sort, then collapse to
  // sanitized string list capped at MAX_GOALS.
  const cleaned: { name: string; sortOrder: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (name.length < NAME_MIN || name.length > NAME_MAX) continue;
    const sortOrder =
      typeof item.sortOrder === "number" && Number.isFinite(item.sortOrder)
        ? item.sortOrder
        : i;
    cleaned.push({ name, sortOrder });
  }
  cleaned.sort((a, b) => a.sortOrder - b.sortOrder);
  const labels = Array.from(new Set(cleaned.map((g) => g.name))).slice(0, MAX_GOALS);

  try {
    await setGoalLabels(proId, labels);
    return NextResponse.json({
      success: true,
      data: { goals: labels.map((name, idx) => ({ name, sortOrder: idx })) },
    });
  } catch (err) {
    console.error("[partner/reserve/goals]", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
