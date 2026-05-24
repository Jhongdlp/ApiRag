"use client";

import { useState, useCallback } from "react";
import { sendMessage } from "@/lib/api";
import type { ChatMessage } from "@/types";

function buildAssistantMsg(data: { answer: string; sources?: ChatMessage["sources"]; latency_ms?: number; message_id?: string | null }): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: data.answer,
    sources: data.sources,
    latency_ms: data.latency_ms,
    message_id: data.message_id,
  };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One UUID per conversation; reset() generates a new one so Supabase
  // groups messages correctly under separate chat_sessions rows.
  const [sessionToken, setSessionToken] = useState<string>(() => crypto.randomUUID());

  const send = useCallback(
    async (query: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: query,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const data = await sendMessage(query, sessionToken);
        setMessages((prev) => [...prev, buildAssistantMsg(data)]);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "No se pudo obtener respuesta. Intenta nuevamente.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [sessionToken]
  );

  const regenerate = useCallback(
    async (clientId: string) => {
      const idx = messages.findIndex((m) => m.id === clientId);
      if (idx < 0) return;
      const userMsg = [...messages].slice(0, idx).reverse().find((m) => m.role === "user");
      if (!userMsg) return;
      setMessages((prev) => prev.slice(0, idx));
      setLoading(true);
      setError(null);
      try {
        const data = await sendMessage(userMsg.content, sessionToken);
        setMessages((prev) => [...prev, buildAssistantMsg(data)]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al regenerar respuesta.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [messages, sessionToken]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setSessionToken(crypto.randomUUID());
  }, []);

  return { messages, loading, error, send, regenerate, reset };
}
