import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatNaira } from "@/lib/utils";
import CurriculumActions from "./CurriculumActions";
import FreedomCard from "./FreedomCard";

export const revalidate = 0;

const STATUS_LABEL: Record<string, string> = {
  PENDING_ACCEPT: "Pending accept",
  IN_TRAINING: "In training",
  READY_FOR_FREEDOM: "Ready for Freedom",
  FREED: "Freed",
  TERMINATED: "Terminated",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_ACCEPT: "bg-amber-100 text-amber-700",
  IN_TRAINING: "bg-blue-100 text-blue-700",
  READY_FOR_FREEDOM: "bg-green-100 text-green-700",
  FREED: "bg-purple-100 text-purple-700",
  TERMINATED: "bg-gray-100 text-gray-500",
};

export default async function PartnerApprenticeDetailPage({
  params,
}: {
  params: Promise<{ apprenticeId: string }>;
}) {
  const { apprenticeId: id } = await params;

  const session = await getSession();
  if (!session) redirect(`/auth?next=/partner/team/${id}`);
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    redirect(`/auth?next=/partner/team/${id}`);
  }

  const master = await db.pro.findFirst({ where: { userId: session.userId } });
  if (!master) {
    return (
      <div className="p-6 lg:p-8">
        <div className="glass rounded-2xl border border-white/20 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">No pro account</h1>
          <p className="text-sm text-gray-500">
            You need an active pro account to manage a team.
          </p>
        </div>
      </div>
    );
  }

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
        },
      },
      master: { select: { id: true, name: true } },
      modules: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!apprenticeship) notFound();
  if (apprenticeship.masterId !== master.id) {
    redirect("/partner/team");
  }

  const a = apprenticeship;

  const [earningsAgg, recentBookings] = await Promise.all([
    db.earning.aggregate({
      where: { apprenticeshipId: id, type: "APPRENTICE_COMMISSION" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    db.booking.findMany({
      where: { proId: a.apprenticeId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        service: { select: { name: true } },
        customer: { select: { name: true } },
      },
    }),
  ]);

  const masterEarnings = earningsAgg._sum.amount ?? 0;

  const gatingModules = a.modules.filter((m) => m.required && m.gatesIndependence);
  const gatingDone = gatingModules.filter(
    (m) => m.completedAt !== null && m.masterSignoffAt !== null,
  );
  const allRequired = a.modules.filter((m) => m.required);
  const allRequiredDone = allRequired.filter(
    (m) => m.completedAt !== null && m.masterSignoffAt !== null,
  );

  const SEEDED_TITLES = new Set([
    "Hygiene, sanitation & sterilisation",
    "Client communication & consultation",
    "Core technique fundamentals",
    "Punctuality, scheduling & ETA discipline",
    "Money, savings & business basics",
    "Advanced technique — speciality 1",
    "Advanced technique — speciality 2",
  ]);

  const initials = a.apprentice.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/partner/team" className="hover:text-gray-700">
          My team
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{a.apprentice.name}</span>
      </div>

      {/* Header */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex items-start gap-4">
          {a.apprentice.photo ? (
            <img
              src={a.apprentice.photo}
              alt={a.apprentice.name}
              className="h-16 w-16 rounded-full object-cover border border-white shadow-sm"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-brand-100 flex items-center justify-center text-lg font-bold text-brand-700 select-none">
              {initials || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">
              {a.apprentice.name}
            </h1>
            <p className="text-sm text-gray-500 font-mono">{a.apprentice.phone}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[a.status]}`}
              >
                {STATUS_LABEL[a.status]}
              </span>
              {a.acceptedAt && (
                <span className="text-xs text-gray-400">
                  Since {format(new Date(a.acceptedAt), "dd MMM yyyy")}
                </span>
              )}
              {a.readyForFreedomAt && (
                <span className="text-xs text-green-700 font-semibold">
                  · Ready since {format(new Date(a.readyForFreedomAt), "dd MMM yyyy")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              Jobs
            </p>
            <p className="mt-1 text-lg font-black text-gray-900">
              {a.apprentice.totalJobs}
            </p>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              Rating
            </p>
            <p className="mt-1 text-lg font-black text-gray-900">
              ★ {a.apprentice.avgRating.toFixed(1)}
            </p>
            <p className="text-[10px] text-gray-400">
              {a.apprentice.reviewCount} reviews
            </p>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              Your cut
            </p>
            <p className="mt-1 text-lg font-black text-gray-900">
              {(a.masterCommission * 100).toFixed(0)}%
            </p>
          </div>
          <div className="rounded-xl bg-white/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              You've earned
            </p>
            <p className="mt-1 text-lg font-black text-brand-700">
              {formatNaira(masterEarnings)}
            </p>
            <p className="text-[10px] text-gray-400">
              {earningsAgg._count.id} commission
              {earningsAgg._count.id === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      {/* Freedom card — only when the apprenticeship has cleared the gate */}
      {a.status === "READY_FOR_FREEDOM" && (
        <FreedomCard
          apprenticeshipId={a.id}
          apprenticeName={a.apprentice.name}
          masterName={a.master.name}
        />
      )}

      {/* Curriculum & actions (client) */}
      <CurriculumActions
        apprenticeshipId={a.id}
        status={a.status}
        masterApprovedIndependence={a.masterApprovedIndependence !== null}
        masterApprovedAt={
          a.masterApprovedIndependence
            ? a.masterApprovedIndependence.toISOString()
            : null
        }
        gatingTotal={gatingModules.length}
        gatingComplete={gatingDone.length}
        requiredTotal={allRequired.length}
        requiredComplete={allRequiredDone.length}
        modules={a.modules.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          required: m.required,
          gatesIndependence: m.gatesIndependence,
          sortOrder: m.sortOrder,
          completedAt: m.completedAt ? m.completedAt.toISOString() : null,
          masterSignoffAt: m.masterSignoffAt
            ? m.masterSignoffAt.toISOString()
            : null,
          notes: m.notes,
          isSeeded: SEEDED_TITLES.has(m.title),
        }))}
      />

      {/* Recent apprentice bookings */}
      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/40">
          <h2 className="font-bold text-gray-900">Recent bookings</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            The most recent jobs your apprentice has worked.
          </p>
        </div>
        {recentBookings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">
              No bookings yet. Once they start working, jobs land here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentBookings.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {b.service.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {b.customer.name ?? "Customer"} ·{" "}
                    {format(new Date(b.createdAt), "dd MMM")}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                  {b.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
