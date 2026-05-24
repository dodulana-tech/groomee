import { NextResponse } from "next/server";
import { optOutPro } from "@/lib/savings";
import { requireSessionPro } from "../_shared";

// POST /api/partner/reserve/opt-out
// Pause the Reserve. Existing balance is preserved — pros can withdraw it on
// the same notice / instant terms they had at the time of opt-in. They can
// resume at any time via /opt-in.
export async function POST() {
  const guard = await requireSessionPro();
  if (!guard.ok) return guard.response;
  const { proId } = guard.pro;

  try {
    await optOutPro(proId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[partner/reserve/opt-out]", err);
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
