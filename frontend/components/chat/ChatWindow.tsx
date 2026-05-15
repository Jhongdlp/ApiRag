"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import Spinner from "@/components/ui/Spinner";

export default function ChatWindow() {
  const { messages, loading, error, send } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="w-full max-w-2xl flex flex-col h-[90vh]">
      {/* Header */}
      <div className="bg-uti-blue text-white rounded-t-2xl px-6 py-4">
        <h1 className="font-bold text-lg">Asistente Académico UTI</h1>
        <p className="text-blue-200 text-xs mt-0.5">
          Consulta reglamentos, manuales y normativas institucionales
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">
            Hola, ¿en qué puedo ayudarte hoy?
          </p>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <Spinner size={4} />
            </div>
          </div>
        )}
        {error && (
          <p className="text-center text-red-500 text-xs">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-gray-50 rounded-b-2xl px-4 pb-4 pt-2">
        <ChatInput onSend={send} disabled={loading} />
      </div>
    </div>
  );
}
