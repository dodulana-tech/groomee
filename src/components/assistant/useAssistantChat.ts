"use client";

import { useCallback, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Streams NDJSON events from an assistant endpoint (/api/assistant or
 * /api/admin/assistant) into a message list.
 */
export function useAssistantChat(endpoint: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setError(null);
      const history: ChatMessage[] = [...messages, { role: "user", content: trimmed.slice(0, 2000) }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setBusy(true);

      const appendToReply = (fn: (prev: string) => string) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: fn(next[next.length - 1].content) };
          return next;
        });

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationId.current ?? undefined,
            messages: history.slice(-20),
          }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Something went wrong — please try again.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            if (event.type === "meta") conversationId.current = event.conversationId;
            else if (event.type === "text") appendToReply((prev) => prev + event.text);
            else if (event.type === "replace") appendToReply(() => event.text);
            else if (event.type === "error") throw new Error(event.message);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        // Drop the empty placeholder reply so the user can retry.
        setMessages((prev) =>
          prev[prev.length - 1]?.content === "" ? prev.slice(0, -1) : prev,
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, endpoint, messages],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    conversationId.current = null;
  }, []);

  return { messages, busy, error, send, reset, conversationId };
}
