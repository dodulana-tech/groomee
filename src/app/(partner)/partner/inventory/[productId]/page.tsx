import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/utils";
import ProductActions from "./ProductActions";

export const metadata: Metadata = { title: "Product · Groomee Partner" };
export const revalidate = 0;

const CATEGORY_LABELS: Record<string, string> = {
  HAIR_CARE: "Hair care",
  MAKEUP: "Makeup",
  NAILS: "Nails",
  LASHES: "Lashes",
  SKINCARE: "Skincare",
  TOOLS: "Tools",
  CONSUMABLE: "Consumable",
  OTHER: "Other",
};

function relTime(d: Date | null): string {
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default async function PartnerProductDetail({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/auth");
  if (session.role !== "PRO" && session.role !== "ADMIN") redirect("/");

  const pro = await db.pro.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!pro) redirect("/partner");

  const { productId } = await params;

  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      unit: true,
      unitCost: true,
      description: true,
      photo: true,
      isActive: true,
    },
  });
  if (!product) notFound();

  const since30d = new Date(Date.now() - 30 * 86400_000);

  const [inv, decrements, restocks, wastes, recipes, monthConsumed] =
    await Promise.all([
      db.proInventory.findUnique({
        where: { proId_productId: { proId: pro.id, productId } },
      }),
      db.inventoryTxn.findMany({
        where: { proId: pro.id, productId, reason: "BOOKING_DECREMENT" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          delta: true,
          qtyAfter: true,
          bookingId: true,
          note: true,
        },
      }),
      db.inventoryTxn.findMany({
        where: {
          proId: pro.id,
          productId,
          reason: { in: ["RESTOCK", "INITIAL_STOCK"] },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          delta: true,
          qtyAfter: true,
          reason: true,
          note: true,
        },
      }),
      db.inventoryTxn.findMany({
        where: { proId: pro.id, productId, reason: "WASTE" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          delta: true,
          qtyAfter: true,
          note: true,
        },
      }),
      db.serviceRecipe.findMany({
        where: { productId },
        include: {
          service: { select: { id: true, name: true, slug: true } },
        },
      }),
      db.inventoryTxn.aggregate({
        where: {
          proId: pro.id,
          productId,
          reason: "BOOKING_DECREMENT",
          createdAt: { gte: since30d },
        },
        _sum: { delta: true },
      }),
    ]);

  const consumed30d = Math.abs(monthConsumed._sum.delta ?? 0);
  const isLow = inv ? inv.qtyOnHand < inv.lowStockThreshold : false;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Link href="/partner/inventory" className="hover:text-gray-700">
          Stock
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{product.name}</span>
      </div>

      {/* Header */}
      <div className="glass rounded-2xl border border-white/20 p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {product.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.photo}
                alt={product.name}
                className="h-16 w-16 rounded-xl object-cover bg-gray-100"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-green-100 flex items-center justify-center text-2xl">
                📦
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {product.name}
              </h1>
              <p className="text-sm text-gray-500">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {CATEGORY_LABELS[product.category] ?? product.category}
                </span>
                <span className="ml-2">
                  {formatNaira(product.unitCost)} per {product.unit}
                </span>
              </p>
            </div>
          </div>
          {inv && (
            <ProductActions
              productId={product.id}
              productName={product.name}
              unit={product.unit}
              qtyOnHand={inv.qtyOnHand}
            />
          )}
        </div>
        {product.description && (
          <p className="mt-4 text-sm text-gray-600">{product.description}</p>
        )}
      </div>

      {/* Stock card */}
      <div
        className={`rounded-2xl border-2 p-5 shadow-sm ${
          isLow
            ? "border-red-200 bg-red-50/70"
            : "border-white/20 bg-white/70 backdrop-blur"
        }`}
      >
        {inv ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                On hand
              </p>
              <p
                className={`mt-1 text-2xl font-black ${
                  isLow ? "text-red-700" : "text-gray-900"
                }`}
              >
                {inv.qtyOnHand} {product.unit}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Threshold
              </p>
              <p className="mt-1 text-2xl font-black text-gray-900">
                {inv.lowStockThreshold}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Used (30d)
              </p>
              <p className="mt-1 text-2xl font-black text-gray-900">
                {consumed30d}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">
              You aren&apos;t tracking this product yet.
            </p>
            <Link
              href="/partner/inventory"
              className="inline-block rounded-xl bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-700"
            >
              ← Go to stock to add it
            </Link>
          </div>
        )}
      </div>

      {/* Recipes */}
      {recipes.length > 0 && (
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <h2 className="font-bold text-gray-900 mb-3">
            Services that use this product
          </h2>
          <ul className="divide-y divide-gray-100">
            {recipes.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-gray-800">{r.service.name}</span>
                <span className="text-gray-500 text-xs">
                  {r.qtyPerService} {product.unit} per booking
                  {r.isOptional ? " (optional)" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent consumption */}
      <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
        <h2 className="font-bold text-gray-900 mb-3">Recent consumption</h2>
        {decrements.length === 0 ? (
          <p className="text-sm text-gray-500">
            No bookings have consumed this yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {decrements.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div>
                  <p className="text-gray-800">
                    {Math.abs(t.delta)} {product.unit} consumed
                  </p>
                  <p className="text-xs text-gray-400">{t.note ?? "—"}</p>
                </div>
                <div className="text-right">
                  {t.bookingId ? (
                    <Link
                      href={`/partner/bookings/${t.bookingId}`}
                      className="text-xs font-bold text-green-700 hover:underline"
                    >
                      View booking
                    </Link>
                  ) : null}
                  <p className="text-xs text-gray-400">
                    {relTime(new Date(t.createdAt))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Restocks + wastes */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <h2 className="font-bold text-gray-900 mb-3">Recent restocks</h2>
          {restocks.length === 0 ? (
            <p className="text-sm text-gray-500">No restocks yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {restocks.map((t) => (
                <li key={t.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-green-700">
                      +{t.delta} {product.unit}
                    </span>
                    <span className="text-xs text-gray-400">
                      {relTime(new Date(t.createdAt))}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {t.reason === "INITIAL_STOCK" ? "Initial stock" : "Restock"}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass rounded-2xl border border-white/20 p-5 shadow-lg">
          <h2 className="font-bold text-gray-900 mb-3">Recent waste</h2>
          {wastes.length === 0 ? (
            <p className="text-sm text-gray-500">No waste logged. Nice.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {wastes.map((t) => (
                <li key={t.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-red-700">
                      {t.delta} {product.unit}
                    </span>
                    <span className="text-xs text-gray-400">
                      {relTime(new Date(t.createdAt))}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{t.note ?? "—"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
