"use client";

import { useRef, useEffect, KeyboardEvent } from "react";

// ── Icons ────────────────────────────────────────────────────────────────────
const stroke = { strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconSend(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
}
function IconStop(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="currentColor" {...p}><rect x="6" y="6" width="12" height="12" rx="2"/></svg>;
}
function IconLink(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>;
}

// ── ChatInput ────────────────────────────────────────────────────────────────
interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled }: ChatInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend();
    }
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="px-4 sm:px-6 py-4" style={{ background: "linear-gradient(to top, #FAF7F2, transparent)" }}>
      <div className="bg-white rounded-[24px] border border-chat-ink/10 shadow-card p-2 flex items-end gap-2">
        {/* Attach button (decorative) */}
        <button
          type="button"
          title="Adjuntar"
          className="shrink-0 w-10 h-10 grid place-items-center rounded-full text-chat-soft/60 hover:text-plum hover:bg-plum/[0.06] transition-colors"
        >
          <IconLink width={16} height={16} />
        </button>

        {/* Textarea */}
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe tu pregunta…"
          disabled={disabled}
          className="flex-1 resize-none bg-transparent text-[15px] text-chat-ink placeholder:text-chat-soft/45 focus:outline-none leading-relaxed max-h-[200px] py-2.5 px-1"
        />

        {/* Send / Stop button */}
        <button
          type="button"
          onClick={() => onSend()}
          disabled={!canSend && !disabled}
          className={[
            "shrink-0 h-10 w-10 grid place-items-center rounded-full transition-all duration-200",
            canSend || disabled
              ? "bg-chat-orange text-white hover:bg-chat-orange-dk hover:scale-105 shadow-card"
              : "bg-plum/[0.08] text-chat-soft/40 cursor-not-allowed",
          ].join(" ")}
        >
          {disabled
            ? <IconStop width={12} height={12} />
            : <IconSend width={16} height={16} />}
        </button>
      </div>

      <p className="mt-2 px-3 text-[11px] text-chat-soft/55 text-center">
        Verifica siempre las fuentes citadas · Shift+Enter para nueva línea
      </p>
    </div>
  );
}
