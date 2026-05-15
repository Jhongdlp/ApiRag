import type { ChatMessage as ChatMessageType } from "@/types";

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-uti-blue text-white rounded-br-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
        }`}
      >
        <p>{message.content}</p>
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium mb-1">Fuentes:</p>
            <ul className="space-y-0.5">
              {message.sources.map((src, i) => (
                <li key={i} className="text-xs text-gray-500">
                  {src.filename ?? "Documento institucional"}
                  {src.h1 ? ` — ${src.h1}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
