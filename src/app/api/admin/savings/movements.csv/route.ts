import { NextRequest } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-audit";

// GET /api/admin/savings/movements.csv?proId=&from=&to=&type=
//
// CSV export of SavingsMovement rows for finance / forensic. Optional filters
// scope by pro, date range, or movement type. Caps at 50,000 rows to protect
// the server.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "savings.view")) {
    return new Response("Forbidden", { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const proId = searchParams.get("proId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (proId) where.proId = proId;
  if (type) where.type = type;
  if (from || to) {
    const dateRange: { gte?: Date; lte?: Date } = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) dateRange.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) dateRange.lte = d;
    }
    if (dateRange.gte || dateRange.lte) where.createdAt = dateRange;
  }

  const rows = await db.savingsMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50000,
    include: { pro: { select: { name: true, phone: true } } },
  });

  await logAdminAction({
    adminId: session!.userId,
    action: "savings.export_movements_csv",
    entityType: "savings_movement",
    entityId: "bulk",
    metadata: { count: rows.length, proId, type, from, to },
  });

  const header = [
    "createdAt",
    "proId",
    "proName",
    "proPhone",
    "type",
    "amount",
    "balanceAfter",
    "bookingId",
    "withdrawalId",
    "goalLabel",
    "idempotencyKey",
    "note",
  ];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.createdAt.toISOString(),
        r.proId,
        r.pro?.name ?? "",
        r.pro?.phone ?? "",
        r.type,
        r.amount.toFixed(2),
        r.balanceAfter.toFixed(2),
        r.bookingId ?? "",
        r.withdrawalId ?? "",
        r.goalLabel ?? "",
        r.idempotencyKey ?? "",
        r.note ?? "",
      ]
        .map(esc)
        .join(","),
    );
  }
  const csv = lines.join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="savings-movements-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
