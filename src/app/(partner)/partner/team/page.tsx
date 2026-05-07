import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

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

export default async function PartnerTeamPage() {
  const session = await getSession();
  if (!session) redirect("/auth?next=/partner/team");
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    redirect("/auth?next=/partner/team");
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

  const [dependents, apprenticeships, pendingCount] = await Promise.all([
    db.pro.findMany({
      where: { parentProId: master.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        photo: true,
        status: true,
        relationship: true,
        avgRating: true,
        reviewCount: true,
        totalJobs: true,
      },
    }),
    db.apprenticeship.findMany({
      where: { masterId: master.id, status: { in: ["IN_TRAINING", "READY_FOR_FREEDOM"] } },
      select: {
        id: true,
        apprenticeId: true,
        status: true,
        masterCommission: true,
        acceptedAt: true,
      },
    }),
    db.apprenticeship.count({
      where: { masterId: master.id, status: "PENDING_ACCEPT" },
    }),
  ]);

  const apprenticeshipMap = new Map(apprenticeships.map((a) => [a.apprenticeId, a]));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My team</h1>
          <p className="text-sm text-gray-500">
            Apprentices and staff working under you. Master takes a commission on every dependent&apos;s job.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendingCount > 0 && (
            <Link
              href="/partner/team/invitations"
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-100"
            >
              Pending invitations ({pendingCount})
            </Link>
          )}
          <Link
            href="/partner/team/invite"
            className="btn-primary btn-md"
          >
            Invite an apprentice
          </Link>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-4">Why grow a team?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: "💰",
              title: "Earn while they earn",
              desc: "You take a configurable cut on every booking your apprentice fulfills.",
            },
            {
              icon: "🎓",
              title: "Pass the trade on",
              desc: "Train apprentices the right way and graduate them with a proper Freedom certificate.",
            },
            {
              icon: "📈",
              title: "Multiply your reach",
              desc: "Each apprentice expands your service area. Your name, their hands.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-xl bg-white/60 p-3">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/20 shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-white/40">
          <h2 className="font-bold text-gray-900">Your dependents ({dependents.length})</h2>
        </div>
        {dependents.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-500 mb-4">
              You haven&apos;t taken on any apprentices or staff yet.
            </p>
            <Link href="/partner/team/invite" className="btn-primary btn-sm">
              Invite your first apprentice
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dependents.map((d) => {
              const a = apprenticeshipMap.get(d.id);
              const statusLabel = a
                ? STATUS_LABEL[a.status]
                : d.relationship === "STAFF"
                  ? "Staff"
                  : d.status;
              const statusStyle = a
                ? STATUS_STYLE[a.status]
                : "bg-gray-100 text-gray-600";
              const initials = d.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <div key={d.id} className="flex items-center gap-4 px-6 py-4">
                  {d.photo ? (
                    <img
                      src={d.photo}
                      alt={d.name}
                      className="h-10 w-10 rounded-full object-cover border border-white shadow-sm"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-700 select-none">
                      {initials || "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{d.name}</p>
                    <p className="text-xs text-gray-400">{d.phone}</p>
                  </div>
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-sm font-bold text-gray-900">{d.totalJobs}</span>
                    <span className="text-[10px] uppercase text-gray-400">jobs</span>
                  </div>
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-sm font-bold text-gray-900">
                      ★ {d.avgRating.toFixed(1)}
                    </span>
                    <span className="text-[10px] uppercase text-gray-400">
                      {d.reviewCount} reviews
                    </span>
                  </div>
                  {a && (
                    <div className="hidden md:flex flex-col text-right">
                      <span className="text-sm font-bold text-gray-900">
                        {(a.masterCommission * 100).toFixed(0)}%
                      </span>
                      <span className="text-[10px] uppercase text-gray-400">your cut</span>
                    </div>
                  )}
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusStyle}`}
                  >
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
