import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNaira, cn } from "@/lib/utils";
import SquadActions from "./SquadActions";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Groomer Squad" };

export default async function SquadPage() {
  const session = await getSession();
  if (!session) redirect("/auth?redirect=/profile/squad");

  const squad = await db.favouriteGroomer.findMany({
    where: { userId: session.userId },
    include: {
      groomer: {
        include: {
          services: {
            include: { service: { select: { name: true } } },
            take: 3,
          },
          zones: { include: { zone: { select: { name: true } } }, take: 2 },
        },
      },
    },
    orderBy: { priority: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <div className="mb-6">
        <button onClick={undefined} className="mb-3">
          <Link
            href="/profile"
            className="text-sm text-gray-400 hover:text-brand-600"
          >
            ← Back to profile
          </Link>
        </button>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          My Groomer Squad
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Up to 3 groomers. When you book, we try your squad first before
          searching wider.
        </p>
      </div>

      {/* Squad slots */}
      <div className="space-y-3 mb-8">
        {[0, 1, 2].map((i) => {
          const member = squad[i];
          return (
            <div
              key={i}
              className={cn(
                "card p-4",
                member ? "" : "border-dashed border-2 border-gray-200",
              )}
            >
              {member ? (
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-2xl relative">
                    💇
                    <span
                      className={cn(
                        "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white",
                        member.groomer.availability === "ONLINE"
                          ? "bg-green-400"
                          : member.groomer.availability === "BUSY"
                            ? "bg-orange-400"
                            : "bg-gray-300",
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
                        #{i + 1} priority
                      </span>
                      <p className="font-semibold text-gray-900 truncate">
                        {member.groomer.name}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {member.groomer.services
                        .map((s: any) => s.service.name)
                        .join(" · ")}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ★ {member.groomer.avgRating.toFixed(1)} ·{" "}
                      {member.groomer.zones
                        .map((z: any) => z.zone.name)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Link
                      href={`/groomer/${member.groomer.id}`}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Book →
                    </Link>
                    <SquadActions
                      groomerId={member.groomer.id}
                      action="remove"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-1 text-gray-400">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 text-xl">
                    +
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Squad slot {i + 1} — empty
                    </p>
                    <p className="text-xs text-gray-400">
                      Find a groomer and add them to your squad
                    </p>
                  </div>
                  <Link
                    href="/search"
                    className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-600"
                  >
                    Find groomers
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <div className="rounded-2xl bg-brand-50 p-5">
        <h3 className="font-semibold text-brand-900 mb-3">
          How your Squad works
        </h3>
        <ul className="space-y-2 text-sm text-brand-800">
          <li className="flex gap-2">
            <span className="text-brand-500 shrink-0">→</span> When you book, we
            offer the job to your #1 groomer first.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 shrink-0">→</span> If they can't
            make it, we try #2, then #3, then wider.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 shrink-0">→</span> Your groomers
            learn your beauty profile and preferences over time.
          </li>
          <li className="flex gap-2">
            <span className="text-brand-500 shrink-0">→</span> You can reorder
            by removing and re-adding in your preferred order.
          </li>
        </ul>
      </div>
    </div>
  );
}
