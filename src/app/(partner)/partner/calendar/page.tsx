import PartnerCalendarBoard from "./PartnerCalendarBoard";

export const dynamic = "force-dynamic";

export default function PartnerCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  // searchParams is async in Next 15 — pass it through.
  return <Wrapper searchParams={searchParams} />;
}

async function Wrapper({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const initialDate = sp.date ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          My day
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Your bookings, transit windows between locations, and free slots.
        </p>
      </header>
      <PartnerCalendarBoard initialDate={initialDate} />
    </div>
  );
}
