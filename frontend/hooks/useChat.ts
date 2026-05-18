"use client";

import { useState, useCallback } from "react";
import { sendMessage } from "@/lib/api";
import type { ChatMessage } from "@/types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (query: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      const data = await sendMessage(query);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        latency_ms: data.latency_ms,
        message_id: data.message_id,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "No se pudo obtener respuesta. Intenta nuevamente.";
      setError(errorMessage);
      console.error("Chat error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { messages, loading, error, send };
}
