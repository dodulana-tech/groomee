import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { CITY_PERMISSIONS } from "@/lib/cities";
import CitiesBoard from "./CitiesBoard";

export const revalidate = 0;

export default async function AdminCitiesPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, CITY_PERMISSIONS.view)) {
    redirect("/admin");
  }
  const canManage = hasPermission(session, CITY_PERMISSIONS.manage);

  const cities = await db.city.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { zones: true } },
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cities & rollout</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            Activate cities to start accepting bookings. Bookings into
            non-LIVE cities are refused at the API. Flipping a city to LIVE
            also notifies its waitlist.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          View landing →
        </Link>
      </div>

      <CitiesBoard
        canManage={canManage}
        cities={cities.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          status: c.status,
          launchedAt: c.launchedAt?.toISOString() ?? null,
          tagline: c.tagline ?? "",
          sortOrder: c.sortOrder,
          zoneCount: c._count.zones,
        }))}
      />
    </div>
  );
}
