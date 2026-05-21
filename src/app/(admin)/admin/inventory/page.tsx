"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Overview {
  kpis: {
    totalProducts: number;
    activeProducts: number;
    prosWithInventory: number;
    lowStockCount: number;
    decrement7d: number;
  };
  pros: {
    proId: string;
    proName: string;
    proPhone: string;
    productsTracked: number;
    lowCount: number;
  }[];
  topConsumed: {
    productId: string;
    product: { id: string; name: string; unit: string; category: string } | null;
    qty: number;
  }[];
}

export default function AdminInventoryPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/inventory/overview")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex h-32 items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200"
            style={{ borderTopColor: "#1A3A2A" }}
          />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 lg:p-8 text-sm text-gray-500">No data.</div>;
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Per-pro stock levels and consumption.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/inventory/txns"
            className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            View txn log
          </Link>
          <Link
            href="/admin/inventory/settings"
            className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Settings
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Products", value: data.kpis.totalProducts },
          { label: "Active products", value: data.kpis.activeProducts },
          { label: "Pros tracking", value: data.kpis.prosWithInventory },
          {
            label: "Low stock items",
            value: data.kpis.lowStockCount,
            warn: data.kpis.lowStockCount > 0,
          },
          { label: "Decrements (7d)", value: data.kpis.decrement7d },
        ].map((k) => (
          <div key={k.label} className="glass-card rounded-2xl p-4">
            <p
              className="text-2xl font-bold"
              style={{ color: k.warn ? "#991B1B" : "#1A3A2A" }}
            >
              {k.value}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-bold text-gray-900 mb-3">
            Pros · sorted by low-stock count
          </h2>
          {data.pros.length === 0 ? (
            <p className="text-sm text-gray-400">
              No pro has any tracked inventory yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2">Pro</th>
                  <th className="py-2">Products tracked</th>
                  <th className="py-2">Low stock</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.pros.map((p) => (
                  <tr key={p.proId}>
                    <td className="py-2 font-medium text-gray-800">
                      {p.proName}
                      <p className="text-xs text-gray-400 font-mono">{p.proPhone}</p>
                    </td>
                    <td className="py-2 text-gray-600">{p.productsTracked}</td>
                    <td className="py-2">
                      {p.lowCount > 0 ? (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "#FEF2F2", color: "#991B1B" }}
                        >
                          {p.lowCount} low
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">All OK</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/admin/inventory/${p.proId}`}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-bold text-gray-900 mb-3">Top consumed · 30d</h2>
          {data.topConsumed.length === 0 ? (
            <p className="text-sm text-gray-400">No consumption yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {data.topConsumed.map((c, i) => (
                <li
                  key={c.productId}
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"
                >
                  <span className="text-gray-800">
                    <span className="text-gray-400 mr-1">{i + 1}.</span>
                    {c.product?.name ?? "—"}
                  </span>
                  <span className="text-xs font-bold text-gray-700">
                    {c.qty.toFixed(0)} {c.product?.unit ?? ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
