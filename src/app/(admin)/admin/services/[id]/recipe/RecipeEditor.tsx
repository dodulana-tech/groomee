"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/utils";

interface Recipe {
  id: string;
  productId: string;
  productName: string;
  productUnit: string;
  unitCost: number;
  qtyPerService: number;
  isOptional: boolean;
  note: string | null;
}

interface ProductOpt {
  id: string;
  name: string;
  slug: string;
  unit: string;
  category: string;
  unitCost: number;
}

export default function RecipeEditor({
  serviceId,
  initialRecipes,
  products,
}: {
  serviceId: string;
  initialRecipes: Recipe[];
  products: ProductOpt[];
}) {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [isOptional, setIsOptional] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch(`/api/admin/services/${serviceId}/recipe`);
    const data = await res.json();
    if (res.ok) {
      const next: Recipe[] = (data.data.recipes ?? []).map((r: any) => ({
        id: r.id,
        productId: r.productId,
        productName: r.product.name,
        productUnit: r.product.unit,
        unitCost: r.product.unitCost,
        qtyPerService: r.qtyPerService,
        isOptional: r.isOptional,
        note: r.note,
      }));
      setRecipes(next);
    }
    router.refresh();
  }

  async function addRecipe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/services/${serviceId}/recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          qtyPerService: Number(qty),
          isOptional,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setQty("1");
      setNote("");
      setIsOptional(false);
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateRecipe(r: Recipe, patch: Partial<Recipe>) {
    const body: any = {};
    if (patch.qtyPerService !== undefined)
      body.qtyPerService = patch.qtyPerService;
    if (patch.isOptional !== undefined) body.isOptional = patch.isOptional;
    if (patch.note !== undefined) body.note = patch.note;
    const res = await fetch(
      `/api/admin/services/${serviceId}/recipe/${r.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (res.ok) await refresh();
  }

  async function deleteRecipe(r: Recipe) {
    if (!confirm(`Remove ${r.productName} from this recipe?`)) return;
    const res = await fetch(
      `/api/admin/services/${serviceId}/recipe/${r.id}`,
      { method: "DELETE" },
    );
    if (res.ok) await refresh();
  }

  const usedProductIds = new Set(recipes.map((r) => r.productId));
  const availableProducts = products.filter((p) => !usedProductIds.has(p.id));

  const totalUnitCost = recipes.reduce(
    (acc, r) => acc + (r.isOptional ? 0 : r.qtyPerService * r.unitCost),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">Recipe rows</h2>
          <span className="text-xs text-gray-500">
            Est. supply cost per booking:{" "}
            <span className="font-bold">{formatNaira(totalUnitCost)}</span>
          </span>
        </div>
        {recipes.length === 0 ? (
          <p className="text-sm text-gray-400">
            No products linked to this service yet. Add one below.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="py-2">Product</th>
                <th className="py-2">Qty / booking</th>
                <th className="py-2">Optional</th>
                <th className="py-2">Note</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recipes.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 font-medium text-gray-800">
                    {r.productName}
                    <span className="text-xs text-gray-400 ml-1">
                      / {r.productUnit}
                    </span>
                  </td>
                  <td className="py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      defaultValue={r.qtyPerService}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && v !== r.qtyPerService) {
                          updateRecipe(r, { qtyPerService: v });
                        }
                      }}
                      className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-sm"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={r.isOptional}
                      onChange={(e) =>
                        updateRecipe(r, { isOptional: e.target.checked })
                      }
                    />
                  </td>
                  <td className="py-2 text-gray-500 text-xs">
                    <input
                      defaultValue={r.note ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (r.note ?? "")) {
                          updateRecipe(r, { note: v || null });
                        }
                      }}
                      placeholder="—"
                      className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => deleteRecipe(r)}
                      className="text-xs font-semibold text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h2 className="font-bold text-gray-900 mb-3">Add product to recipe</h2>
        {availableProducts.length === 0 ? (
          <p className="text-sm text-gray-400">
            Every active product is already on this recipe.
          </p>
        ) : (
          <form
            onSubmit={addRecipe}
            className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
          >
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                Product
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              >
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                Qty
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                Note
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                placeholder="optional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={isOptional}
                  onChange={(e) => setIsOptional(e.target.checked)}
                />
                Optional
              </label>
              <button
                type="submit"
                disabled={busy || !productId}
                className="py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: busy ? "#9CA3AF" : "#1A3A2A" }}
              >
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        )}
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}
