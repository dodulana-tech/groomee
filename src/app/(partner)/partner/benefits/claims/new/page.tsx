import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import ClaimForm from "./ClaimForm";

export const revalidate = 0;

export default async function NewClaimPage() {
  const session = await getSession();
  if (!session) redirect("/auth?next=/partner/benefits/claims/new");
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    redirect("/auth?next=/partner/benefits/claims/new");
  }

  const pro = await db.pro.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!pro) {
    return (
      <div className="p-6 lg:p-8">
        <div className="glass rounded-2xl border border-white/20 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">No pro account</h1>
          <p className="text-sm text-gray-500">
            You need a pro account to file a claim.
          </p>
        </div>
      </div>
    );
  }

  const enrollment = await db.proBenefitEnrollment.findFirst({
    where: {
      proId: pro.id,
      status: { in: ["ACTIVE", "GRACE", "PENDING", "PAUSED"] },
    },
    include: { plan: { select: { id: true, name: true, provider: true, kind: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (!enrollment) {
    return (
      <div className="p-6 lg:p-8">
        <div className="glass rounded-2xl border border-white/20 p-8 max-w-xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            No active cover
          </h1>
          <p className="text-sm text-gray-600">
            You need an active benefits enrolment before you can open a claim.
          </p>
          <Link
            href="/partner/benefits"
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700"
          >
            ← Back to benefits
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/partner/benefits"
          className="text-xs font-bold text-gray-500 hover:text-gray-700"
        >
          ← Back to benefits
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Open a claim</h1>
        <p className="text-sm text-gray-500">
          We log your claim for tracking. The insurer handles the actual case
          directly with you.
        </p>
      </div>

      {/* Enrollment context */}
      <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Your cover
        </p>
        <h2 className="mt-1 font-black text-gray-900">{enrollment.plan.name}</h2>
        <p className="text-sm text-gray-500">{enrollment.plan.provider}</p>
      </div>

      {/* Privacy hint */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        <p className="font-bold">Privacy first</p>
        <p className="mt-1 text-amber-800 leading-relaxed">
          Don't paste medical detail here — share that directly with the insurer
          for privacy. We only log a short label so we can follow up on your
          case.
        </p>
      </div>

      <ClaimForm enrollmentId={enrollment.id} planKind={enrollment.plan.kind} />
    </div>
  );
}
