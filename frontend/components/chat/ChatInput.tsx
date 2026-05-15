"use client";

import { useState, KeyboardEvent } from "react";
import Button from "@/components/ui/Button";

interface ChatInputProps {
  onSend: (query: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

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
    <div className="flex items-end gap-2 border border-gray-200 rounded-2xl bg-white p-3 shadow-sm">
      <textarea
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe tu pregunta sobre la UTI..."
        disabled={disabled}
        className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-400 max-h-32"
      />
      <Button onClick={handleSend} disabled={!value.trim()} loading={disabled} className="shrink-0">
        Enviar
      </Button>
    </div>
  );
}
