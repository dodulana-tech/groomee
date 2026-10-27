import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import {
  assistantEnabled,
  chatMessagesSchema,
  ndjsonStream,
  runAssistant,
  toApiMessages,
} from "@/lib/assistant/engine";
import { CUSTOMER_SYSTEM_PROMPT, customerTools } from "@/lib/assistant/customer";

const SESSION_COOKIE = "gm_asid";
const MAX_TURNS_PER_CONVERSATION = 30;

const bodySchema = z.object({
  conversationId: z.string().max(40).optional(),
  messages: chatMessagesSchema,
});

// POST /api/assistant — public customer concierge. Streams NDJSON events.
export async function POST(req: NextRequest) {
  if (!assistantEnabled()) {
    return NextResponse.json({ success: false, error: "Assistant unavailable" }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!rateLimit(`assistant:${ip}`, 20, 10 * 60 * 1000).success) {
    return NextResponse.json(
      { success: false, error: "You're sending messages quickly — try again in a few minutes." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
  const { messages } = parsed.data;

  const existingSid = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingSid ?? randomUUID();

  let conversation = parsed.data.conversationId
    ? await db.assistantConversation.findFirst({
        where: { id: parsed.data.conversationId, sessionId },
      })
    : null;
  if (conversation && conversation.messageCount >= MAX_TURNS_PER_CONVERSATION * 2) {
    return NextResponse.json(
      { success: false, error: "This chat is getting long — start a new one or message us on WhatsApp." },
      { status: 429 },
    );
  }
  conversation ??= await db.assistantConversation.create({ data: { sessionId } });
  const conversationId = conversation.id;

  const userText = messages[messages.length - 1].content;
  await db.assistantMessage.create({ data: { conversationId, role: "user", content: userText } });

  const headers: Record<string, string> = {};
  if (!existingSid) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    headers["Set-Cookie"] = `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
  }

  return ndjsonStream(async (send) => {
    send({ type: "meta", conversationId });
    const result = await runAssistant({
      system: CUSTOMER_SYSTEM_PROMPT,
      tools: customerTools,
      messages: toApiMessages(messages),
      ctx: undefined,
      onText: (text) => send({ type: "text", text }),
    });

    let reply = result.text;
    if (result.refused) {
      reply =
        "Sorry, I can't help with that one here. For anything else about booking a beauty pro, I'm happy to help — or chat with our team on WhatsApp.";
      send({ type: "replace", text: reply });
    }

    const cityCall = result.toolCalls.find((c) => c.name === "get_city_status");
    const city = (cityCall?.input as { city?: string } | undefined)?.city?.toLowerCase();

    await db.$transaction([
      db.assistantMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: reply,
          toolCalls: result.toolCalls.length ? (result.toolCalls as object) : undefined,
        },
      }),
      db.assistantConversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 2 },
          inputTokens: { increment: result.usage.inputTokens },
          outputTokens: { increment: result.usage.outputTokens },
          cacheReadTokens: { increment: result.usage.cacheReadTokens },
          refused: result.refused || undefined,
          city: city ?? undefined,
          lastMessageAt: new Date(),
        },
      }),
    ]);
    send({ type: "done" });
  }, headers);
}
