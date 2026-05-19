import { db } from "@/lib/db";
import CalendarBoard from "./CalendarBoard";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ proId?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const pros = await db.pro.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, zones: { include: { zone: { select: { city: true } } }, take: 1 } },
    orderBy: { name: "asc" },
  });

  const cityOf = (p: (typeof pros)[number]) => p.zones[0]?.zone.city ?? "—";
  const proList = pros.map((p) => ({ id: p.id, name: p.name, city: cityOf(p) }));
  const initialProId = sp.proId ?? proList[0]?.id ?? null;
  const initialDate = sp.date ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          Calendar
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          See a pro's day — bookings, travel between zones, and open windows.
          Overlaps are auto-rejected at assign time.
        </p>
      </header>

      <CalendarBoard
        pros={proList}
        initialProId={initialProId}
        initialDate={initialDate}
      />
    </div>
  );
}
