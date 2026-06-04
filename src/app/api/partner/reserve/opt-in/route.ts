import { NextRequest, NextResponse } from "next/server";
import { loadSavingsSettings, optInPro } from "@/lib/savings";
import { requireSessionPro } from "../_shared";

// POST /api/partner/reserve/opt-in
// Body: { rate?: number }
// Opt the pro into the Earnings Reserve. Idempotent — calling repeatedly with
// the same rate is a no-op (no extra movement row). Rate defaults to the
// platform default if not provided.
export async function POST(req: NextRequest) {
  const guard = await requireSessionPro();
  if (!guard.ok) return guard.response;
  const { proId } = guard.pro;

  const body = await req.json().catch(() => ({}));
  const rawRate = body?.rate;
  const settings = await loadSavingsSettings();

  let rate = settings.rate;
  if (rawRate != null) {
    const n = typeof rawRate === "number" ? rawRate : parseFloat(String(rawRate));
    if (!Number.isFinite(n) || n < settings.sliderMin || n > settings.sliderMax) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate must be between ${(settings.sliderMin * 100).toFixed(0)}% and ${(settings.sliderMax * 100).toFixed(0)}%`,
        },
        { status: 400 },
      );
    }
    rate = n;
  }

  try {
    await optInPro(proId, { rate });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[partner/reserve/opt-in]", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
