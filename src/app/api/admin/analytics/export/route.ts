import { NextRequest, NextResponse } from "next/server";
import { getSession, hasAnyPermission } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/admin/analytics/export?type=bookings|payments|surveys|waitlist&from=...&to=...
//
// Streams a CSV file of the requested dataset filtered by date range.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!hasAnyPermission(session, "analytics.export", "analytics.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "bookings";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }

  let rows: string[][];
  let header: string[];

  if (type === "bookings") {
    header = [
      "id",
      "reference",
      "createdAt",
      "status",
      "service",
      "customer",
      "customerPhone",
      "pro",
      "zone",
      "totalAmount",
      "proEarning",
      "platformFee",
    ];
    const bookings = await db.booking.findMany({
      where: Object.keys(range).length ? { createdAt: range } : undefined,
      include: {
        service: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        pro: { select: { name: true } },
        zone: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    rows = bookings.map((b) => [
      b.id,
      b.reference,
      b.createdAt.toISOString(),
      b.status,
      b.service.name,
      b.customer.name ?? "",
      b.customer.phone ?? "",
      b.pro?.name ?? "",
      b.zone?.name ?? "",
      String(b.totalAmount),
      String(b.proEarning),
      String(b.totalAmount - b.proEarning),
    ]);
  } else if (type === "payments") {
    header = ["id", "reference", "paystackRef", "status", "amount", "refundAmount", "capturedAt", "bookingId"];
    const payments = await db.payment.findMany({
      where: Object.keys(range).length ? { createdAt: range } : undefined,
      orderBy: { createdAt: "desc" },
    });
    rows = payments.map((p) => [
      p.id,
      p.reference,
      p.paystackRef ?? "",
      p.status,
      String(p.amount),
      p.refundAmount ? String(p.refundAmount) : "",
      p.capturedAt?.toISOString() ?? "",
      p.bookingId,
    ]);
  } else if (type === "surveys") {
    header = ["id", "type", "phone", "createdAt", "answers"];
    const surveys = await db.surveyResponse.findMany({
      where: Object.keys(range).length ? { createdAt: range } : undefined,
      orderBy: { createdAt: "desc" },
    });
    rows = surveys.map((s) => [
      s.id,
      s.type,
      s.phone ?? "",
      s.createdAt.toISOString(),
      JSON.stringify(s.answers),
    ]);
  } else if (type === "waitlist") {
    header = ["id", "city", "phone", "name", "role", "createdAt"];
    const wait = await db.waitlist.findMany({
      where: Object.keys(range).length ? { createdAt: range } : undefined,
      orderBy: { createdAt: "desc" },
    });
    rows = wait.map((w) => [
      w.id,
      w.city,
      w.phone ?? "",
      w.name ?? "",
      w.role ?? "",
      w.createdAt.toISOString(),
    ]);
  } else {
    return NextResponse.json({ success: false, error: "Unknown export type" }, { status: 400 });
  }

  const csvLines = [header.join(",")];
  for (const row of rows) {
    csvLines.push(row.map(csvEscape).join(","));
  }
  const csv = csvLines.join("\n");

  const filename = `groomee-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvEscape(v: string): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
