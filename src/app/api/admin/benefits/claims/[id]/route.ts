import { NextRequest, NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateClaim } from "@/lib/benefits";

const VALID_STATUSES = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"]);

// GET /api/admin/benefits/claims/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.view")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const claim = await db.benefitClaim.findUnique({
    where: { id },
    include: {
      pro: { select: { id: true, name: true, phone: true } },
      enrollment: {
        include: { plan: { select: { id: true, name: true, provider: true } } },
      },
    },
  });
  if (!claim) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: claim });
}

// PUT /api/admin/benefits/claims/[id]
// Body: { status?, notes?, externalRef? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasPermission(session, "benefits.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  if (body.status && !VALID_STATUSES.has(body.status)) {
    return NextResponse.json(
      { success: false, error: "Invalid status" },
      { status: 400 },
    );
  }
  const updated = await updateClaim(
    id,
    {
      status: body.status,
      notes: body.notes ?? undefined,
      externalRef: body.externalRef ?? undefined,
    },
    session!.userId,
  );
  return NextResponse.json({ success: true, data: updated });
}
