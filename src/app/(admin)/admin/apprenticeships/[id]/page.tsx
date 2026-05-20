import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPRENTICESHIP_PERMISSIONS } from "@/lib/apprenticeships";
import { formatNaira } from "@/lib/utils";
import ApprenticeshipActions from "./ApprenticeshipActions";

export const revalidate = 0;

const STATUS_STYLE: Record<string, string> = {
  PENDING_ACCEPT: "bg-amber-50 text-amber-700",
  IN_TRAINING: "bg-blue-50 text-blue-700",
  READY_FOR_FREEDOM: "bg-green-50 text-green-700",
  FREED: "bg-purple-50 text-purple-700",
  TERMINATED: "bg-red-50 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_ACCEPT: "Pending accept",
  IN_TRAINING: "In training",
  READY_FOR_FREEDOM: "Ready for Freedom",
  FREED: "Freed",
  TERMINATED: "Terminated",
};

export default async function AdminApprenticeshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, APPRENTICESHIP_PERMISSIONS.view)) {
    redirect("/admin");
  }
  const canManage = hasPermission(session, APPRENTICESHIP_PERMISSIONS.manage);

  const apprenticeship = await db.apprenticeship.findUnique({
    where: { id },
    include: {
      apprentice: {
        select: {
          id: true,
          name: true,
          phone: true,
          photo: true,
          status: true,
          availability: true,
          totalJobs: true,
          avgRating: true,
          reviewCount: true,
          relationship: true,
          parentProId: true,
          freedUnderProId: true,
          freedAt: true,
          freedomCertCode: true,
        },
      },
      master: {
        select: {
          id: true,
          name: true,
          phone: true,
          photo: true,
          status: true,
          totalJobs: true,
          avgRating: true,
        },
      },
      modules: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!apprenticeship) notFound();

  const [earningsAgg, recentEarnings, recentBookings] = await Promise.all([
    db.earning.aggregate({
      where: { apprenticeshipId: id, type: "APPRENTICE_COMMISSION" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.earning.findMany({
      where: { apprenticeshipId: id, type: "APPRENTICE_COMMISSION" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { sourcePro: { select: { name: true } } },
    }),
    db.booking.findMany({
      where: { proId: apprenticeship.apprenticeId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        service: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
  ]);

  const a = apprenticeship;
  const masterEarnings = earningsAgg._sum.amount ?? 0;

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/apprenticeships" className="hover:text-gray-700">
          Apprenticeships
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{a.apprentice.name}</span>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {a.apprentice.name}{" "}
              <span className="text-gray-400 font-normal text-lg">
                under {a.master.name}
              </span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[a.status]}`}
              >
                {STATUS_LABEL[a.status]}
              </span>
              <span className="text-xs text-gray-400">
                Invited {format(new Date(a.invitedAt), "dd MMM yyyy")}
              </span>
              {a.acceptedAt && (
                <span className="text-xs text-gray-400">
                  · Accepted {format(new Date(a.acceptedAt), "dd MMM yyyy")}
                </span>
              )}
              {a.freedomDate && (
                <span className="text-xs text-purple-600 font-semibold">
                  · Freed {format(new Date(a.freedomDate), "dd MMM yyyy")}
                </span>
              )}
              {a.terminatedAt && (
                <span className="text-xs text-red-600 font-semibold">
                  · Terminated {format(new Date(a.terminatedAt), "dd MMM yyyy")}
                </span>
              )}
            </div>
            {a.terminationReason && (
              <p className="mt-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg max-w-prose">
                <span className="font-semibold">Termination reason:</span>{" "}
                {a.terminationReason}
              </p>
            )}
            {a.freedomCertCode && (
              <p className="mt-2 text-xs text-purple-700 bg-purple-50 px-3 py-2 rounded-lg inline-block font-mono">
                Cert: {a.freedomCertCode}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Master card */}
        <Link
          href={`/admin/pros/${a.master.id}`}
          className="rounded-2xl border border-gray-200 bg-white p-5 hover:border-brand-300 transition-colors block"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Master
          </p>
          <h3 className="text-lg font-bold text-gray-900">{a.master.name}</h3>
          <p className="text-sm text-gray-500 font-mono">{a.master.phone}</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
            <span>★ {a.master.avgRating.toFixed(1)}</span>
            <span>·</span>
            <span>{a.master.totalJobs} jobs</span>
            <span>·</span>
            <span className="text-xs uppercase tracking-wider text-gray-400">
              {a.master.status}
            </span>
          </div>
        </Link>

        {/* Apprentice card */}
        <Link
          href={`/admin/pros/${a.apprentice.id}`}
          className="rounded-2xl border border-gray-200 bg-white p-5 hover:border-brand-300 transition-colors block"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Apprentice
          </p>
          <h3 className="text-lg font-bold text-gray-900">{a.apprentice.name}</h3>
          <p className="text-sm text-gray-500 font-mono">{a.apprentice.phone}</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
            <span>★ {a.apprentice.avgRating.toFixed(1)}</span>
            <span>·</span>
            <span>{a.apprentice.totalJobs} jobs</span>
            <span>·</span>
            <span className="text-xs uppercase tracking-wider text-gray-400">
              {a.apprentice.relationship}
            </span>
          </div>
        </Link>
      </div>

      {/* Override / actions */}
      <ApprenticeshipActions
        apprenticeshipId={a.id}
        status={a.status}
        canManage={canManage}
        initialCommission={a.masterCommission}
        initialApprovedIndependence={a.masterApprovedIndependence !== null}
      />

      {/* Curriculum */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">Curriculum modules</h2>
          <span className="text-xs text-gray-400">
            {a.modules.filter((m) => m.completedAt && m.masterSignoffAt).length}{" "}
            of {a.modules.length} signed off
          </span>
        </div>
        {a.modules.length === 0 ? (
          <p className="text-sm text-gray-400">No modules attached.</p>
        ) : (
          <ul className="space-y-2">
            {a.modules.map((m) => {
              const done = m.completedAt && m.masterSignoffAt;
              return (
                <li
                  key={m.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-800">
                        {m.title}
                      </p>
                      {m.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {m.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.required && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                            Required
                          </span>
                        )}
                        {m.gatesIndependence && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                            Gates independence
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          done
                            ? "bg-green-50 text-green-700"
                            : m.completedAt
                              ? "bg-amber-50 text-amber-700"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {done
                          ? "Signed off"
                          : m.completedAt
                            ? "Awaiting sign-off"
                            : "Not done"}
                      </span>
                      {m.completedAt && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          Done {format(new Date(m.completedAt), "dd MMM")}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Master earnings from this apprenticeship */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Master commission earned</h2>
            <span className="text-sm font-bold text-gray-900">
              {formatNaira(masterEarnings)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {earningsAgg._count.id} commission earning row
            {earningsAgg._count.id === 1 ? "" : "s"} on this apprenticeship.
          </p>
          {recentEarnings.length === 0 ? (
            <p className="text-sm text-gray-400">No commission earnings yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentEarnings.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      from {e.sourcePro?.name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(e.createdAt), "dd MMM, HH:mm")}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900 shrink-0">
                    {formatNaira(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent bookings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="font-bold text-gray-900 mb-3">
            Recent apprentice bookings
          </h2>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-gray-400">No bookings yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentBookings.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/admin/bookings/${b.id}`}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {b.service.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {b.customer.name ?? "Customer"} ·{" "}
                        {format(new Date(b.createdAt), "dd MMM")}
                      </p>
                    </div>
                    <span className="text-xs font-bold uppercase text-gray-500 shrink-0">
                      {b.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
