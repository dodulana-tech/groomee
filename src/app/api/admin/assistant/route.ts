import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hasPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction } from "@/lib/admin-audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  assistantEnabled,
  chatMessagesSchema,
  ndjsonStream,
  runAssistant,
  toApiMessages,
} from "@/lib/assistant/engine";
import { adminSystemPrompt, adminTools } from "@/lib/assistant/admin";

const bodySchema = z.object({
  conversationId: z.string().max(40).optional(),
  messages: chatMessagesSchema,
});

// POST /api/admin/assistant — ops copilot for admins with copilot.use.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasPermission(session, PERMISSIONS.COPILOT_USE)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  if (!assistantEnabled()) {
    return NextResponse.json(
      { success: false, error: "Copilot is off — set ANTHROPIC_API_KEY to enable it." },
      { status: 503 },
    );
  }
  if (!rateLimit(`copilot:${session.userId}`, 60, 10 * 60 * 1000).success) {
    return NextResponse.json({ success: false, error: "Slow down a little — try again shortly." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
  const { messages } = parsed.data;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

  return ndjsonStream(async (send) => {
    let result: Awaited<ReturnType<typeof runAssistant>> | null = null;
    try {
      result = await runAssistant({
        system: adminSystemPrompt(today),
        tools: adminTools,
        messages: toApiMessages(messages),
        ctx: { session },
        onText: (text) => send({ type: "text", text }),
      });
      if (result.refused) {
        send({ type: "replace", text: "I can't help with that request. Try rephrasing it as an ops question." });
      }
      send({ type: "done" });
    } finally {
      // Audit every question, including ones where the model call failed.
      await logAdminAction({
        adminId: session.userId,
        action: "copilot.query",
        entityType: "copilot",
        entityId: session.userId,
        metadata: {
          question: messages[messages.length - 1].content.slice(0, 500),
          tools: result?.toolCalls.map((c) => c.name) ?? [],
          refused: result?.refused ?? false,
          failed: !result,
          usage: result?.usage,
        },
      });
    }
  });
}
