import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { buildPreview, commitImport, toRawRows } from "@/lib/pro-import";

const schema = z.object({
  text: z.string().max(500_000, "That file is too large. Split it into smaller imports."),
  mode: z.enum(["preview", "commit"]),
  status: z.enum(["ACTIVE", "PENDING"]).default("ACTIVE"),
  duplicates: z.enum(["skip", "update"]).default("skip"),
  sendInvites: z.boolean().default(true),
});

// POST /api/admin/pros/import — preview (no writes) or commit. Commit always
// re-validates server-side; the client's preview is never trusted.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!hasPermission(session, "pros.manage")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }
  const { text, mode, status, duplicates, sendInvites } = parsed.data;

  const { rows: raw, error } = toRawRows(text);
  if (error) return NextResponse.json({ success: false, error }, { status: 400 });

  try {
    const preview = await buildPreview(raw, duplicates);
    if (mode === "preview") {
      return NextResponse.json({ success: true, data: { rows: preview } });
    }
    const results = await commitImport({ rows: preview, status, adminId: session!.userId, sendInvites });
    return NextResponse.json({ success: true, data: { results } });
  } catch (err) {
    console.error("pro import error:", err);
    return NextResponse.json({ success: false, error: "Import failed. Please try again; rows already imported will show as duplicates in the next preview." }, { status: 500 });
  }
}
