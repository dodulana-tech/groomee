import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkEnrolmentEligibility, deriveProTier } from "@/lib/benefits";
import { formatNaira } from "@/lib/utils";
import EnrolButton from "./EnrolButton";
import CancelCoverButton from "./CancelCoverButton";
import OpenClaimLink from "./OpenClaimLink";

export const revalidate = 0;

const STATUS_PILL: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ACTIVE: "bg-green-100 text-green-700",
  GRACE: "bg-orange-100 text-orange-700",
  PAUSED: "bg-gray-200 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const CLAIM_STATUS_PILL: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const DEBIT_STATUS_PILL: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  INSUFFICIENT_FUNDS: "bg-orange-100 text-orange-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-gray-100 text-gray-600",
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default async function PartnerBenefitsPage() {
  const session = await getSession();
  if (!session) redirect("/auth?next=/partner/benefits");
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    redirect("/auth?next=/partner/benefits");
  }

  const pro = await db.pro.findFirst({
    where: { userId: session.userId },
    select: { id: true, totalJobs: true, avgRating: true },
  });
  if (!pro) {
    return (
      <div className="p-6 lg:p-8">
        <div className="glass rounded-2xl border border-white/20 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">No pro account</h1>
          <p className="text-sm text-gray-500">
            You need an active pro account on Groomee to enrol in benefits.
          </p>
        </div>
      </div>
    );
  }

  const proTier = deriveProTier(pro);

  const enrollment = await db.proBenefitEnrollment.findFirst({
    where: { proId: pro.id, status: { not: "CANCELLED" } },
    include: {
      plan: { include: { subsidyRules: true } },
      debits: { orderBy: { createdAt: "desc" }, take: 6 },
      claims: { orderBy: { createdAt: "desc" }, take: 20 },
    },
    orderBy: { updatedAt: "desc" },
  });

  // If pro already has an active-ish enrolment, render the management view
  if (enrollment) {
    return renderEnrolmentView({ enrollment, proTier });
  }

  // Otherwise: pitch + plan list + eligibility
  const plans = await db.benefitPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { subsidyRules: true },
  });

  const eligibilityResults = await Promise.all(
    plans.map((p) => checkEnrolmentEligibility(pro.id, p.id)),
  );

  // Also fetch any past cancelled enrolment so we can show re-enrol context
  const lastCancelled = await db.proBenefitEnrollment.findFirst({
    where: { proId: pro.id, status: "CANCELLED" },
    orderBy: { cancelledAt: "desc" },
    include: { plan: { select: { name: true } } },
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Benefits</h1>
        <p className="text-sm text-gray-500">
          Health cover and accident protection for Groomee pros.
        </p>
      </div>

      {/* Hero */}
      <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-teal-500/10 p-6 lg:p-8 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🛡️</span>
          <div>
            <h2 className="text-xl font-black text-gray-900">
              Health cover when you need it.
            </h2>
            <p className="mt-2 text-sm text-gray-700 leading-relaxed max-w-2xl">
              ₦3,100/month covers your hospital visits at 200+ hospitals in
              Lagos and Abuja, plus ₦1,000,000 accident cover. Backed by{" "}
              <strong>Reliance HMO</strong> and <strong>Leadway</strong>.
              Groomee never holds your medical record — you deal with the
              insurer directly when you need to.
            </p>
          </div>
        </div>
      </div>

      {lastCancelled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          You previously cancelled your <strong>{lastCancelled.plan.name}</strong> cover on{" "}
          {formatDate(lastCancelled.cancelledAt)}. Re-enrolment requires a fresh 30-day
          waiting period before cover begins.
        </div>
      )}

      {plans.map((plan, i) => {
        const rule = plan.subsidyRules.find((r) => r.proTier === proTier);
        const subsidyPct = rule?.subsidyPct ?? 0;
        const subsidyAmount = Math.round(plan.monthlyPremium * subsidyPct);
        const netDebit = Math.round(plan.monthlyPremium - subsidyAmount);
        const elig = eligibilityResults[i];
        return (
          <div
            key={plan.id}
            className="glass rounded-2xl border border-white/20 p-6 shadow-lg"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">{plan.name}</h3>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {plan.provider}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-brand-700">
                  {formatNaira(netDebit)}
                  <span className="text-sm font-medium text-gray-500"> /month</span>
                </p>
                {subsidyAmount > 0 ? (
                  <p className="text-xs text-green-700 font-semibold">
                    Groomee covers {formatNaira(subsidyAmount)} at your {proTier} tier
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    Full premium {formatNaira(plan.monthlyPremium)}/month
                  </p>
                )}
              </div>
            </div>

            {plan.description && (
              <p className="mt-3 text-sm text-gray-600">{plan.description}</p>
            )}

            {plan.coverAmount ? (
              <p className="mt-2 text-sm text-gray-700">
                <strong>Cover:</strong> {formatNaira(plan.coverAmount)}
              </p>
            ) : null}

            {plan.highlights.length > 0 && (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {plan.highlights.map((h) => (
                  <li
                    key={h}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="text-green-600">✓</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Eligibility */}
            <div className="mt-5 rounded-xl bg-white/60 border border-gray-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Your eligibility
              </p>
              <EligibilityChecklist
                eligible={elig.eligible}
                details={elig.details}
                reasons={elig.reasons}
              />
              {!elig.eligible && elig.details.walletAvailable < elig.details.requiredPremium && (
                <Link
                  href="/partner/wallet"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800"
                >
                  Top up your wallet →
                </Link>
              )}
            </div>

            <div className="mt-5">
              <EnrolButton planId={plan.id} disabled={!elig.eligible} />
              <p className="mt-2 text-[11px] text-gray-500">
                First debit happens today. After that, premium is taken on the
                1st of every month from your Groomee wallet — never from your
                Reserve savings.
              </p>
            </div>
          </div>
        );
      })}

      <div className="rounded-2xl border border-gray-100 bg-white/60 p-4 text-xs text-gray-500">
        Insurance underwritten by <strong>Reliance HMO</strong> (NHIA-licensed)
        and <strong>Leadway Assurance</strong> (NAICOM-licensed). Groomee is an
        aggregator, not an insurer.
      </div>
    </div>
  );
}

function renderEnrolmentView({
  enrollment,
  proTier,
}: {
  enrollment: NonNullable<
    Awaited<
      ReturnType<typeof db.proBenefitEnrollment.findFirst>
    >
  > & {
    plan: { subsidyRules: { proTier: string; subsidyPct: number }[] } & {
      name: string;
      provider: string;
      monthlyPremium: number;
      coverAmount: number | null;
      highlights: string[];
    };
    debits: {
      id: string;
      period: string;
      premiumGross: number;
      subsidyAmount: number;
      amountDebited: number;
      status: string;
      createdAt: Date;
      failureReason: string | null;
    }[];
    claims: {
      id: string;
      kind: string;
      summary: string;
      status: string;
      externalRef: string | null;
      createdAt: Date;
      resolvedAt: Date | null;
    }[];
  };
  proTier: string;
}) {
  const rule = enrollment.plan.subsidyRules.find((r) => r.proTier === proTier);
  const subsidyPct = rule?.subsidyPct ?? 0;
  const subsidyAmount = Math.round(enrollment.plan.monthlyPremium * subsidyPct);
  const netDebit = Math.round(enrollment.plan.monthlyPremium - subsidyAmount);

  const grace = daysUntil(enrollment.graceUntil);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Benefits</h1>
        <p className="text-sm text-gray-500">Your cover at a glance.</p>
      </div>

      {/* Status banner */}
      {enrollment.status === "PENDING" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ⏳ Your enrolment is being activated. First debit on{" "}
          <strong>{formatDate(enrollment.nextDebitAt)}</strong>.
        </div>
      )}
      {enrollment.status === "ACTIVE" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          ✅ Your cover is active. Use your hospital card or call the insurer's
          helpline if you need to claim.
        </div>
      )}
      {enrollment.status === "GRACE" && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          ⚠️ Premium failed last cycle. Top up your wallet by{" "}
          <strong>{formatDate(enrollment.graceUntil)}</strong>
          {grace !== null && grace > 0 ? ` (in ${grace} day${grace === 1 ? "" : "s"})` : ""} to
          keep cover active.{" "}
          <Link
            href="/partner/wallet"
            className="font-bold underline hover:no-underline"
          >
            Top up now →
          </Link>
        </div>
      )}
      {enrollment.status === "PAUSED" && (
        <div className="rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
          ⏸️ Cover paused. Reactivate within 30 days by topping up — after that
          re-enrolment needs a fresh 30-day waiting period.{" "}
          <Link
            href="/partner/wallet"
            className="font-bold underline hover:no-underline"
          >
            Top up now →
          </Link>
        </div>
      )}

      {/* Cover card */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Your plan
            </p>
            <h2 className="mt-1 text-xl font-black text-gray-900">
              {enrollment.plan.name}
            </h2>
            <p className="text-sm text-gray-500">{enrollment.plan.provider}</p>
            {enrollment.externalPolicyNo && (
              <p className="mt-1 text-xs text-gray-600">
                Hospital card / policy:{" "}
                <span className="font-mono font-bold">
                  {enrollment.externalPolicyNo}
                </span>
              </p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_PILL[enrollment.status] ?? STATUS_PILL.PENDING}`}
          >
            {enrollment.status}
          </span>
        </div>

        {enrollment.plan.coverAmount ? (
          <p className="mt-4 text-sm text-gray-700">
            <strong>Cover:</strong> {formatNaira(enrollment.plan.coverAmount)}
          </p>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white/60 border border-gray-100 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Gross premium
            </p>
            <p className="mt-1 text-lg font-black text-gray-900">
              {formatNaira(enrollment.plan.monthlyPremium)}
            </p>
          </div>
          <div className="rounded-xl bg-white/60 border border-gray-100 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Groomee covers ({proTier})
            </p>
            <p className="mt-1 text-lg font-black text-green-700">
              {formatNaira(subsidyAmount)}
            </p>
          </div>
          <div className="rounded-xl bg-brand-50 border border-brand-100 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">
              You pay / month
            </p>
            <p className="mt-1 text-lg font-black text-brand-800">
              {formatNaira(netDebit)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-white/40 border border-gray-100 p-3 text-xs text-gray-600">
          Next debit: <strong>{formatDate(enrollment.nextDebitAt)}</strong>
          {netDebit > 0 ? <> • {formatNaira(netDebit)} from your wallet</> : null}
        </div>

        {enrollment.plan.highlights.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {enrollment.plan.highlights.map((h) => (
              <li
                key={h}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="text-green-600">✓</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Debits */}
      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent debits</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Last 6 months of premium debits from your wallet.
          </p>
        </div>
        {enrollment.debits.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            No debits yet — your first one is scheduled for{" "}
            {formatDate(enrollment.nextDebitAt)}.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {enrollment.debits.map((d) => (
              <div key={d.id} className="px-6 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-gray-900">{d.period}</p>
                  <p className="text-xs text-gray-500">
                    {formatNaira(d.premiumGross)} gross • Groomee covered{" "}
                    {formatNaira(d.subsidyAmount)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">
                    {formatNaira(d.amountDebited)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${DEBIT_STATUS_PILL[d.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {d.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Claims */}
      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">Your claims</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              We log claims for tracking — the insurer handles the actual case directly.
            </p>
          </div>
          <OpenClaimLink />
        </div>
        {enrollment.claims.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            No claims yet. If you need to use your cover, open a claim — and call
            the insurer's helpline for anything urgent.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {enrollment.claims.map((c) => (
              <div key={c.id} className="px-6 py-3 flex items-center justify-between text-sm">
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-600">{c.kind}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {formatDate(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 truncate">{c.summary}</p>
                  {c.externalRef && (
                    <p className="text-[11px] text-gray-500">
                      Ref: <span className="font-mono">{c.externalRef}</span>
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${CLAIM_STATUS_PILL[c.status] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {c.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel */}
      <div className="rounded-2xl border border-gray-100 bg-white/40 p-4 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Need to stop your cover? Cancelling takes effect immediately.
        </p>
        <CancelCoverButton enrollmentId={enrollment.id} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white/40 p-4 text-xs text-gray-500">
        Insurance underwritten by <strong>Reliance HMO</strong> (NHIA-licensed)
        and <strong>Leadway Assurance</strong> (NAICOM-licensed). Groomee is an
        aggregator, not an insurer.
      </div>
    </div>
  );
}

function EligibilityChecklist({
  eligible,
  details,
  reasons,
}: {
  eligible: boolean;
  details: {
    completedBookings30d: number;
    daysSinceFirstBooking: number | null;
    walletAvailable: number;
    requiredPremium: number;
    minBookings: number;
    minTenureDays: number;
  };
  reasons: string[];
}) {
  const bookingsOk = details.completedBookings30d >= details.minBookings;
  const tenureOk =
    details.daysSinceFirstBooking !== null &&
    details.daysSinceFirstBooking >= details.minTenureDays;
  const walletOk = details.walletAvailable >= details.requiredPremium;
  return (
    <ul className="space-y-1.5 text-sm">
      <li className="flex items-start gap-2">
        <span className={bookingsOk ? "text-green-600" : "text-red-500"}>
          {bookingsOk ? "✓" : "✗"}
        </span>
        <span className="text-gray-700">
          {details.minBookings}+ bookings in last 30 days (you have{" "}
          {details.completedBookings30d})
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className={tenureOk ? "text-green-600" : "text-red-500"}>
          {tenureOk ? "✓" : "✗"}
        </span>
        <span className="text-gray-700">
          {details.minTenureDays}+ days on Groomee (you have{" "}
          {details.daysSinceFirstBooking ?? 0})
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className={walletOk ? "text-green-600" : "text-red-500"}>
          {walletOk ? "✓" : "✗"}
        </span>
        <span className="text-gray-700">
          Wallet covers 1 month premium (you have {formatNaira(details.walletAvailable)},
          need {formatNaira(details.requiredPremium)})
        </span>
      </li>
      {!eligible && reasons.some((r) => r.toLowerCase().includes("already")) && (
        <li className="flex items-start gap-2 mt-2">
          <span className="text-amber-500">!</span>
          <span className="text-gray-700">You already have an enrolment on this plan.</span>
        </li>
      )}
    </ul>
  );
}
