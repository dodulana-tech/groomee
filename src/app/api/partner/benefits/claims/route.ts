import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { createClaim } from "@/lib/benefits";
import { notifyProBenefitClaimOpened } from "@/lib/whatsapp";

const VALID_KINDS = new Set(["HMO", "ACCIDENT", "BUNDLE"]);

// Keywords that strongly suggest the pro is pasting medical detail. We do
// NOT want PHI in our DB - the insurer handles the clinical record direct.
const PHI_KEYWORDS = [
  "diagnosis",
  "diagnosed",
  "hiv",
  "std",
  "sti",
  "pregnant",
  "pregnancy",
  "blood pressure",
  "diabetes",
  "diabetic",
  "cancer",
  "tumour",
  "tumor",
  "tb ",
  "tuberculosis",
  "covid",
  "asthma",
  "chemo",
  "x-ray",
  "xray",
  "ct scan",
  "mri",
  "prescribed",
  "prescription",
  "dosage",
  "mg/dl",
  "mg/dL".toLowerCase(),
  "mmhg",
  "hemoglobin",
  "haemoglobin",
];

function sanitizeSummary(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function containsPhi(text: string): boolean {
  const lower = text.toLowerCase();
  return PHI_KEYWORDS.some((kw) => lower.includes(kw));
}

// GET /api/partner/benefits/claims — list this pro's claims
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const pro = await db.pro.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!pro) {
    return NextResponse.json(
      { success: false, error: "No pro account on file" },
      { status: 403 },
    );
  }

  const claims = await db.benefitClaim.findMany({
    where: { proId: pro.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      enrollment: {
        select: { id: true, plan: { select: { name: true } } },
      },
    },
  });
  return NextResponse.json({ success: true, data: claims });
}

// POST /api/partner/benefits/claims
// Body: { enrollmentId, kind, summary }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (session.role !== "PRO" && session.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  const pro = await db.pro.findFirst({
    where: { userId: session.userId },
    select: { id: true, phone: true },
  });
  if (!pro) {
    return NextResponse.json(
      { success: false, error: "No pro account on file" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const enrollmentId = typeof body.enrollmentId === "string" ? body.enrollmentId.trim() : "";
  const kind = typeof body.kind === "string" ? body.kind.trim().toUpperCase() : "";
  const rawSummary = typeof body.summary === "string" ? body.summary : "";

  if (!enrollmentId) {
    return NextResponse.json(
      { success: false, error: "enrollmentId required" },
      { status: 400 },
    );
  }
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json(
      { success: false, error: "kind must be HMO, ACCIDENT, or BUNDLE" },
      { status: 400 },
    );
  }

  const summary = sanitizeSummary(rawSummary);
  if (summary.length < 10) {
    return NextResponse.json(
      { success: false, error: "Summary must be at least 10 characters" },
      { status: 400 },
    );
  }
  if (containsPhi(summary)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Don't include medical detail here — speak with the insurer directly via the helpline.",
      },
      { status: 400 },
    );
  }

  // Ownership check
  const enrolment = await db.proBenefitEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { plan: { select: { name: true } } },
  });
  if (!enrolment) {
    return NextResponse.json(
      { success: false, error: "Enrolment not found" },
      { status: 404 },
    );
  }
  if (enrolment.proId !== pro.id) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  if (enrolment.status === "CANCELLED") {
    return NextResponse.json(
      { success: false, error: "Cannot file a claim on a cancelled enrolment" },
      { status: 400 },
    );
  }

  const claim = await createClaim(
    enrollmentId,
    kind as "HMO" | "ACCIDENT" | "BUNDLE",
    summary,
    session.userId,
  );

  // Best-effort notification
  try {
    if (pro.phone && enrolment.plan.name) {
      await notifyProBenefitClaimOpened(
        pro.phone,
        enrolment.plan.name,
        claim.externalRef ?? null,
      );
    }
  } catch (err) {
    console.error("[partner-benefits] claim notify failed", err);
  }

  return NextResponse.json({ success: true, data: claim });
}
