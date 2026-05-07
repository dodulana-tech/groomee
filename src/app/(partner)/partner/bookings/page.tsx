import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatNaira } from "@/lib/utils";
import type { BookingStatus } from "@prisma/client";
import {
  DelegateButton,
  RescindButton,
  StatusAdvanceButton,
  type DependentForBooking,
  type EligibleDependent,
} from "./DelegateButton";

export const revalidate = 0;

type Tab = "active" | "upcoming" | "completed";

const TAB_FILTER: Record<Tab, BookingStatus[]> = {
  active: ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_SERVICE"],
  upcoming: ["DISPATCHING"],
  completed: ["COMPLETED", "CONFIRMED"],
};

const STATUS_ACTIONS: Record<
  string,
  { label: string; next: string; color: string }
> = {
  ACCEPTED: {
    label: "🚗 On My Way",
    next: "EN_ROUTE",
    color: "bg-blue-600 text-white",
  },
  EN_ROUTE: {
    label: "📍 I've Arrived",
    next: "ARRIVED",
    color: "bg-brand-600 text-white",
  },
  ARRIVED: {
    label: "✨ Start Service",
    next: "IN_SERVICE",
    color: "bg-brand-600 text-white",
  },
  IN_SERVICE: {
    label: "✅ Service Complete",
    next: "COMPLETED",
    color: "bg-green-600 text-white",
  },
};

export default async function PartnerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/auth?next=/partner/bookings");
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    redirect("/auth?next=/partner/bookings");
  }

  const me = await db.pro.findFirst({
    where: { userId: session.userId },
    include: { parent: { select: { id: true, name: true } } },
  });
  if (!me) {
    return (
      <div className="p-6 lg:p-8">
        <div className="glass rounded-2xl border border-white/20 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            No pro account
          </h1>
          <p className="text-sm text-gray-500">
            You need an active pro account to manage bookings.
          </p>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const tab: Tab =
    sp?.tab === "upcoming" || sp?.tab === "completed" ? sp.tab : "active";

  // All ACTIVE dependents of this pro — they're both the deploy-target list
  // and the "watched" list (any booking currently held by one of these is
  // a deployment we made and can rescind while still ACCEPTED).
  const dependents = await db.pro.findMany({
    where: {
      parentProId: me.id,
      status: "ACTIVE",
      relationship: { in: ["APPRENTICE", "STAFF"] },
    },
    select: {
      id: true,
      name: true,
      photo: true,
      relationship: true,
      availability: true,
      totalJobs: true,
      avgRating: true,
      services: { select: { serviceId: true } },
      zones: { select: { zoneId: true } },
    },
    orderBy: { name: "asc" },
  });
  const dependentIds = dependents.map((d) => d.id);

  // Query bookings: include bookings the master holds AND bookings currently
  // held by one of their ACTIVE dependents. The dependent-held set is what
  // lets the master see + rescind active deployments.
  const watchedProIds = [me.id, ...dependentIds];
  const bookings = await db.booking.findMany({
    where: {
      proId: { in: watchedProIds },
      status: { in: TAB_FILTER[tab] },
    },
    include: {
      service: { select: { id: true, name: true } },
      zone: { select: { id: true, name: true } },
      customer: { select: { name: true } },
      pro: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const dependentsForList: DependentForBooking[] = dependents.map((d) => ({
    id: d.id,
    name: d.name,
    photo: d.photo,
    relationship: d.relationship as "APPRENTICE" | "STAFF",
    availability: d.availability as "ONLINE" | "BUSY" | "OFFLINE",
    totalJobs: d.totalJobs,
    avgRating: d.avgRating,
    serviceIds: d.services.map((s) => s.serviceId),
    zoneIds: d.zones.map((z) => z.zoneId),
  }));

  function eligibilityFor(b: {
    serviceId: string;
    zoneId: string | null;
    serviceName: string;
    zoneName: string | null;
  }): EligibleDependent[] {
    return dependentsForList.map((d) => {
      let blockedReason: string | null = null;
      if (d.availability === "BUSY") {
        blockedReason = "Currently on another booking";
      } else if (!d.serviceIds.includes(b.serviceId)) {
        blockedReason = `Doesn't offer ${b.serviceName}`;
      } else if (b.zoneId && !d.zoneIds.includes(b.zoneId)) {
        blockedReason = `Doesn't cover ${b.zoneName ?? "this zone"}`;
      }
      return {
        id: d.id,
        name: d.name,
        photo: d.photo,
        relationship: d.relationship,
        availability: d.availability,
        totalJobs: d.totalJobs,
        avgRating: d.avgRating,
        blockedReason,
      };
    });
  }

  const myMaster = me.parent
    ? { id: me.parent.id, name: me.parent.name }
    : null;

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "active", label: "Active", icon: "🔴" },
    { key: "upcoming", label: "Upcoming", icon: "📅" },
    { key: "completed", label: "Completed", icon: "✅" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-sm text-gray-500">
          Manage your service appointments.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/partner/bookings?tab=${t.key}`}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              tab === t.key
                ? "bg-brand-600 text-white shadow-sm"
                : "glass-card text-gray-600 hover:border-brand-200"
            }`}
          >
            {t.icon} {t.label}
          </Link>
        ))}
      </div>

      {/* Bookings list */}
      {bookings.length === 0 ? (
        <div className="glass rounded-2xl border border-white/20 p-8 text-center shadow-lg">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-semibold text-gray-900">No {tab} bookings</p>
          <p className="text-sm text-gray-500 mt-1">
            {tab === "active"
              ? "You don't have any active bookings right now."
              : tab === "upcoming"
                ? "No upcoming appointments scheduled."
                : "Your completed bookings will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const isMine = b.proId === me.id;
            const heldByDependent = !isMine && b.proId !== null;
            const isAccepted = b.status === "ACCEPTED";
            const canDelegate =
              isMine && isAccepted && dependentsForList.length > 0;
            const eligibility = canDelegate
              ? eligibilityFor({
                  serviceId: b.serviceId,
                  zoneId: b.zoneId,
                  serviceName: b.service.name,
                  zoneName: b.zone?.name ?? null,
                })
              : [];
            const canRescind = heldByDependent && isAccepted;
            return (
              <div
                key={b.id}
                className="glass rounded-2xl border border-white/20 p-5 shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 uppercase">
                        {b.status?.replace("_", " ")}
                      </span>
                      {b.isAsap && (
                        <span className="rounded-full bg-accent-50 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent">
                          ⚡ ASAP
                        </span>
                      )}
                      {myMaster && isMine && (
                        <span className="rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                          🎓 Deployed by {myMaster.name}
                        </span>
                      )}
                      {heldByDependent && b.pro && (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          🤝 Deployed to {b.pro.name}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900">
                      {b.service.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {b.customer.name?.split(" ")[0] ?? "Customer"} ·{" "}
                      {b.zone?.name ?? "Lagos"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(b.createdAt).toLocaleDateString("en-NG", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-brand-700">
                      {formatNaira(b.proEarning)}
                    </p>
                    {isMine && STATUS_ACTIONS[b.status] && (
                      <StatusAdvanceButton
                        bookingId={b.id}
                        nextStatus={STATUS_ACTIONS[b.status].next}
                        label={STATUS_ACTIONS[b.status].label}
                        color={STATUS_ACTIONS[b.status].color}
                      />
                    )}
                  </div>
                </div>

                {(canDelegate || canRescind) && (
                  <div className="flex flex-wrap gap-2 mt-3 border-t border-gray-100 pt-3">
                    {canDelegate && (
                      <DelegateButton
                        bookingId={b.id}
                        dependents={eligibility}
                      />
                    )}
                    {canRescind && b.pro && (
                      <RescindButton
                        bookingId={b.id}
                        dependentName={b.pro.name}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
