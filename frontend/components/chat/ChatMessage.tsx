import type { ChatMessage as ChatMessageType } from "@/types";
import { FileText, BookMarked } from "lucide-react";

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div
        className={`max-w-[70%] rounded-2xl px-5 py-4 text-sm leading-relaxed transition-all duration-200 ${
          isUser
            ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-br-sm shadow-lg shadow-blue-600/20"
            : "bg-slate-700/50 border border-slate-600 text-slate-100 rounded-bl-sm backdrop-blur-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-600/50">
            <div className="flex items-center gap-2 mb-3">
              <BookMarked className="w-4 h-4 text-cyan-400" />
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Fuentes Citadas
              </p>
            </div>

            <div className="space-y-2">
              {message.sources.map((src, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-lg p-3 border border-slate-600/30 hover:border-cyan-500/50 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0 group-hover:text-cyan-300" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-cyan-300 truncate group-hover:text-cyan-200">
                        [{i + 1}] {src.filename ?? "Documento institucional"}
                      </p>
                      {src.page_number && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          📄 Pág. {src.page_number}
                        </p>
                      )}
                      {src.heading_path && (
                        <p className="text-xs text-slate-400 mt-1 italic">
                          📍 {src.heading_path}
                        </p>
                      )}
                      {src.snippet && (
                        <p className="text-xs text-slate-300 mt-2 bg-slate-900/50 rounded p-2 border-l-2 border-cyan-500/50">
                          "{src.snippet.substring(0, 120)}..."
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {message.latency_ms && (
              <p className="text-xs text-slate-400 mt-3 text-center">
                ⚡ Generado en {message.latency_ms}ms
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
