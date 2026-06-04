import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/utils";
import { getProductUsageStats } from "@/lib/inventory";
import type { Metadata } from "next";
import ProductEditForm from "./ProductEditForm";

export const metadata: Metadata = { title: "Product detail" };
export const revalidate = 0;

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: {
      recipes: {
        include: {
          service: {
            select: { id: true, name: true, slug: true, category: true },
          },
        },
      },
      _count: { select: { inventories: true } },
    },
  });
  if (!product) notFound();

  const stats = await getProductUsageStats(id, 30);

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/products" className="hover:text-gray-700">
          Products
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{product.name}</span>
      </div>

      <div className="glass-card rounded-2xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5 font-mono">
              {product.slug}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#F0FDF4", color: "#166534" }}
              >
                {product.category}
              </span>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "#F3F4F6", color: "#6B7280" }}
              >
                per {product.unit}
              </span>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: product.isActive ? "#DCFCE7" : "#F3F4F6",
                  color: product.isActive ? "#166534" : "#6B7280",
                }}
              >
                {product.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-gray-100 pt-5">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">
              {formatNaira(product.unitCost)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Unit cost</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">
              {product.recipes.length}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Services using</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">
              {product._count.inventories}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Pros tracking</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">
              {stats.totalConsumed.toFixed(0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Used (30d)</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-bold text-gray-900 mb-3">Edit product</h2>
          <ProductEditForm
            id={product.id}
            initial={{
              name: product.name,
              slug: product.slug,
              sku: product.sku ?? "",
              unit: product.unit,
              unitCost: product.unitCost,
              description: product.description ?? "",
              isActive: product.isActive,
            }}
          />
        </div>

        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-bold text-gray-900 mb-3">Services using this product</h2>
          <div className="space-y-2">
            {product.recipes.length === 0 && (
              <p className="text-sm text-gray-400">
                No services include this product yet.
              </p>
            )}
            {product.recipes.map((r) => (
              <Link
                key={r.id}
                href={`/admin/services/${r.serviceId}/recipe`}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-sm hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-800">
                  {r.service.name}
                </span>
                <span className="text-xs text-gray-500">
                  {r.qtyPerService} {product.unit}{r.isOptional ? "  optional" : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-bold text-gray-900 mb-3">
            Top consumer pros · last 30 days
          </h2>
          {stats.topPros.length === 0 ? (
            <p className="text-sm text-gray-400">No consumption logged yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2">Pro</th>
                  <th className="py-2">Consumed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.topPros.map((p) => (
                  <tr key={p.proId}>
                    <td className="py-2">
                      <Link
                        href={`/admin/inventory/${p.proId}`}
                        className="font-medium text-gray-800 hover:underline"
                      >
                        {p.proName}
                      </Link>
                    </td>
                    <td className="py-2 text-gray-600">
                      {p.qty.toFixed(0)} {product.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="glass-card rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-bold text-gray-900 mb-3">
            Daily consumption · last 30 days
          </h2>
          {stats.daily.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {stats.daily.map((d) => {
                const max = Math.max(...stats.daily.map((x) => x.qty), 1);
                const h = Math.max(4, (d.qty / max) * 100);
                return (
                  <div
                    key={d.day}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${d.day}: ${d.qty.toFixed(1)} ${product.unit}`}
                  >
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${h}%`,
                        background: "#1A3A2A",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
