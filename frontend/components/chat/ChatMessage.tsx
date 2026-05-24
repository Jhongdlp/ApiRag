"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, Source } from "@/types";

type Rating = 1 | -1;

// ── Inline SVG icons ────────────────────────────────────────────────────────
const stroke = { strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconBook(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h12"/></svg>;
}
function IconChev({ open, ...p }: React.SVGProps<SVGSVGElement> & { open: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 180ms" }}><path d="M6 9l6 6 6-6"/></svg>;
}
function IconCopy(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>;
}
function IconThumbUp(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><path d="M7 10v11M3 10h4v11H3z M7 10l5-7a3 3 0 0 1 3 3v4h5a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7"/></svg>;
}
function IconThumbDn(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><path d="M17 14V3M21 14h-4V3h4z M17 14l-5 7a3 3 0 0 1-3-3v-4H4a2 2 0 0 1-2-2l2-7a2 2 0 0 1 2-2h11"/></svg>;
}
function IconRefresh(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/></svg>;
}

// ── AI Avatar ───────────────────────────────────────────────────────────────
function IconSparkle(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...stroke} {...p}><path d="M12 3l1.6 4.2a4 4 0 0 0 2.6 2.6L20.4 12l-4.2 1.6a4 4 0 0 0-2.6 2.6L12 20.4l-1.6-4.2a4 4 0 0 0-2.6-2.6L3.6 12l4.2-1.6a4 4 0 0 0 2.6-2.6L12 3z"/></svg>;
}

export function AIAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="relative rounded-full grid place-items-center shrink-0 shadow-sm"
      style={{
        width: size, height: size,
        background: "radial-gradient(circle at 30% 25%, #6B3FBA 0%, #3D1E72 60%, #2A1352 100%)",
      }}
    >
      <IconSparkle
        width={size * 0.5}
        height={size * 0.5}
        className="text-chat-orange"
      />
    </div>
  );
}

// ── Markdown + citation renderer ────────────────────────────────────────────
function parseCitedIndices(text: string): Set<number> {
  const cited = new Set<number>();
  const re = /\[Fuente\s+(\d+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) cited.add(parseInt(m[1], 10));
  return cited;
}

function renderContent(raw: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  raw.split("\n").forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />);
    const re = /(\*\*[^*]+\*\*|\[Fuente\s+(\d+)\])/g;
    let last = 0;
    let si = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) nodes.push(line.slice(last, m.index));
      if (m[0].startsWith("**")) {
        nodes.push(
          <strong key={`${lineIdx}-b${si++}`} className="font-bold text-chat-ink">
            {m[0].slice(2, -2)}
          </strong>
        );
      } else {
        const idx = parseInt(m[2], 10);
        nodes.push(
          <sup
            key={`${lineIdx}-f${si++}`}
            title={`Ver Fuente ${idx}`}
            className="inline-flex items-center justify-center w-[15px] h-[15px] text-[9px] font-bold rounded-full bg-plum/[0.12] text-plum ml-0.5 cursor-default"
          >
            {idx}
          </sup>
        );
      }
      last = re.lastIndex;
    }
    if (last < line.length) nodes.push(line.slice(last));
  });
  return nodes;
}

// ── Sources block ───────────────────────────────────────────────────────────
function SourcesBlock({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2.5 max-w-[88%]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 text-[11.5px] font-semibold text-plum/80 hover:text-plum px-3 py-1.5 rounded-full bg-plum/[0.06] hover:bg-plum/10 transition-colors whitespace-nowrap"
      >
        <IconBook width={12} height={12} />
        <span>{sources.length} fuente{sources.length !== 1 ? "s" : ""} citada{sources.length !== 1 ? "s" : ""}</span>
        <IconChev open={open} width={11} height={11} />
      </button>

      {open && (
        <div className="mt-2 bg-white border border-chat-ink/[0.08] rounded-2xl overflow-hidden animate-chat-pop">
          {sources.map((s, i) => {
            const score = s.score ?? 0;
            const scorePct = Math.round(score * 100);
            const scoreCls =
              score > 0.85
                ? "text-emerald-700 bg-emerald-50"
                : score > 0.75
                ? "text-chat-orange bg-chat-orange/[0.08]"
                : "text-chat-soft bg-plum/[0.05]";

            return (
              <div
                key={i}
                className="w-full grid items-center gap-3 px-3 py-2.5 hover:bg-plum/[0.04] border-b border-chat-ink/[0.06] last:border-b-0 transition-colors"
                style={{ gridTemplateColumns: "26px 1fr auto auto" }}
              >
                <span className="w-6 h-6 rounded-md bg-plum/10 text-plum grid place-items-center text-[11px] font-bold">
                  {i + 1}
                </span>
                <span className="text-[13px] text-chat-ink truncate">
                  {s.filename ?? "Documento institucional"}
                </span>
                {s.page_number != null && (
                  <span className="text-[11.5px] text-chat-soft font-medium font-mono">
                    p.{s.page_number}
                  </span>
                )}
                {scorePct > 0 && (
                  <span className={`text-[11.5px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${scoreCls}`}>
                    {scorePct}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Typing indicator ────────────────────────────────────────────────────────
export function TypingBubble() {
  return (
    <div className="flex items-end gap-2.5 animate-chat-pop">
      <AIAvatar size={32} />
      <div className="bg-white px-4 py-3 rounded-[20px] rounded-bl-md shadow-card border border-chat-ink/[0.06]">
        <div className="flex items-center gap-1.5 py-0.5 px-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-plum/40 animate-dot-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── User bubble ─────────────────────────────────────────────────────────────
function UserBubble({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex justify-end items-end gap-2 animate-chat-slide">
      <div className="max-w-[78%] flex flex-col items-end">
        <div className="bg-plum text-white px-4 py-3 rounded-[20px] rounded-br-md shadow-card">
          <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
        <div className="text-[10.5px] text-chat-soft/55 mt-1 mr-1 font-mono">{time}</div>
      </div>
    </div>
  );
}

// ── Assistant bubble ─────────────────────────────────────────────────────────
function AssistantBubble({
  message,
  time,
  feedback,
  onFeedback,
  onRegenerate,
}: {
  message: ChatMessageType;
  time: string;
  feedback?: Rating;
  onFeedback?: (r: Rating | null) => void;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [notif, setNotif] = useState<string | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const citedIndices = parseCitedIndices(message.content);
  const citedSources = (message.sources ?? []).filter((_, i) => citedIndices.has(i + 1));

  useEffect(() => () => { if (notifTimer.current) clearTimeout(notifTimer.current); }, []);

  const showNotif = (text: string) => {
    setNotif(null);
    requestAnimationFrame(() => {
      setNotif(text);
      if (notifTimer.current) clearTimeout(notifTimer.current);
      notifTimer.current = setTimeout(() => setNotif(null), 2200);
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      showNotif("Copiado");
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const handleFeedback = (r: Rating) => {
    const isToggleOff = feedback === r;
    onFeedback?.(isToggleOff ? null : r);
    showNotif(isToggleOff ? "Valoración eliminada" : "Respuesta enviada");
  };

  return (
    <div className="flex items-start gap-2.5 animate-chat-slide">
      <AIAvatar size={32} />
      <div className="min-w-0 flex-1 max-w-[78%]">
        <div className="bg-white px-4 py-3 rounded-[20px] rounded-bl-md shadow-card border border-chat-ink/[0.06]">
          <div className="text-[14.5px] text-chat-ink leading-[1.65] ans-text">
            {renderContent(message.content)}
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="flex items-center gap-2 mt-1.5 ml-1">
          {/* Meta */}
          <span className="text-[10.5px] text-chat-soft/50 font-mono">{time}</span>
          {message.latency_ms && (
            <span className="text-[10.5px] text-chat-soft/35 font-mono">· {message.latency_ms}ms</span>
          )}

          {/* Separator */}
          <span className="w-px h-3 bg-chat-ink/10" />

          {/* Button group */}
          <div className="flex items-center rounded-full border border-chat-ink/[0.09] bg-white/70 divide-x divide-chat-ink/[0.07] overflow-hidden shadow-sm">
            {/* Copy */}
            <button
              title={copied ? "Copiado" : "Copiar"}
              onClick={handleCopy}
              className={`w-7 h-6 grid place-items-center transition-colors ${
                copied
                  ? "text-emerald-500 bg-emerald-50"
                  : "text-chat-soft/50 hover:text-plum hover:bg-plum/[0.06]"
              }`}
            >
              <IconCopy width={11} height={11} />
            </button>

            {/* Like */}
            <button
              title={feedback === 1 ? "Quitar valoración" : "Útil"}
              onClick={() => handleFeedback(1)}
              className={`w-7 h-6 grid place-items-center transition-colors ${
                feedback === 1
                  ? "text-emerald-600 bg-emerald-50"
                  : "text-chat-soft/50 hover:text-emerald-500 hover:bg-emerald-50/60"
              }`}
            >
              <IconThumbUp width={11} height={11} />
            </button>

            {/* Dislike */}
            <button
              title={feedback === -1 ? "Quitar valoración" : "No útil"}
              onClick={() => handleFeedback(-1)}
              className={`w-7 h-6 grid place-items-center transition-colors ${
                feedback === -1
                  ? "text-red-500 bg-red-50"
                  : "text-chat-soft/50 hover:text-red-400 hover:bg-red-50/60"
              }`}
            >
              <IconThumbDn width={11} height={11} />
            </button>

            {/* Regenerate */}
            <button
              title="Regenerar respuesta"
              onClick={onRegenerate}
              className="w-7 h-6 grid place-items-center text-chat-soft/50 hover:text-plum hover:bg-plum/[0.06] transition-colors"
            >
              <IconRefresh width={11} height={11} />
            </button>
          </div>

          {/* Notificación inline */}
          {notif && (
            <span
              key={notif + Date.now()}
              className="text-[10.5px] text-chat-soft/70 font-medium animate-fade-in whitespace-nowrap"
            >
              {notif} ✓
            </span>
          )}
        </div>

        {citedSources.length > 0 && <SourcesBlock sources={citedSources} />}
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function ChatMessage({
  message,
  time,
  feedback,
  onFeedback,
  onRegenerate,
}: {
  message: ChatMessageType;
  time: string;
  feedback?: Rating;
  onFeedback?: (r: Rating | null) => void;
  onRegenerate?: () => void;
}) {
  if (message.role === "user") {
    return <UserBubble text={message.content} time={time} />;
  }
  return (
    <AssistantBubble
      message={message}
      time={time}
      feedback={feedback}
      onFeedback={onFeedback}
      onRegenerate={onRegenerate}
    />
  );
}
