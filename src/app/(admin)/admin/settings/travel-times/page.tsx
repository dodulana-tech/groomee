import TravelTimesEditor from "./TravelTimesEditor";

export const dynamic = "force-dynamic";

export default function TravelTimesPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-gray-900">
          Travel times
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Drive times between zones drive the scheduler's transit buffer.
          Same-zone pairs are 0; missing pairs fall back to 30 min.
        </p>
      </header>
      <TravelTimesEditor />
    </div>
  );
}
