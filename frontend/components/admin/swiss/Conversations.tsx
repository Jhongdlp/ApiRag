"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Eye,
  Filter,
  Minus,
  Plus,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { Avatar, Button, EmptyState, Input, PageHeader, cx } from "./ui";
import { getConversation, listConversations } from "@/lib/api";
import type {
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
} from "@/types";

// ─── Utilidades ──────────────────────────────────────────────────────────────

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

function formatClock(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userLabel(c: { id: string; session_token?: string | null }): string {
  if (c.session_token) return `Anónimo · ${c.session_token.slice(0, 6)}`;
  return `Sesión · ${c.id.slice(0, 6)}`;
}

function shortId(id: string): string {
  return `S-${id.slice(0, 6).toUpperCase()}`;
}

// ─── MessageBubble ───────────────────────────────────────────────────────────

function MessageBubble({ m, index }: { m: ConversationMessage; index: number }) {
  const [open, setOpen] = useState(false);
  const time = formatClock(m.created_at);

  if (m.role === "user") {
    return (
      <div className="grid grid-cols-[20px_1fr] sm:grid-cols-[24px_1fr] gap-3 sm:gap-4 animate-fade-in">
        <span className="font-mono text-[10px] text-dim tabular pt-1.5">
          {String(index).padStart(2, "0")}
        </span>
        <div>
          <div className="flex items-baseline gap-3 mb-1.5">
            <span className="eyebrow text-muted">Usuario</span>
            <span className="font-mono text-[10px] text-dim tabular">{time}</span>
          </div>
          <div className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">
            {m.content}
          </div>
        </div>
      </div>
    );
  }

  const rendered = m.content.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const ratingBadge =
    m.rating === 1 ? (
      <span className="text-emerald-300 font-mono text-[10px] uppercase tracking-wider">
        ↑ útil
      </span>
    ) : m.rating === -1 ? (
      <span className="text-red-300 font-mono text-[10px] uppercase tracking-wider">
        ↓ no útil
      </span>
    ) : null;

  return (
    <div className="grid grid-cols-[20px_1fr] sm:grid-cols-[24px_1fr] gap-3 sm:gap-4 animate-fade-in">
      <span className="font-mono text-[10px] text-gold tabular pt-1.5">
        {String(index).padStart(2, "0")}
      </span>
      <div className="border-l-2 border-gold pl-4 sm:pl-5 py-1">
        <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
          <span className="eyebrow text-gold">Asistente</span>
          <span className="font-mono text-[10px] text-dim tabular">{time}</span>
          {m.latency_ms != null && (
            <span className="font-mono text-[10px] text-dim tabular">
              {(m.latency_ms / 1000).toFixed(2)}s
            </span>
          )}
          {ratingBadge}
        </div>
        <div
          className="text-[14px] text-white leading-relaxed"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
        {m.sources && m.sources.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted hover:text-white"
            >
              {open ? <Minus size={11} /> : <Plus size={11} />}
              Fuentes recuperadas · {m.sources.length}
            </button>
            {open && (
              <ul className="mt-3 space-y-1 animate-fade-in">
                {m.sources.map((s, i) => (
                  <li
                    key={s.chunk_id || i}
                    className="grid grid-cols-[16px_1fr_auto_auto] sm:grid-cols-[20px_1fr_auto_auto] gap-2 sm:gap-3 items-center py-1.5 border-b border-hairline last:border-b-0"
                  >
                    <span className="font-mono text-[10px] text-dim tabular">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[12px] text-white truncate" title={s.heading_path ?? undefined}>
                      {s.filename}
                    </span>
                    <span className="text-[11px] text-muted font-mono">
                      {s.page_number != null ? `p.${s.page_number}` : "—"}
                    </span>
                    <span
                      className={cx(
                        "font-mono text-[11px] tabular font-semibold",
                        s.score != null && s.score > 0.85
                          ? "text-emerald-300"
                          : s.score != null && s.score > 0.5
                          ? "text-gold"
                          : "text-muted"
                      )}
                    >
                      {s.score != null ? `${Math.round(s.score * 100)}%` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ChatDetail ──────────────────────────────────────────────────────────────

function ChatDetail({
  conv,
  detail,
  loading,
  error,
  onBack,
}: {
  conv: ConversationSummary;
  detail: ConversationDetail | null;
  loading: boolean;
  error: string | null;
  onBack?: () => void;
}) {
  const name = userLabel(conv);
  return (
    <div className="flex flex-col min-w-0 h-full">
      {onBack && (
        <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-hairline shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted hover:text-white transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
            Conversaciones
          </button>
        </div>
      )}

      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-hairline flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Avatar name={name} size={36} />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-white tracking-tight truncate">
              {name}
            </div>
            <div className="text-[11px] text-muted mt-0.5 font-mono truncate">
              {shortId(conv.id)} · iniciada {timeAgo(conv.created_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted font-mono uppercase tracking-wider shrink-0">
          <span className="tabular hidden sm:block">{conv.message_count} msgs</span>
          {conv.has_dislike && (
            <span className="inline-flex items-center gap-1.5 text-red-300">
              <span className="w-1.5 h-1.5 bg-red-400 inline-block" />
              <span className="hidden sm:inline">dislike</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {loading ? (
          <div className="py-12 text-center font-mono text-[11px] text-dim uppercase tracking-wider animate-pulse">
            Cargando conversación…
          </div>
        ) : error ? (
          <div className="py-12 text-center text-[12px] text-red-300">{error}</div>
        ) : detail && detail.messages.length > 0 ? (
          detail.messages.map((m, i) => (
            <MessageBubble key={m.id} m={m} index={i + 1} />
          ))
        ) : (
          <div className="py-12 text-center font-mono text-[11px] text-dim uppercase tracking-wider">
            Sesión sin mensajes
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6 py-3 border-t border-hairline shrink-0">
        <div className="text-[10px] uppercase tracking-[0.18em] text-dim flex items-center gap-2">
          <Eye size={11} strokeWidth={1.5} /> Vista de solo lectura · monitor en vivo
        </div>
      </div>
    </div>
  );
}

// ─── ConversationsPage ───────────────────────────────────────────────────────

export default function ConversationsPage({ token }: { token: string }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const refresh = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const data = await listConversations(token, 50);
      setConversations(data);
      setSelectedId((current) => {
        if (current && data.some((d) => d.id === current)) return current;
        return data[0]?.id ?? null;
      });
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Error al cargar.");
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setDetailError(null);
    getConversation(token, selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled)
          setDetailError(e instanceof Error ? e.message : "Error al cargar.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, token]);

  const filtered = useMemo(() => {
    if (!q.trim()) return conversations;
    const needle = q.toLowerCase();
    return conversations.filter(
      (c) =>
        userLabel(c).toLowerCase().includes(needle) ||
        (c.last_query ?? "").toLowerCase().includes(needle) ||
        c.id.toLowerCase().includes(needle)
    );
  }, [conversations, q]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const total = conversations.length;
  const totalMessages = conversations.reduce(
    (acc, c) => acc + (c.message_count || 0),
    0
  );

  return (
    <div>
      <PageHeader
        section="Monitor · 03"
        title="Conversaciones"
        sub={
          <span>
            {loadingList
              ? "Cargando…"
              : `${total} sesiones registradas · ${totalMessages} mensajes totales`}
          </span>
        }
        right={
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={() => refresh()}
            disabled={loadingList}
          >
            {loadingList ? "Actualizando…" : "Actualizar"}
          </Button>
        }
      />

      <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] min-h-[560px] sm:min-h-[640px] border-b border-hairline">
        {/* Lista de sesiones */}
        <div
          className={cx(
            "border-b md:border-b-0 md:border-r border-hairline flex flex-col",
            mobileView === "detail" ? "hidden md:flex" : "flex"
          )}
        >
          <div className="p-3 sm:p-4 border-b border-hairline shrink-0">
            <Input
              icon={Filter}
              placeholder="Buscar sesión..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin">
            {loadingList ? (
              <div className="py-10 text-center font-mono text-[11px] text-dim uppercase tracking-wider animate-pulse">
                Cargando…
              </div>
            ) : listError ? (
              <div className="py-10 text-center text-[12px] text-red-300">
                {listError}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="Sin resultados"
                body={
                  conversations.length === 0
                    ? "Aún no hay conversaciones registradas"
                    : "Prueba con otro término"
                }
              />
            ) : (
              filtered.map((c, i) => {
                const isActive = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedId(c.id);
                      setMobileView("detail");
                    }}
                    className={cx(
                      "w-full text-left px-3 sm:px-4 py-3 grid grid-cols-[14px_32px_1fr] sm:grid-cols-[14px_36px_1fr] gap-2 sm:gap-3 items-start border-b border-hairline transition-colors",
                      isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                    )}
                  >
                    <span
                      className={cx(
                        "font-mono text-[10px] tabular pt-1",
                        isActive ? "text-gold" : "text-dim"
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Avatar name={userLabel(c)} size={32} />
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] font-medium text-white truncate">
                          {userLabel(c)}
                        </div>
                        <div className="text-[10px] text-dim shrink-0 font-mono tabular">
                          {timeAgo(c.last_active_at)}
                        </div>
                      </div>
                      <div className="text-[12px] text-muted line-clamp-1 mt-1 leading-snug">
                        {c.last_query ?? "Sin mensajes del usuario"}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-dim font-mono">
                          {shortId(c.id)}
                        </span>
                        <span className="inline-flex items-center gap-2 text-[10px] text-muted font-mono tabular">
                          {c.has_dislike && (
                            <span
                              className="w-1.5 h-1.5 bg-red-400 inline-block"
                              aria-hidden
                            />
                          )}
                          {String(c.message_count).padStart(2, "0")} msg
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detalle */}
        {selected ? (
          <div
            className={cx(
              mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"
            )}
          >
            <ChatDetail
              conv={selected}
              detail={detail}
              loading={loadingDetail}
              error={detailError}
              onBack={() => setMobileView("list")}
            />
          </div>
        ) : (
          <div
            className={cx(
              "grid place-items-center",
              mobileView === "list" ? "hidden md:grid" : "grid"
            )}
          >
            <EmptyState
              icon={Filter}
              title={conversations.length === 0 ? "Sin conversaciones" : "Selecciona una conversación"}
              body={
                conversations.length === 0
                  ? "Aún no hay sesiones registradas en la base de datos."
                  : "Elige una sesión de la lista para ver mensajes y fuentes recuperadas."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
