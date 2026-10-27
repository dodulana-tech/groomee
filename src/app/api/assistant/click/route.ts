import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { classifyClick } from "@/lib/assistant/links";

const bodySchema = z.object({
  conversationId: z.string().max(40),
  href: z.string().max(500),
});

// POST /api/assistant/click — beacon fired when a visitor taps a link in the
// concierge. Marks the conversation's booking / WhatsApp outcome flag.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  const sessionId = req.cookies.get("gm_asid")?.value;
  if (!parsed.success || !sessionId) return new NextResponse(null, { status: 204 });

  const kind = classifyClick(parsed.data.href);
  if (kind) {
    await db.assistantConversation.updateMany({
      where: { id: parsed.data.conversationId, sessionId },
      data: kind === "booking" ? { clickedBooking: true } : { clickedWhatsApp: true },
    });
  }
  return new NextResponse(null, { status: 204 });
}
