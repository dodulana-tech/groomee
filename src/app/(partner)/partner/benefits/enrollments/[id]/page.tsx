import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { deriveProTier } from "@/lib/benefits";
import { formatNaira } from "@/lib/utils";
import CancelCoverButton from "../../CancelCoverButton";
import OpenClaimLink from "../../OpenClaimLink";

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

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/auth?next=/partner/benefits/enrollments/${id}`);
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    redirect(`/auth?next=/partner/benefits/enrollments/${id}`);
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
          <p className="text-sm text-gray-500">You need a pro account to view benefits.</p>
        </div>
      </div>
    );
  }

  const enrollment = await db.proBenefitEnrollment.findUnique({
    where: { id },
    include: {
      plan: { include: { subsidyRules: true } },
      debits: { orderBy: { createdAt: "desc" }, take: 24 },
      claims: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!enrollment) notFound();
  // Ownership check
  if (enrollment.proId !== pro.id) notFound();

  const proTier = deriveProTier(pro);
  const rule = enrollment.plan.subsidyRules.find((r) => r.proTier === proTier);
  const subsidyPct = rule?.subsidyPct ?? 0;
  const subsidyAmount = Math.round(enrollment.plan.monthlyPremium * subsidyPct);
  const netDebit = Math.round(enrollment.plan.monthlyPremium - subsidyAmount);
  const grace = daysUntil(enrollment.graceUntil);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <Link
          href="/partner/benefits"
          className="text-xs font-bold text-gray-500 hover:text-gray-700"
        >
          ← Back to benefits
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {enrollment.plan.name}
        </h1>
        <p className="text-sm text-gray-500">{enrollment.plan.provider}</p>
      </div>

      {enrollment.status === "PENDING" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ⏳ Your enrolment is being activated. First debit on{" "}
          <strong>{formatDate(enrollment.nextDebitAt)}</strong>.
        </div>
      )}
      {enrollment.status === "ACTIVE" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          ✅ Your cover is active.
        </div>
      )}
      {enrollment.status === "GRACE" && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          ⚠️ Premium failed last cycle. Top up your wallet by{" "}
          <strong>{formatDate(enrollment.graceUntil)}</strong>
          {grace !== null && grace > 0 ? ` (in ${grace} day${grace === 1 ? "" : "s"})` : ""}
          to keep cover active.{" "}
          <Link href="/partner/wallet" className="font-bold underline">
            Top up now →
          </Link>
        </div>
      )}
      {enrollment.status === "PAUSED" && (
        <div className="rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
          ⏸️ Cover paused. Reactivate within 30 days or it'll be cancelled.{" "}
          <Link href="/partner/wallet" className="font-bold underline">
            Top up now →
          </Link>
        </div>
      )}
      {enrollment.status === "CANCELLED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ❌ This cover was cancelled on {formatDate(enrollment.cancelledAt)}.{" "}
          <Link href="/partner/benefits" className="font-bold underline">
            Re-enrol →
          </Link>{" "}
          (30-day waiting period applies).
        </div>
      )}

      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_PILL[enrollment.status] ?? STATUS_PILL.PENDING}`}
          >
            {enrollment.status}
          </span>
          {enrollment.externalPolicyNo && (
            <span className="text-xs text-gray-600">
              Policy: <span className="font-mono font-bold">{enrollment.externalPolicyNo}</span>
            </span>
          )}
        </div>

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

        {enrollment.plan.coverAmount ? (
          <p className="mt-4 text-sm text-gray-700">
            <strong>Cover:</strong> {formatNaira(enrollment.plan.coverAmount)}
          </p>
        ) : null}

        {enrollment.plan.highlights.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {enrollment.plan.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-600">✓</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
          <div>Enrolled: {formatDate(enrollment.enrolledAt)}</div>
          <div>Activated: {formatDate(enrollment.activatedAt)}</div>
          <div>Last debit: {formatDate(enrollment.lastDebitAt)}</div>
          <div>Next debit: {formatDate(enrollment.nextDebitAt)}</div>
        </div>
      </div>

      {/* Debits */}
      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Debit history</h2>
        </div>
        {enrollment.debits.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No debits yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {enrollment.debits.map((d) => (
              <div
                key={d.id}
                className="px-6 py-3 flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-semibold text-gray-900">{d.period}</p>
                  <p className="text-xs text-gray-500">
                    {formatNaira(d.premiumGross)} gross • Groomee covered{" "}
                    {formatNaira(d.subsidyAmount)}
                  </p>
                  {d.failureReason && (
                    <p className="text-xs text-red-600 mt-1">{d.failureReason}</p>
                  )}
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
          <h2 className="font-bold text-gray-900">Claims</h2>
          {enrollment.status !== "CANCELLED" && <OpenClaimLink />}
        </div>
        {enrollment.claims.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No claims yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {enrollment.claims.map((c) => (
              <div
                key={c.id}
                className="px-6 py-3 flex items-center justify-between text-sm"
              >
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

      {enrollment.status !== "CANCELLED" && (
        <div className="rounded-2xl border border-gray-100 bg-white/40 p-4 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Cancelling stops cover immediately. Re-enrolment needs a 30-day waiting period.
          </p>
          <CancelCoverButton enrollmentId={enrollment.id} />
        </div>
      )}
    </div>
  );
}
