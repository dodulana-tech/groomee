import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { IMPORT_TEMPLATE_CSV } from "@/lib/pro-import";

// GET /api/admin/pros/import/template — CSV template for the import screen.
export async function GET() {
  const session = await getSession();
  if (!hasPermission(session, "pros.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return new NextResponse(IMPORT_TEMPLATE_CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="groomee-pro-import-template.csv"',
    },
  });
}
