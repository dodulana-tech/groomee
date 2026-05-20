import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { HEALTH_PERMISSIONS, writeAccessLog, findConditionDef } from "@/lib/health";
import { logAdminAction } from "@/lib/admin-audit";

export const revalidate = 0;

const SEVERITY_PILL: Record<string, string> = {
  MILD: "bg-blue-50 text-blue-700",
  MODERATE: "bg-amber-50 text-amber-700",
  SEVERE: "bg-red-50 text-red-700",
};

const VISIBILITY_LABEL: Record<string, string> = {
  ALWAYS_SHARE: "Always shared with assigned pro",
  ASK_PER_BOOKING: "Ask per booking",
  PRIVATE: "Private — admin/customer only",
};

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function AdminHealthProfilePage({ params }: Props) {
  const { userId } = await params;

  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, HEALTH_PERMISSIONS.view)) {
    redirect("/admin");
  }

  const profile = await db.healthProfile.findUnique({
    where: { userId },
    include: {
      conditions: { orderBy: { createdAt: "asc" } },
      user: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  if (!profile) {
    notFound();
  }

  // Audit trail — write both the PHI access log AND an ActivityLog row
  // on every render. Best-effort; failures must not block the read.
  try {
    await writeAccessLog(profile.id, "ADMIN", session.userId, "admin_view");
  } catch (err) {
    console.error("[admin/health/profiles page] access-log failed", err);
  }
  await logAdminAction({
    adminId: session.userId,
    action: "health.view_profile",
    entityType: "health_profile",
    entityId: profile.id,
    metadata: {
      userId: profile.userId,
      conditionCount: profile.conditions.length,
      source: "admin_page",
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/health"
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            ← Back to Health & care
          </Link>
          <h2 className="text-xl font-bold text-gray-900 mt-1">
            {profile.user.name ?? "Unnamed customer"}
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">
            {profile.user.phone}
            {profile.user.email && <> · {profile.user.email}</>}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          PHI — every view is logged.
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Visibility
          </p>
          <p className="text-sm font-semibold text-gray-900 mt-1">
            {VISIBILITY_LABEL[profile.visibility] ?? profile.visibility}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Conditions
          </p>
          <p className="text-2xl font-black text-gray-900 mt-1">
            {profile.conditions.length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Last reviewed
          </p>
          <p className="text-sm font-semibold text-gray-900 mt-1">
            {profile.lastReviewedAt
              ? new Date(profile.lastReviewedAt).toLocaleDateString("en-NG")
              : "Never"}
          </p>
        </div>
      </div>

      {/* Notes */}
      {profile.notes && (
        <section className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Notes from customer
          </h3>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 whitespace-pre-wrap">
            {profile.notes}
          </div>
        </section>
      )}

      {/* Conditions */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
          Conditions
        </h3>
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Started</th>
              </tr>
            </thead>
            <tbody>
              {profile.conditions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No conditions recorded.
                  </td>
                </tr>
              )}
              {profile.conditions.map((c) => {
                const def = findConditionDef(c.code);
                return (
                  <tr
                    key={c.id}
                    className="border-t border-gray-100 hover:bg-gray-50/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.label}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {c.code}
                      </div>
                      {def?.hint && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {def.hint}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {c.category}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                          SEVERITY_PILL[c.severity]
                        }`}
                      >
                        {c.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.resolved ? (
                        <span className="text-xs text-gray-400">Resolved</span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                      {c.notes ? (
                        <span className="line-clamp-2">{c.notes}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {c.startedAt
                        ? new Date(c.startedAt).toLocaleDateString("en-NG")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
