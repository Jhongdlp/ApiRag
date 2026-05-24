"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { submitFeedback } from "@/lib/api";
import ChatMessage, { TypingBubble } from "./ChatMessage";
import ChatInput from "./ChatInput";
import type { ChatMessage as ChatMessageType } from "@/types";

type Rating = 1 | -1;

// ── Icons ─────────────────────────────────────────────────────────────────────
const stroke = { strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconPlus(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} strokeWidth={1.9} {...p}><path d="M12 5v14M5 12h14"/></svg>;
}
function IconArrow(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
}
function IconBook(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h12"/></svg>;
}
function IconBriefcase(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><rect x="3" y="7" width="18" height="14" rx="2.5"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
}
function IconAward(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/></svg>;
}
function IconCalendar(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>;
}

// ── Brand mark ────────────────────────────────────────────────────────────────
function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <div className="relative grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 bg-white rounded-[10px]" />
      <div
        className="absolute left-0 top-0 bg-chat-orange rounded-tl-[10px]"
        style={{ width: size * 0.32, height: size * 0.42 }}
      />
      <span
        className="relative font-serif not-italic font-semibold text-plum"
        style={{ fontSize: size * 0.62, lineHeight: 1, marginTop: -1 }}
      >
        A
      </span>
    </div>
  );
}

// ── Suggestions ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { Icon: IconBook,      tag: "Régimen",    text: "¿Cuántos créditos necesito para titularme en Ingeniería en Sistemas?" },
  { Icon: IconBriefcase, tag: "Prácticas",  text: "¿Cuántas horas de prácticas pre-profesionales debo cumplir?" },
  { Icon: IconAward,     tag: "Becas",      text: "¿Qué requisitos pide la beca por excelencia académica?" },
  { Icon: IconCalendar,  tag: "Calendario", text: "¿Cuándo abren las inscripciones para el periodo 2026-B?" },
];

const FOLLOW_UPS = [
  "¿Y para Ingeniería Industrial?",
  "¿Puedo convalidar materias?",
  "¿Dónde descargo el formato?",
];

// ── Welcome screen ─────────────────────────────────────────────────────────────
function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="px-6 sm:px-10 pt-12 sm:pt-16 pb-10 animate-chat-pop">
      <div className="max-w-[640px]">
        <h1
          className="text-chat-ink mt-5 font-semibold"
          style={{ fontSize: 48, lineHeight: 1.05, letterSpacing: "-0.02em" }}
        >
          Hola, bienvenido.
          <br />
          <span className="serif-display text-chat-orange">¿Qué quieres saber</span>{" "}
          <span className="font-semibold" style={{ fontFamily: "inherit" }}>hoy?</span>
        </h1>

        <p className="text-chat-soft mt-5 text-[16px] leading-relaxed max-w-[520px]">
          Pregúntame sobre reglamentos, becas, prácticas o calendario.
          Te respondo con las fuentes oficiales citadas.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[720px]">
        {SUGGESTIONS.map(({ Icon, tag, text }, i) => (
          <button
            key={i}
            onClick={() => onPick(text)}
            className="group text-left p-4 rounded-2xl bg-white border border-chat-ink/[0.08] hover:border-chat-orange/40 hover:-translate-y-0.5 hover:shadow-chip transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-plum/[0.08] text-plum grid place-items-center shrink-0 group-hover:bg-chat-orange/[0.12] group-hover:text-chat-orange transition-colors">
                <Icon width={18} height={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-plum/70">{tag}</div>
                <div className="text-[14px] text-chat-ink mt-1 leading-snug">{text}</div>
              </div>
              <IconArrow
                width={14}
                height={14}
                className="text-chat-soft/30 group-hover:text-chat-orange transition-colors mt-1 shrink-0"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Day separator ──────────────────────────────────────────────────────────────
function DayChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center my-2">
      <div className="px-3 py-1 rounded-full bg-plum/[0.08] text-plum/70 text-[11px] font-medium tracking-wide whitespace-nowrap">
        {children}
      </div>
    </div>
  );
}

// ── ChatWindow ─────────────────────────────────────────────────────────────────
export default function ChatWindow() {
  const { messages, loading, error, send, regenerate, reset } = useChat();
  const [input, setInput] = useState("");
  const [feedbackMap, setFeedbackMap] = useState<Record<string, Rating>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleFeedback = useCallback(
    (msg: ChatMessageType, rating: Rating | null) => {
      if (rating === null) {
        setFeedbackMap((prev) => {
          const next = { ...prev };
          delete next[msg.id];
          return next;
        });
      } else {
        setFeedbackMap((prev) => ({ ...prev, [msg.id]: rating }));
      }
      if (msg.message_id) {
        submitFeedback(msg.message_id, rating).catch(() => {});
      }
    },
    []
  );

  const now = new Date();
  const time = now.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
  const dayLabel = `Hoy · ${now.toLocaleDateString("es-EC", {
    weekday: "long", day: "numeric", month: "long",
  })}`;

  const lastMsg = messages[messages.length - 1];
  const showFollowUps = !loading && lastMsg?.role === "assistant" && messages.length > 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, error]);

  const handleSend = (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput("");
    send(text);
  };

  const handleReset = () => {
    setInput("");
    reset();
  };

  return (
    <>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="w-full max-w-[920px] mx-auto px-6 pt-7 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark size={34} />
          <div className="leading-tight">
            <div className="text-white font-semibold tracking-tight" style={{ fontSize: 16 }}>
              Asistente Académico
            </div>
            <div className="text-white/60 text-[12px] flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              En línea · responde en segundos
            </div>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/30 text-white text-[13px] font-medium transition-colors backdrop-blur whitespace-nowrap"
        >
          <IconPlus width={14} height={14} />
          <span>Nueva conversación</span>
        </button>
      </header>

      {/* ── Main chat panel ──────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-[920px] mx-auto px-4 sm:px-6 pb-5 flex flex-col min-h-0">
        <div
          className="bg-cream rounded-[28px] shadow-card border border-white/20 flex flex-col overflow-hidden"
          style={{ minHeight: "min(680px, calc(100vh - 150px))", maxHeight: "calc(100vh - 130px)" }}
        >
          {/* Scrollable message area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll">
            {messages.length === 0 && !loading ? (
              <Welcome onPick={handleSend} />
            ) : (
              <div className="px-4 sm:px-6 py-6 space-y-5 max-w-[760px] mx-auto">
                <DayChip>{dayLabel}</DayChip>

                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    time={time}
                    feedback={feedbackMap[msg.id]}
                    onFeedback={(r: Rating | null) => handleFeedback(msg, r)}
                    onRegenerate={() => regenerate(msg.id)}
                  />
                ))}

                {loading && <TypingBubble />}

                {error && (
                  <div className="mx-auto max-w-sm p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-[13px]">
                    <p className="font-semibold">Error al consultar</p>
                    <p className="mt-1 text-[12px] opacity-80">{error}</p>
                  </div>
                )}

                <div className="h-2" />
              </div>
            )}
          </div>

          {/* Follow-up chips */}
          {showFollowUps && (
            <div className="px-4 sm:px-6 pt-2 pb-1 flex flex-wrap gap-2">
              {FOLLOW_UPS.map((f, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(f)}
                  className="px-3.5 py-1.5 rounded-full bg-white border border-chat-ink/10 hover:border-chat-orange/40 hover:text-chat-orange text-[12.5px] text-chat-ink transition-colors shadow-chip whitespace-nowrap"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={loading}
          />
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="w-full max-w-[920px] mx-auto px-6 pb-5 flex items-center justify-between text-[11px] text-white/55">
        <span>© 2026 Asistente Académico UTI</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Sistema operativo
        </span>
      </footer>
    </>
  );
}
