"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, SectionHeader, Trend, cx } from "./ui";
import { getAnalytics, getFeedbackStats } from "@/lib/api";
import type {
  AnalyticsStats,
  CategorySlice,
  DislikedMessage,
  FeedbackStats,
  SeriesPoint,
  TopDoc,
} from "@/types";

type Range = "7d" | "30d" | "90d";

// ─── Range Tabs ──────────────────────────────────────────────────────────────

function RangeTabs({
  value,
  onChange,
}: {
  value: Range;
  onChange: (v: Range) => void;
}) {
  const opts: Range[] = ["7d", "30d", "90d"];
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
  if (!data.length) {
    return <div style={{ height: 28 }} className="w-full" />;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * 100;
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

function LineChart({ data, range }: { data: SeriesPoint[]; range: Range }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = 280, PL = 44, PR = 12, PT = 16, PB = 28;

  if (!data.length) {
    return (
      <div className="pt-10 pb-10 text-center font-mono text-[11px] text-dim uppercase tracking-wider">
        Sin datos en este rango
      </div>
    );
  }

  const xMax = Math.max(data.length - 1, 1);
  const yMaxQ = Math.max(...data.map((d) => d.queries), 1) * 1.1;
  const yMaxI = Math.max(...data.map((d) => d.ingestas), 1) * 1.3;
  const xs = (i: number) => PL + (i / xMax) * (W - PL - PR);
  const yqs = (v: number) => H - PB - (v / yMaxQ) * (H - PT - PB);
  const yis = (v: number) => H - PB - (v / yMaxI) * (H - PT - PB);
  const qPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${yqs(d.queries)}`)
    .join(" ");
  const iPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${yis(d.ingestas)}`)
    .join(" ");

  // Etiquetas de eje X: ~6 puntos espaciados
  const labelEvery = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data
    .map((_, i) => i)
    .filter((i) => i % labelEvery === 0 || i === data.length - 1);

  return (
    <div className="pt-10 pb-2">
      <SectionHeader
        index={4}
        title="Actividad del sistema"
        sub={`Queries e ingestas · ${range === "7d" ? "7 días" : range === "30d" ? "30 días" : "90 días"}`}
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

          {xLabels.map((i) => {
            const d = new Date(data[i].date);
            return (
              <text
                key={i} x={xs(i)} y={H - 8} fontSize="10" fill="#54545C"
                textAnchor="middle" fontFamily="JetBrains Mono, monospace"
              >
                {`${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`}
              </text>
            );
          })}

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
            <div className="font-semibold">{data[hover].date}</div>
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

function TopDocs({ docs, range }: { docs: TopDoc[]; range: Range }) {
  const max = Math.max(...docs.map((d) => d.hits), 1);
  return (
    <div className="py-10 lg:pr-10">
      <SectionHeader
        index={5}
        title="Documentos más consultados"
        sub={`Últimos ${range === "7d" ? "7 días" : range === "30d" ? "30 días" : "90 días"}`}
      />
      {docs.length === 0 ? (
        <div className="py-12 text-center font-mono text-[11px] text-dim uppercase tracking-wider">
          Sin recuperaciones en este rango
        </div>
      ) : (
        <ol className="mt-4">
          {docs.map((d, i) => {
            const pct = (d.hits / max) * 100;
            return (
              <li
                key={d.doc_id}
                className="relative grid grid-cols-[24px_1fr_60px] gap-3 items-center py-3 border-b border-hairline"
              >
                <span className="font-mono text-[11px] text-dim tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-white truncate">{d.filename}</div>
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
      )}
    </div>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

function DonutChart({ slices }: { slices: CategorySlice[] }) {
  const total = slices.reduce((a, x) => a + x.value, 0);
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
      {total === 0 ? (
        <div className="py-12 text-center font-mono text-[11px] text-dim uppercase tracking-wider">
          Sin documentos categorizados
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-6 sm:gap-8">
          <div className="relative shrink-0">
            <svg width="176" height="176" className="-rotate-90">
              <circle
                cx={cxVal} cy={cyVal} r={r}
                fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}
              />
              {slices.map((c, i) => {
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
            {slices.map((c, i) => (
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
      )}
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

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-px bg-hairline border border-hairline">
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
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalytics(token, range);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar analítica");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sparkData = data?.series.map((d) => d.queries) ?? [];
  const latencySpark = data?.series.map((d) => d.queries > 0 ? (data.avg_latency_ms ?? 0) / 1000 : 0) ?? [];
  const breakdown = data?.ingest_breakdown ?? { done: 0, failed: 0, in_progress: 0 };
  const successRate = data?.ingest_success_rate ?? null;

  return (
    <div>
      <PageHeader
        section="Insights · 05"
        title="Analítica"
        sub={
          <span>
            {loading
              ? "Cargando…"
              : error
              ? error
              : `Tendencias de uso y rendimiento del sistema RAG · rango ${range}`}
          </span>
        }
        right={<RangeTabs value={range} onChange={setRange} />}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-hairline border-b border-hairline">
        <div className="bg-ink">
          <AnalyticsKpi
            index={1}
            label="Total queries"
            value={loading ? "—" : (data?.total_queries ?? 0).toLocaleString("es-EC")}
            sub={
              data?.queries_delta_pct != null
                ? <Trend value={data.queries_delta_pct} />
                : null
            }
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
              loading || data?.avg_latency_ms == null ? (
                "—"
              ) : (
                <>
                  {(data.avg_latency_ms / 1000).toFixed(2)}
                  <span className="text-muted text-[20px] font-medium ml-1">s</span>
                </>
              )
            }
            sub={
              data?.latency_delta_pct != null
                ? <Trend value={-data.latency_delta_pct} />
                : null
            }
            foot="qwen2.5:14b · hybrid retrieval"
          >
            <Sparkline data={latencySpark} color="#F5A623" />
          </AnalyticsKpi>
        </div>
        <div className="bg-ink">
          <AnalyticsKpi
            index={3}
            label="Tasa de éxito de ingesta"
            value={
              loading || successRate == null ? (
                "—"
              ) : (
                <>
                  {successRate.toFixed(1)}
                  <span className="text-muted text-[20px] font-medium ml-1">%</span>
                </>
              )
            }
            foot={`${breakdown.done} done · ${breakdown.failed} failed · ${breakdown.in_progress} en curso`}
          >
            <div className="relative h-1 bg-hairline">
              <div
                className="absolute inset-y-0 left-0 bg-emerald-400"
                style={{ width: `${successRate ?? 0}%` }}
              />
            </div>
          </AnalyticsKpi>
        </div>
      </div>

      {/* Line chart */}
      <div className="border-b border-hairline">
        {loading ? (
          <div className="py-20 text-center font-mono text-[11px] text-dim uppercase tracking-wider animate-pulse">
            Cargando serie temporal…
          </div>
        ) : (
          <LineChart data={data?.series ?? []} range={range} />
        )}
      </div>

      {/* Bottom: top docs + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {loading ? (
          <div className="lg:col-span-2 py-20 text-center font-mono text-[11px] text-dim uppercase tracking-wider animate-pulse">
            Cargando documentos y categorías…
          </div>
        ) : (
          <>
            <TopDocs docs={data?.top_documents ?? []} range={range} />
            <DonutChart slices={data?.category_distribution ?? []} />
          </>
        )}
      </div>

      {/* Feedback section */}
      <FeedbackSection token={token} />
    </div>
  );
}
