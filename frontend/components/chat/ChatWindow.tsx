"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { Sparkles, BookOpen } from "lucide-react";

export default function ChatWindow() {
  const { messages, loading, error, send } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-6 shadow-lg border-b border-blue-500/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-xl">Asistente Académico UTI</h1>
            <p className="text-blue-100 text-sm mt-1">
              Consulta reglamentos, manuales y normativas institucionales
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            <div className="p-4 bg-slate-700/50 rounded-full backdrop-blur-sm">
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-200 mb-2">
                ¡Hola! 👋
              </h2>
              <p className="text-slate-400 max-w-md">
                Soy tu asistente académico. Puedo ayudarte con preguntas sobre
                reglamentos, manuales y normativas de la UTI.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4 w-full max-w-sm">
              {[
                "¿Cuáles son los requisitos de admisión?",
                "¿Cómo funciona el sistema de calificaciones?",
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => send(q)}
                  className="text-xs p-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-slate-100 transition-all duration-200 border border-slate-600 hover:border-blue-500/50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700/50 border border-slate-600 rounded-2xl rounded-bl-sm px-4 py-3 backdrop-blur-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-sm p-4 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-sm">
            <p className="font-medium">Error</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="bg-gradient-to-t from-slate-900 to-slate-800 border-t border-slate-700 px-6 py-4">
        <ChatInput onSend={send} disabled={loading} />
      </div>
    </div>
  );
}
