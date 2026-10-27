/**
 * Shared Claude tool-loop used by the customer concierge (/api/assistant)
 * and the admin ops copilot (/api/admin/assistant).
 *
 * Streams text deltas through `onText`, runs read-only tools server-side,
 * and returns the final text + token usage. Tools never mutate state.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const ASSISTANT_MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;

export interface AssistantTool<Ctx> {
  name: string;
  description: string;
  input: z.ZodTypeAny;
  // JSON schema sent to the API — kept beside the zod schema that validates it.
  inputSchema: Anthropic.Beta.BetaTool.InputSchema;
  run: (input: any, ctx: Ctx) => Promise<unknown>;
}

export interface AssistantUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export interface AssistantResult {
  text: string;
  refused: boolean;
  toolCalls: { name: string; input: unknown }[];
  usage: AssistantUsage;
}

let client: Anthropic | null = null;

export function assistantEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export async function runAssistant<Ctx>({
  system,
  tools,
  messages,
  ctx,
  onText,
  maxTokens = 4000,
}: {
  system: string;
  tools: AssistantTool<Ctx>[];
  messages: Anthropic.Beta.BetaMessageParam[];
  ctx: Ctx;
  onText: (delta: string) => void;
  maxTokens?: number;
}): Promise<AssistantResult> {
  const anthropic = getClient();
  const apiTools: Anthropic.Beta.BetaTool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
  const byName = new Map(tools.map((t) => [t.name, t]));
  const convo = [...messages];
  const usage: AssistantUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  const toolCalls: AssistantResult["toolCalls"] = [];
  let text = "";

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const stream = anthropic.beta.messages.stream({
      model: ASSISTANT_MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      // Stable prefix (tools + system) is cached; the conversation varies.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: apiTools,
      messages: convo,
    });
    stream.on("text", (delta) => {
      text += delta;
      onText(delta);
    });

    const message = await stream.finalMessage();
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;

    if (message.stop_reason === "refusal") {
      return { text, refused: true, toolCalls, usage };
    }
    if (message.stop_reason === "pause_turn") {
      convo.push({ role: "assistant", content: message.content });
      continue;
    }

    const toolUses = message.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length === 0 || message.stop_reason !== "tool_use") break;

    convo.push({ role: "assistant", content: message.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (use) => {
        const tool = byName.get(use.name);
        const parsed = tool?.input.safeParse(use.input);
        if (!tool || !parsed?.success) {
          return {
            type: "tool_result" as const,
            tool_use_id: use.id,
            is_error: true,
            content: `Invalid call to ${use.name}: ${parsed?.error?.message ?? "unknown tool"}`,
          };
        }
        toolCalls.push({ name: use.name, input: parsed.data });
        try {
          const out = await tool.run(parsed.data, ctx);
          return { type: "tool_result" as const, tool_use_id: use.id, content: JSON.stringify(out) };
        } catch (err) {
          console.error(`[assistant] tool ${use.name} failed`, err);
          return {
            type: "tool_result" as const,
            tool_use_id: use.id,
            is_error: true,
            content: err instanceof ToolError ? err.message : "Tool failed — tell the user you couldn't look that up.",
          };
        }
      }),
    );
    convo.push({ role: "user", content: results });
    // Keep the streamed reply readable across tool rounds.
    if (text && !text.endsWith("\n")) {
      text += "\n\n";
      onText("\n\n");
    }
  }

  return { text, refused: false, toolCalls, usage };
}

/** Errors whose message is safe to show the model (e.g. permission denials). */
export class ToolError extends Error {}

/**
 * NDJSON streaming response. Each line is one event:
 *   {type:"meta", ...} | {type:"text", text} | {type:"done", ...} | {type:"error", message}
 */
export function ndjsonStream(
  run: (send: (event: Record<string, unknown>) => void) => Promise<void>,
  headers: Record<string, string> = {},
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await run(send);
      } catch (err) {
        console.error("[assistant] run failed", err);
        send({
          type: "error",
          message:
            err instanceof Anthropic.RateLimitError
              ? "I'm a little busy right now — please try again in a minute."
              : "Sorry, something went wrong on our side.",
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export const chatMessagesSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2000),
    }),
  )
  .min(1)
  .max(20)
  .refine((m) => m[m.length - 1].role === "user", "Last message must be from the user");

export function toApiMessages(
  messages: z.infer<typeof chatMessagesSchema>,
): Anthropic.Beta.BetaMessageParam[] {
  // The first message must be a user turn.
  const start = messages.findIndex((m) => m.role === "user");
  return messages.slice(start).map((m) => ({ role: m.role, content: m.content }));
}
