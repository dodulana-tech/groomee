import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";

const VALID_REASONS = [
  "INITIAL_STOCK",
  "RESTOCK",
  "BOOKING_DECREMENT",
  "ADMIN_ADJUSTMENT",
  "WASTE",
  "CORRECTION",
] as const;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "inventory.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const reason = searchParams.get("reason");
  const proId = searchParams.get("proId");
  const productId = searchParams.get("productId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format"); // "csv" for export
  const take = Math.max(
    1,
    Math.min(format === "csv" ? 5000 : 200, Number(searchParams.get("take") ?? 100)),
  );
  const skip = Math.max(0, Number(searchParams.get("skip") ?? 0));

  const where: any = {};
  if (reason && (VALID_REASONS as readonly string[]).includes(reason)) where.reason = reason;
  if (proId) where.proId = proId;
  if (productId) where.productId = productId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [rows, total] = await Promise.all([
    db.inventoryTxn.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip: format === "csv" ? 0 : skip,
      include: {
        product: { select: { id: true, name: true, unit: true } },
        pro: { select: { id: true, name: true, phone: true } },
      },
    }),
    db.inventoryTxn.count({ where }),
  ]);

  if (format === "csv") {
    const header = [
      "createdAt",
      "proName",
      "proPhone",
      "product",
      "unit",
      "delta",
      "qtyAfter",
      "reason",
      "bookingId",
      "note",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.createdAt.toISOString(),
          r.pro?.name ?? "",
          r.pro?.phone ?? "",
          r.product?.name ?? "",
          r.product?.unit ?? "",
          r.delta,
          r.qtyAfter,
          r.reason,
          r.bookingId ?? "",
          r.note ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventory-txns-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ data: rows, total });
}
