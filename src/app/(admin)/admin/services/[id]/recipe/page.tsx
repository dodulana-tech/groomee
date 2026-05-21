import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatNaira } from "@/lib/utils";
import RecipeEditor from "./RecipeEditor";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Service recipe" };
export const revalidate = 0;

export default async function ServiceRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [service, products] = await Promise.all([
    db.service.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        basePrice: true,
        durationMins: true,
        description: true,
      },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        unit: true,
        category: true,
        unitCost: true,
      },
    }),
  ]);
  if (!service) notFound();

  const recipes = await db.serviceRecipe.findMany({
    where: { serviceId: id },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        select: { id: true, name: true, slug: true, unit: true, unitCost: true },
      },
    },
  });

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/admin/catalog" className="hover:text-gray-700">
          Services
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">
          {service.name}  Recipe
        </span>
      </div>

      <div className="glass-card rounded-2xl p-6 mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {service.description ?? "Recipe defines per-booking product consumption."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span
            className="font-bold px-2.5 py-1 rounded-full"
            style={{ background: "#F0FDF4", color: "#166534" }}
          >
            {service.category}
          </span>
          <span
            className="font-bold px-2.5 py-1 rounded-full"
            style={{ background: "#F3F4F6", color: "#6B7280" }}
          >
            {service.durationMins}m
          </span>
          <span
            className="font-bold px-2.5 py-1 rounded-full"
            style={{ background: "#F3F4F6", color: "#6B7280" }}
          >
            {formatNaira(service.basePrice)}
          </span>
        </div>
      </div>

      <RecipeEditor
        serviceId={service.id}
        initialRecipes={recipes.map((r) => ({
          id: r.id,
          productId: r.productId,
          productName: r.product.name,
          productUnit: r.product.unit,
          unitCost: r.product.unitCost,
          qtyPerService: r.qtyPerService,
          isOptional: r.isOptional,
          note: r.note,
        }))}
        products={products}
      />
    </div>
  );
}
