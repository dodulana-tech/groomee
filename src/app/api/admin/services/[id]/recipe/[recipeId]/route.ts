import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

const updateSchema = z.object({
  qtyPerService: z.number().positive().optional(),
  isOptional: z.boolean().optional(),
  note: z.string().max(200).nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; recipeId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "products.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id, recipeId } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await db.serviceRecipe.findUnique({ where: { id: recipeId } });
    if (!existing || existing.serviceId !== id) {
      return NextResponse.json({ error: "Recipe row not found" }, { status: 404 });
    }

    const updated = await db.serviceRecipe.update({
      where: { id: recipeId },
      data,
    });

    await logAdminAction({
      adminId: session!.userId,
      action: "recipe.update",
      entityType: "service-recipe",
      entityId: recipeId,
      metadata: data as Record<string, unknown>,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("update recipe error:", err);
    return NextResponse.json(
      { error: "Failed to update recipe" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; recipeId: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "products.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id, recipeId } = await params;
  const existing = await db.serviceRecipe.findUnique({ where: { id: recipeId } });
  if (!existing || existing.serviceId !== id) {
    return NextResponse.json({ error: "Recipe row not found" }, { status: 404 });
  }
  await db.serviceRecipe.delete({ where: { id: recipeId } });

  await logAdminAction({
    adminId: session!.userId,
    action: "recipe.delete",
    entityType: "service-recipe",
    entityId: recipeId,
    metadata: { serviceId: id },
  });

  return NextResponse.json({ success: true });
}

// PATCH alias matches the Concept #2 spec.
export { PUT as PATCH };
