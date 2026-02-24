import { redirect } from "next/navigation";

export default async function BookingDemo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams(params).toString();
  redirect(`/booking/GRM-DEMO?${qs}`);
}
