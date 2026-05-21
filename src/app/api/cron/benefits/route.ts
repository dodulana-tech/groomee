import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { runMonthlyBenefitsDebit } from "@/lib/benefits";
import {
  notifyProBenefitDebitSuccess,
  notifyProBenefitInsufficientFunds,
  notifyProBenefitPaused,
  notifyProBenefitCancelled,
  notifyProBenefitGraceReminder,
} from "@/lib/whatsapp";

// Called monthly on the 1st at 02:00 UTC by Render Cron.
// Also runs as a daily nudge during grace windows — `runMonthlyBenefitsDebit`
// is idempotent per (enrolment, period) so running it daily is safe.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = (authHeader ?? "").replace("Bearer ", "");
  const expected = process.env.CRON_SECRET ?? "";
  const isValid =
    secret.length === expected.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runMonthlyBenefitsDebit();

  // Best-effort outbound nudges based on outcomes.
  for (const r of summary.results) {
    try {
      const enr = await db.proBenefitEnrollment.findUnique({
        where: { id: r.enrollmentId },
        include: {
          pro: { select: { phone: true } },
          plan: { select: { name: true } },
        },
      });
      if (!enr?.pro?.phone || !enr.plan) continue;

      if (r.status === "SUCCESS") {
        const now = new Date();
        const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
        await notifyProBenefitDebitSuccess(
          enr.pro.phone,
          enr.plan.name,
          r.amountDebited,
          period,
        );
      } else if (r.status === "INSUFFICIENT_FUNDS") {
        if (r.transitions.grace && enr.graceUntil) {
          await notifyProBenefitInsufficientFunds(
            enr.pro.phone,
            enr.plan.name,
            r.amountDebited,
            enr.graceUntil,
          );
        } else if (r.transitions.pause) {
          const settings = await db.setting.findUnique({
            where: { key: "BENEFITS_PAUSE_DAYS" },
          });
          await notifyProBenefitPaused(
            enr.pro.phone,
            enr.plan.name,
            Number(settings?.value) || 30,
          );
        } else if (r.transitions.cancel) {
          await notifyProBenefitCancelled(enr.pro.phone, enr.plan.name);
        } else if (enr.graceUntil && enr.status === "GRACE") {
          const daysLeft = Math.max(
            1,
            Math.ceil((enr.graceUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          );
          await notifyProBenefitGraceReminder(
            enr.pro.phone,
            enr.plan.name,
            r.amountDebited,
            daysLeft,
          );
        }
      }
    } catch (err) {
      console.error("[cron benefits] notify failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      attempted: summary.attempted,
      succeeded: summary.succeeded,
      failed: summary.failed,
      graceTransitions: summary.graceTransitions,
      pauseTransitions: summary.pauseTransitions,
      cancelTransitions: summary.cancelTransitions,
    },
    timestamp: new Date().toISOString(),
  });
}
