"use client";

import { useState, useEffect } from "react";
import { PageHeader, SectionHeader, Trend, cx } from "./ui";
import { getFeedbackStats } from "@/lib/api";
import type { DislikedMessage, FeedbackStats } from "@/types";

// ─── Mock data ───────────────────────────────────────────────────────────────

const TOP_DOCS = [
  { name: "Reglamento de Régimen Académico 2025", hits: 482 },
  { name: "Manual del Estudiante – Pregrado",     hits: 318 },
  { name: "Normativa de Titulación v3",           hits: 241 },
  { name: "Calendario Académico 2026-A",          hits: 197 },
  { name: "Guía de Prácticas Pre-Profesionales",  hits: 164 },
  { name: "Estatuto Institucional UTI",           hits: 122 },
];

const CATEGORY_DIST = [
  { name: "Reglamentos", value: 42, color: "#3B82F6" },
  { name: "Manuales",    value: 28, color: "#F5A623" },
  { name: "Normativas",  value: 19, color: "#10B981" },
  { name: "Otros",       value: 11, color: "#8B5CF6" },
];

// 30 days of queries + ingestas
const LINE_SERIES = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  queries:  Math.round(700 + Math.sin(i / 2.4) * 220 + (Math.sin(i * 0.7) * 90) + (i / 29) * 480),
  ingestas: Math.max(0, Math.round(3 + Math.sin(i / 3) * 2.5)),
}));

// ─── Range Tabs ──────────────────────────────────────────────────────────────

function RangeTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const opts = ["7d", "30d", "90d"];
  return (
    <div className="inline-flex border border-hairline">
      {opts.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cx(
            "px-4 h-9 text-[11px] uppercase tracking-wider font-medium transition-colors border-l border-hairline first:border-l-0",
            value === o ? "bg-white text-black" : "text-muted hover:text-white"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ data, color = "#F5F5F7" }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / (max - min || 1)) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: 28 }}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Analytics KPI ───────────────────────────────────────────────────────────

function AnalyticsKpi({
  index,
  label,
  value,
  sub,
  foot,
  children,
}: {
  index: number;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  foot?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-4 sm:p-6 flex flex-col">
      <div className="flex items-baseline justify-between mb-4 sm:mb-6">
        <span className="font-mono text-[10px] text-dim tabular">
          {String(index).padStart(2, "0")}
        </span>
        {sub}
      </div>
      <div className="display text-[36px] sm:text-[44px] font-bold text-white leading-none tabular">
        {value}
      </div>
      <div className="mt-2 sm:mt-3 text-[13px] font-medium text-white">{label}</div>
      {foot && (
        <div className="text-[10px] text-muted mt-1 font-mono uppercase tracking-wider">
          {foot}
        </div>
      )}
      {children && <div className="mt-3 sm:mt-5">{children}</div>}
    </div>
  );
}

// ─── Line Chart ──────────────────────────────────────────────────────────────

function LineChart() {
  const data = LINE_SERIES;
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = 280, PL = 44, PR = 12, PT = 16, PB = 28;
  const xMax = data.length - 1;
  const yMaxQ = Math.max(...data.map((d) => d.queries)) * 1.1;
  const yMaxI = Math.max(...data.map((d) => d.ingestas)) * 1.3;
  const xs = (i: number) => PL + (i / xMax) * (W - PL - PR);
  const yqs = (v: number) => H - PB - (v / yMaxQ) * (H - PT - PB);
  const yis = (v: number) => H - PB - (v / yMaxI) * (H - PT - PB);
  const qPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${yqs(d.queries)}`)
    .join(" ");
  const iPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${yis(d.ingestas)}`)
    .join(" ");

  return (
    <div className="pt-10 pb-2">
      <SectionHeader
        index={4}
        title="Actividad del sistema"
        sub="Queries e ingestas · 30 días"
        right={
          <div className="flex items-center gap-4 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-px bg-white" /> Queries
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-px bg-gold border-dashed" /> Ingestas
            </span>
          </div>
        }
      />

      <div className="relative mt-6">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 280 }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const idx = Math.round(((px - PL) / (W - PL - PR)) * xMax);
            if (idx >= 0 && idx <= xMax) setHover(idx);
          }}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const y = PT + t * (H - PT - PB);
            return (
              <g key={i}>
                <line
                  x1={PL} x2={W - PR} y1={y} y2={y}
                  stroke="rgba(255,255,255,0.07)"
                />
                <text
                  x={PL - 8} y={y + 3} fontSize="10" fill="#54545C"
                  textAnchor="end" fontFamily="JetBrains Mono, monospace"
                >
                  {Math.round(yMaxQ * (1 - t)).toLocaleString("es-EC")}
                </text>
              </g>
            );
          })}

          {[0, 6, 12, 18, 24, 29].map((i) => (
            <text
              key={i} x={xs(i)} y={H - 8} fontSize="10" fill="#54545C"
              textAnchor="middle" fontFamily="JetBrains Mono, monospace"
            >
              D{30 - i}
            </text>
          ))}

          <path
            d={qPath} fill="none" stroke="#F5F5F7"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d={iPath} fill="none" stroke="#F5A623"
            strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round"
          />

          {hover !== null && (
            <g>
              <line
                x1={xs(hover)} x2={xs(hover)} y1={PT} y2={H - PB}
                stroke="#F5A623" strokeWidth="1" strokeDasharray="2 3"
              />
              <circle cx={xs(hover)} cy={yqs(data[hover].queries)} r="3" fill="#F5F5F7" />
              <circle cx={xs(hover)} cy={yis(data[hover].ingestas)} r="3" fill="#F5A623" />
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="absolute pointer-events-none px-3 py-2 bg-white text-black font-mono text-[10px] z-10"
            style={{
              left: `${(xs(hover) / W) * 100}%`,
              top: 8,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-semibold">DÍA {data[hover].day}</div>
            <div className="tabular mt-0.5">
              {data[hover].queries.toLocaleString("es-EC")} Q
            </div>
            <div className="tabular">{data[hover].ingestas} I</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Top Docs ────────────────────────────────────────────────────────────────

function TopDocs() {
  const max = Math.max(...TOP_DOCS.map((d) => d.hits));
  return (
    <div className="py-10 lg:pr-10">
      <SectionHeader
        index={5}
        title="Documentos más consultados"
        sub="Últimos 30 días"
      />
      <ol className="mt-4">
        {TOP_DOCS.map((d, i) => {
          const pct = (d.hits / max) * 100;
          return (
            <li
              key={i}
              className="relative grid grid-cols-[24px_1fr_60px] gap-3 items-center py-3 border-b border-hairline"
            >
              <span className="font-mono text-[11px] text-dim tabular">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] text-white truncate">{d.name}</div>
                <div className="relative mt-2 h-1 bg-hairline">
                  <div
                    className="absolute inset-y-0 left-0 bg-gold"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <span className="font-mono text-[13px] font-semibold text-white tabular text-right">
                {d.hits}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

function DonutChart() {
  const total = CATEGORY_DIST.reduce((a, x) => a + x.value, 0);
  const r = 70, cxVal = 88, cyVal = 88, sw = 14;
  const C = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="py-10 lg:pl-10 lg:border-l border-hairline border-t lg:border-t-0">
      <SectionHeader
        index={6}
        title="Distribución por categoría"
        sub={`${total} documentos`}
      />
      <div className="mt-6 flex flex-wrap items-center gap-6 sm:gap-8">
        <div className="relative shrink-0">
          <svg
            width="176"
            height="176"
            className="-rotate-90"
          >
            <circle
              cx={cxVal} cy={cyVal} r={r}
              fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}
            />
            {CATEGORY_DIST.map((c, i) => {
              const len = (c.value / total) * C;
              const dash = `${len - 2} ${C - len + 2}`;
              const el = (
                <circle
                  key={i}
                  cx={cxVal} cy={cyVal} r={r}
                  fill="none" stroke={c.color} strokeWidth={sw}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="display text-[28px] font-bold text-white tabular leading-none">
                {total}
              </div>
              <div className="eyebrow text-dim mt-1.5">Total</div>
            </div>
          </div>
        </div>

        <ul className="flex-1 space-y-px">
          {CATEGORY_DIST.map((c, i) => (
            <li
              key={i}
              className="grid grid-cols-[14px_1fr_auto_auto] gap-3 items-center py-2.5 border-b border-hairline text-[13px]"
            >
              <span className="w-2.5 h-2.5 inline-block" style={{ background: c.color }} />
              <span className="text-white">{c.name}</span>
              <span className="text-muted tabular text-[11px] font-mono">
                {Math.round((c.value / total) * 100)}%
              </span>
              <span className="text-white tabular font-semibold w-8 text-right">
                {c.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Feedback Section ────────────────────────────────────────────────────────

function FeedbackSection({ token }: { token: string }) {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getFeedbackStats(token)
      .then(setStats)
      .catch(() => setStats({ likes: 0, dislikes: 0, disliked_messages: [] }))
      .finally(() => setLoading(false));
  }, [token]);

  const total = (stats?.likes ?? 0) + (stats?.dislikes ?? 0);
  const satisfactionPct = total > 0 ? Math.round(((stats?.likes ?? 0) / total) * 100) : 0;

  return (
    <div className="pt-10 border-t border-hairline">
      <SectionHeader
        index={7}
        title="Feedback de respuestas"
        sub="Valoraciones de los estudiantes"
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-px bg-hairline border border-hairline">
        {/* Likes counter */}
        <div className="bg-ink p-4 sm:p-5">
          <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-2 sm:mb-3">
            01 · Respuestas útiles
          </div>
          <div className="flex items-end gap-3">
            <span className="display text-[36px] sm:text-[44px] font-bold text-emerald-300 leading-none tabular">
              {loading ? "—" : (stats?.likes ?? 0).toLocaleString("es-EC")}
            </span>
            <span className="text-emerald-400 text-xl mb-1">↑</span>
          </div>
          <div className="mt-2 text-[11px] text-muted font-mono uppercase tracking-wider">
            likes totales
          </div>
        </div>

        {/* Dislikes counter */}
        <div className="bg-ink p-4 sm:p-5">
          <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-2 sm:mb-3">
            02 · Respuestas no útiles
          </div>
          <div className="flex items-end gap-3">
            <span className="display text-[36px] sm:text-[44px] font-bold text-red-300 leading-none tabular">
              {loading ? "—" : (stats?.dislikes ?? 0).toLocaleString("es-EC")}
            </span>
            <span className="text-red-400 text-xl mb-1">↓</span>
          </div>
          <div className="mt-2 text-[11px] text-muted font-mono uppercase tracking-wider">
            dislikes totales
          </div>
        </div>

        {/* Satisfaction bar */}
        <div className="bg-ink p-4 sm:p-5">
          <div className="font-mono text-[10px] text-dim uppercase tracking-wider mb-2 sm:mb-3">
            03 · Satisfacción
          </div>
          <div className="display text-[36px] sm:text-[44px] font-bold text-white leading-none tabular">
            {loading ? "—" : `${satisfactionPct}`}
            <span className="text-muted text-[18px] sm:text-[20px] font-medium ml-1">%</span>
          </div>
          <div className="mt-3 relative h-1 bg-hairline">
            <div
              className="absolute inset-y-0 left-0 bg-emerald-400 transition-all duration-700"
              style={{ width: `${satisfactionPct}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-muted font-mono uppercase tracking-wider">
            {total} valoraciones totales
          </div>
        </div>
      </div>

      {/* Disliked messages report */}
      <div className="mt-8">
        <div className="flex items-baseline gap-4 pb-3 border-b border-hairline">
          <span className="font-mono text-[11px] text-dim tabular">08</span>
          <h3 className="text-[15px] font-semibold text-white tracking-tight">
            Reporte de respuestas no útiles
          </h3>
          <span className="text-xs text-muted">
            {loading ? "cargando…" : `${stats?.disliked_messages?.length ?? 0} registros`}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center font-mono text-[11px] text-dim uppercase tracking-wider animate-pulse">
            Cargando…
          </div>
        ) : !stats?.disliked_messages?.length ? (
          <div className="py-12 text-center font-mono text-[11px] text-dim uppercase tracking-wider">
            Sin respuestas valoradas negativamente
          </div>
        ) : (
          <ol className="mt-2">
            {stats.disliked_messages.map((msg: DislikedMessage, i) => {
              const isOpen = expanded === msg.message_id;
              const date = msg.created_at
                ? new Date(msg.created_at).toLocaleDateString("es-EC", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;
              return (
                <li key={msg.message_id} className="border-b border-hairline">
                  <button
                    className="w-full grid items-start gap-4 py-4 text-left hover:bg-white/[0.02] transition-colors"
                    style={{ gridTemplateColumns: "24px 1fr auto auto" }}
                    onClick={() => setExpanded(isOpen ? null : msg.message_id)}
                  >
                    <span className="font-mono text-[11px] text-dim tabular mt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      {msg.user_query && (
                        <div className="text-[11px] text-dim font-mono uppercase tracking-wider mb-1 truncate">
                          Consulta: {msg.user_query}
                        </div>
                      )}
                      <div className="text-[13px] text-white line-clamp-2 leading-snug">
                        {msg.answer}
                      </div>
                    </div>
                    {date && (
                      <span className="font-mono text-[10px] text-dim tabular whitespace-nowrap mt-0.5">
                        {date}
                      </span>
                    )}
                    <span
                      className="text-dim mt-0.5 transition-transform duration-200"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    >
                      ▾
                    </span>
                  </button>

                  {isOpen && (
                    <div className="pb-4 px-8 space-y-3">
                      {msg.user_query && (
                        <div className="border-l-2 border-dim pl-3">
                          <div className="text-[10px] text-dim font-mono uppercase tracking-wider mb-1">
                            Pregunta del estudiante
                          </div>
                          <p className="text-[13px] text-muted leading-relaxed">
                            {msg.user_query}
                          </p>
                        </div>
                      )}
                      <div className="border-l-2 border-red-500/40 pl-3">
                        <div className="text-[10px] text-dim font-mono uppercase tracking-wider mb-1">
                          Respuesta valorada negativamente
                        </div>
                        <p className="text-[13px] text-white leading-relaxed whitespace-pre-wrap">
                          {msg.answer}
                        </p>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

// ─── AnalyticsPage ───────────────────────────────────────────────────────────

export default function AnalyticsPage({ token }: { token: string }) {
  const [range, setRange] = useState("30d");
  const sparkData = LINE_SERIES.map((d) => d.queries);

  return (
    <div>
      <PageHeader
        section="Insights · 05"
        title="Analítica"
        sub={<span>Tendencias de uso y rendimiento del sistema RAG</span>}
        right={<RangeTabs value={range} onChange={setRange} />}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-hairline border-b border-hairline">
        <div className="bg-ink">
          <AnalyticsKpi
            index={1}
            label="Total queries"
            value={(28412).toLocaleString("es-EC")}
            sub={<Trend value={18.4} />}
            foot="vs. periodo anterior"
          >
            <Sparkline data={sparkData} color="#F5F5F7" />
          </AnalyticsKpi>
        </div>
        <div className="bg-ink">
          <AnalyticsKpi
            index={2}
            label="Tiempo medio de respuesta"
            value={
              <>
                1.82
                <span className="text-muted text-[20px] font-medium ml-1">s</span>
              </>
            }
            sub={<Trend value={-6.2} />}
            foot="qwen2.5:14b · top-k 6"
          >
            <Sparkline
              data={sparkData.map((v) => 2 + Math.sin(v / 100) * 0.4)}
              color="#F5A623"
            />
          </AnalyticsKpi>
        </div>
        <div className="bg-ink">
          <AnalyticsKpi
            index={3}
            label="Tasa de éxito de ingesta"
            value={
              <>
                96.4
                <span className="text-muted text-[20px] font-medium ml-1">%</span>
              </>
            }
            sub={<Trend value={2.1} />}
            foot="142 listos · 2 error · 4 cola"
          >
            <div className="relative h-1 bg-hairline">
              <div
                className="absolute inset-y-0 left-0 bg-emerald-400"
                style={{ width: "96.4%" }}
              />
            </div>
          </AnalyticsKpi>
        </div>
      </div>

      {/* Line chart */}
      <div className="border-b border-hairline">
        <LineChart />
      </div>

      {/* Bottom: top docs + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <TopDocs />
        <DonutChart />
      </div>

      {/* Feedback section */}
      <FeedbackSection token={token} />
    </div>
  );
}
