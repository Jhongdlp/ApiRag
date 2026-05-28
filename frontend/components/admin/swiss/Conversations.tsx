"use client";

import { useState } from "react";
import {
  ChevronLeft,
  Download,
  Eye,
  Filter,
  Minus,
  Plus,
  SearchX,
} from "lucide-react";
import { Avatar, Button, EmptyState, Input, PageHeader, cx } from "./ui";

// ─── Mock data ───────────────────────────────────────────────────────────────

const CONVERSATIONS = [
  { id: "S-9821", user: "María Granda",     last: "¿Cuántos créditos necesito para titularme en Sistemas?",      count: 14, time: "hace 5m",  active: true },
  { id: "S-9820", user: "Carlos Bermeo",    last: "Necesito el procedimiento para homologación de materias.",    count: 8,  time: "hace 12m" },
  { id: "S-9819", user: "Ana Lucía Vélez",  last: "¿Cuándo abren las inscripciones para el periodo 2026-B?",    count: 22, time: "hace 28m" },
  { id: "S-9818", user: "Diego Andrade",    last: "Cuáles son los requisitos para una beca por excelencia.",     count: 6,  time: "hace 1h" },
  { id: "S-9817", user: "Valentina Cruz",   last: "Cómo solicito mi certificado de matrícula?",                  count: 4,  time: "hace 2h" },
  { id: "S-9816", user: "Jorge Tinajero",   last: "Cuántas horas de práctica preprofesional debo cumplir?",     count: 11, time: "hace 3h" },
  { id: "S-9815", user: "Sofía Espinoza",   last: "Quisiera saber el cronograma de exámenes finales.",           count: 9,  time: "hace 5h" },
  { id: "S-9814", user: "Andrés Maldonado", last: "Cuál es la nota mínima para aprobar Cálculo II?",            count: 3,  time: "hace 7h" },
  { id: "S-9813", user: "Paula Salgado",    last: "Procedimiento para retiro de materia con devolución.",        count: 12, time: "ayer" },
];

interface Source {
  doc: string;
  page: number;
  score: number;
}

interface Message {
  role: "user" | "bot";
  t: string;
  text: string;
  sources?: Source[];
}

const MESSAGES: Message[] = [
  { role: "user", t: "09:42", text: "¿Cuántos créditos necesito para titularme en Ingeniería en Sistemas?" },
  {
    role: "bot", t: "09:42",
    text: "Según el Reglamento de Régimen Académico 2025 (Art. 27), para obtener el título de Ingeniero en Sistemas Computacionales se requiere completar **un total de 230 créditos**, distribuidos entre asignaturas obligatorias, optativas, prácticas preprofesionales (240 horas) y el trabajo de titulación.",
    sources: [
      { doc: "Reglamento de Régimen Académico 2025.pdf", page: 14, score: 0.91 },
      { doc: "Manual del Estudiante – Pregrado.pdf",     page: 22, score: 0.87 },
      { doc: "Normativa de Titulación v3.pdf",           page: 6,  score: 0.78 },
    ],
  },
  { role: "user", t: "09:44", text: "¿Y cuántas horas de prácticas preprofesionales?" },
  {
    role: "bot", t: "09:44",
    text: "Las prácticas preprofesionales en Ingeniería en Sistemas requieren **240 horas de servicio comunitario** más **240 horas de prácticas en la industria**, según el Art. 53 del Reglamento. Estas deben acreditarse antes de la matrícula del último nivel.",
    sources: [
      { doc: "Guía de Prácticas Pre-Profesionales.pdf",  page: 4,  score: 0.94 },
      { doc: "Reglamento de Régimen Académico 2025.pdf", page: 38, score: 0.82 },
    ],
  },
];

// ─── MessageBubble ───────────────────────────────────────────────────────────

function MessageBubble({ m, index }: { m: Message; index: number }) {
  const [open, setOpen] = useState(false);

  if (m.role === "user") {
    return (
      <div className="grid grid-cols-[20px_1fr] sm:grid-cols-[24px_1fr] gap-3 sm:gap-4 animate-fade-in">
        <span className="font-mono text-[10px] text-dim tabular pt-1.5">
          {String(index).padStart(2, "0")}
        </span>
        <div>
          <div className="flex items-baseline gap-3 mb-1.5">
            <span className="eyebrow text-muted">Usuario</span>
            <span className="font-mono text-[10px] text-dim tabular">{m.t}</span>
          </div>
          <div className="text-[14px] text-white leading-relaxed">{m.text}</div>
        </div>
      </div>
    );
  }

  const rendered = m.text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  return (
    <div className="grid grid-cols-[20px_1fr] sm:grid-cols-[24px_1fr] gap-3 sm:gap-4 animate-fade-in">
      <span className="font-mono text-[10px] text-gold tabular pt-1.5">
        {String(index).padStart(2, "0")}
      </span>
      <div className="border-l-2 border-gold pl-4 sm:pl-5 py-1">
        <div className="flex items-baseline gap-3 mb-1.5">
          <span className="eyebrow text-gold">Asistente</span>
          <span className="font-mono text-[10px] text-dim tabular">{m.t}</span>
        </div>
        <div
          className="text-[14px] text-white leading-relaxed"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
        {m.sources && (
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
                    key={i}
                    className="grid grid-cols-[16px_1fr_auto_auto] sm:grid-cols-[20px_1fr_auto_auto] gap-2 sm:gap-3 items-center py-1.5 border-b border-hairline last:border-b-0"
                  >
                    <span className="font-mono text-[10px] text-dim tabular">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[12px] text-white truncate">{s.doc}</span>
                    <span className="text-[11px] text-muted font-mono">
                      p.{s.page}
                    </span>
                    <span
                      className={cx(
                        "font-mono text-[11px] tabular font-semibold",
                        s.score > 0.85
                          ? "text-emerald-300"
                          : s.score > 0.75
                          ? "text-gold"
                          : "text-muted"
                      )}
                    >
                      {Math.round(s.score * 100)}%
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
  onBack,
}: {
  conv: (typeof CONVERSATIONS)[0];
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-col min-w-0 h-full">
      {/* Mobile back button */}
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
          <Avatar name={conv.user} size={36} />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-white tracking-tight truncate">
              {conv.user}
            </div>
            <div className="text-[11px] text-muted mt-0.5 font-mono truncate">
              {conv.id} · iniciada {conv.time}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted font-mono uppercase tracking-wider shrink-0">
          <span className="tabular hidden sm:block">{conv.count} msgs</span>
          {conv.active && (
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="w-1.5 h-1.5 bg-emerald-400 inline-block" />
              <span className="hidden sm:inline">activa</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {MESSAGES.map((m, i) => (
          <MessageBubble key={i} m={m} index={i + 1} />
        ))}
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

export default function ConversationsPage() {
  const [selected, setSelected] = useState(CONVERSATIONS[0]);
  const [q, setQ] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const filtered = CONVERSATIONS.filter(
    (c) =>
      q === "" ||
      c.user.toLowerCase().includes(q.toLowerCase()) ||
      c.last.toLowerCase().includes(q.toLowerCase())
  );

  const handleSelect = (c: (typeof CONVERSATIONS)[0]) => {
    setSelected(c);
    setMobileView("detail");
  };

  return (
    <div>
      <PageHeader
        section="Monitor · 03"
        title="Conversaciones"
        sub={
          <span>
            {CONVERSATIONS.length} sesiones registradas · 1,284 mensajes en 24h
          </span>
        }
        right={
          <>
            <Button variant="outline" size="sm" icon={Filter}>
              Filtros
            </Button>
            <Button variant="outline" size="sm" icon={Download}>
              Exportar
            </Button>
          </>
        }
      />

      {/* Two-panel layout */}
      <div className="flex flex-col md:grid md:grid-cols-[300px_1fr] min-h-[560px] sm:min-h-[640px] border-b border-hairline">
        {/* Session list */}
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
            {filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="Sin resultados"
                body="Prueba con otro término"
              />
            ) : (
              filtered.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={cx(
                    "w-full text-left px-3 sm:px-4 py-3 grid grid-cols-[14px_32px_1fr] sm:grid-cols-[14px_36px_1fr] gap-2 sm:gap-3 items-start border-b border-hairline transition-colors",
                    selected?.id === c.id
                      ? "bg-white/[0.04]"
                      : "hover:bg-white/[0.02]"
                  )}
                >
                  <span
                    className={cx(
                      "font-mono text-[10px] tabular pt-1",
                      selected?.id === c.id ? "text-gold" : "text-dim"
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Avatar name={c.user} size={32} />
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[13px] font-medium text-white truncate">
                        {c.user}
                      </div>
                      <div className="text-[10px] text-dim shrink-0 font-mono tabular">
                        {c.time}
                      </div>
                    </div>
                    <div className="text-[12px] text-muted line-clamp-1 mt-1 leading-snug">
                      {c.last}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-dim font-mono">{c.id}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted font-mono tabular">
                        {String(c.count).padStart(2, "0")} msg
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected ? (
          <div
            className={cx(
              mobileView === "list" ? "hidden md:flex md:flex-col" : "flex flex-col"
            )}
          >
            <ChatDetail
              conv={selected}
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
              title="Selecciona una conversación"
              body="Elige una sesión de la lista para ver mensajes y fuentes recuperadas."
            />
          </div>
        )}
      </div>
    </div>
  );
}
