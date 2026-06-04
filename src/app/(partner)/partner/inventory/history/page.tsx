import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import HistoryClient from "./HistoryClient";

export const metadata: Metadata = { title: "Stock history · Groomee Partner" };
export const revalidate = 0;

export default async function PartnerInventoryHistoryPage() {
  const session = await getSession();
  if (!session) redirect("/auth");
  if (session.role !== "PRO" && session.role !== "ADMIN") redirect("/");

  const pro = await db.pro.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!pro) redirect("/partner");

  // First page server-side so the user lands on data, not a spinner.
  const initial = await db.inventoryTxn.findMany({
    where: { proId: pro.id },
    orderBy: { createdAt: "desc" },
    take: 51,
    include: {
      product: { select: { id: true, name: true, unit: true } },
    },
  });
  const hasMore = initial.length > 50;
  const page = hasMore ? initial.slice(0, 50) : initial;

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-4xl mx-auto">
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Link href="/partner/inventory" className="hover:text-gray-700">
          Stock
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">History</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transaction history</h1>
        <p className="text-sm text-gray-500">
          Every restock, consumption, waste, and admin correction.
        </p>
      </div>

      <HistoryClient
        initialItems={page.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          productId: r.productId,
          productName: r.product?.name ?? "—",
          unit: r.product?.unit ?? "",
          delta: r.delta,
          qtyAfter: r.qtyAfter,
          reason: r.reason,
          bookingId: r.bookingId,
          note: r.note,
        }))}
        initialNextCursor={hasMore ? page[page.length - 1].id : null}
      />
    </div>
  );
}
