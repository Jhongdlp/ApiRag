"use client";

import { useState, KeyboardEvent } from "react";
import { Send, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSend: (query: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={`flex items-end gap-3 rounded-2xl transition-all duration-200 p-4 backdrop-blur-sm border ${
          isFocused
            ? "bg-slate-700/80 border-cyan-500/50 shadow-lg shadow-cyan-500/10"
            : "bg-slate-700/50 border-slate-600 hover:bg-slate-700/60"
        }`}
      >
        <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white flex-shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>

        <textarea
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            // Auto-grow textarea
            const textarea = e.target;
            textarea.style.height = "auto";
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Pregunta sobre reglamentos, manuales o normativas..."
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-slate-400 text-slate-100 max-h-32 font-medium"
        />

        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="p-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0 hover:shadow-lg hover:shadow-cyan-600/30"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center">
        💡 Presiona Enter para enviar • Shift+Enter para nueva línea
      </p>
    </div>
  );
}
