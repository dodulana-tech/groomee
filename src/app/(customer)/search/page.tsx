import { redirect } from "next/navigation";
import { isWhatsAppMode, bookHref } from "@/lib/booking-mode";
import SearchClient from "./SearchClient";

export const dynamic = "force-dynamic";

// In WhatsApp mode there is no pro list to search: send people to the
// request form, keeping the service they had picked.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (await isWhatsAppMode()) {
    const sp = await searchParams;
    redirect(bookHref({ service: sp.service, area: sp.zone, asap: sp.asap === "true" }));
  }
  return <SearchClient />;
}
