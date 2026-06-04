import { NextRequest, NextResponse } from "next/server";
import { loadSavingsSettings, setSkimRate } from "@/lib/savings";
import { requireSessionPro } from "../_shared";

// PATCH /api/partner/reserve/rate
// Body: { rate: number } — float in [sliderMin, sliderMax].
// setSkimRate handles the audit movement + idempotency for unchanged rates.
export async function PATCH(req: NextRequest) {
  const guard = await requireSessionPro();
  if (!guard.ok) return guard.response;
  const { proId } = guard.pro;

  const body = await req.json().catch(() => ({}));
  const raw = body?.rate;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  const settings = await loadSavingsSettings();
  if (!Number.isFinite(n) || n < settings.sliderMin || n > settings.sliderMax) {
    return NextResponse.json(
      {
        success: false,
        error: `Rate must be between ${(settings.sliderMin * 100).toFixed(0)}% and ${(settings.sliderMax * 100).toFixed(0)}%`,
      },
      { status: 400 },
    );
  }

  try {
    await setSkimRate(proId, n);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[partner/reserve/rate]", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
