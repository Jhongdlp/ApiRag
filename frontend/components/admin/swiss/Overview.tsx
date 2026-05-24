"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button, PageHeader, SectionHeader, StatusBadge, Trend, useCountUp, cx } from "./ui";
import { getOverviewStats } from "@/lib/api";
import type { OverviewStats, DayActivity, RecentDoc } from "@/types";

// ─── Utilities ───────────────────────────────────────────────────────────────

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function formatVectorStorage(chunks: number): string {
  const bytes = chunks * 1024 * 4;
  if (bytes < 1e6) return `${Math.round(bytes / 1e3)} KB`;
  if (bytes < 1e9) return `${Math.round(bytes / 1e6)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cx("animate-pulse bg-white/[0.06] rounded-sm", className)} />;
}

function KpiSkeleton() {
  return (
    <div className="py-6 flex flex-col h-full">
      <div className="flex items-baseline justify-between mb-6">
        <Sk className="w-6 h-3" />
      </div>
      <Sk className="w-28 h-12 mt-1" />
      <div className="mt-auto pt-6 space-y-2">
        <Sk className="w-32 h-3.5" />
        <Sk className="w-20 h-2.5" />
      </div>
    </div>
  );
}

// ─── KPI Cell ────────────────────────────────────────────────────────────────

function KpiCell({
  index, label, value, hint, trend,
}: {
  index: number;
  label: string;
  value: number;
  hint: string;
  trend?: number | null;
}) {
  const v = useCountUp(value);
  return (
    <div className="py-6 flex flex-col h-full">
      <div className="flex items-baseline justify-between mb-6">
        <span className="font-mono text-[10px] text-dim tabular">
          {String(index).padStart(2, "0")}
        </span>
        {trend != null && <Trend value={trend} />}
      </div>
      <div className="display text-[56px] font-bold text-white leading-none tabular">
        {v.toLocaleString("es-EC")}
      </div>
      <div className="mt-auto pt-6">
        <div className="text-[13px] font-medium text-white">{label}</div>
        <div className="text-[11px] text-muted mt-0.5">{hint}</div>
      </div>
    </div>
  );
}

// ─── Activity Chart ──────────────────────────────────────────────────────────

function ActivityChart({ data }: { data: DayActivity[] }) {
  const max = Math.max(...data.map((d) => d.queries), 1);
  const maxI = Math.max(...data.map((d) => d.ingestas), 1);
  return (
    <div className="lg:col-span-3 py-6 pr-6">
      <SectionHeader
        index={5}
        title="Actividad"
        sub="Últimos 7 días"
        right={
          <div className="flex items-center gap-4 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-white inline-block" /> Queries
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-gold inline-block" /> Ingestas
            </span>
          </div>
        }
      />
      <div className="relative mt-6 h-[200px]">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-hairline relative">
              <span className="absolute -top-2 left-0 font-mono text-[10px] text-dim tabular">
                {Math.round(max - (max / 3) * i).toLocaleString("es-EC")}
              </span>
            </div>
          ))}
        </div>
        {/* Bars */}
        <div className="absolute inset-0 pl-12 pr-0 pt-2 pb-6 flex items-end justify-between gap-2">
          {data.map((d, i) => {
            const h = (d.queries / max) * 100;
            const ih = (d.ingestas / maxI) * 100;
            return (
              <div
                key={i}
                className="flex-1 h-full flex items-end gap-1 cursor-default group"
                title={`${d.date}: ${d.queries} queries, ${d.ingestas} ingestas`}
              >
                <div className="flex-1 h-full flex items-end">
                  <div
                    className="w-full bg-white group-hover:bg-gold transition-colors duration-200"
                    style={{ height: `${Math.max(h, d.queries > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <div className="w-1.5 h-full flex items-end">
                  <div
                    className="w-full bg-gold/70"
                    style={{ height: `${Math.max(ih, d.ingestas > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* Day labels */}
        <div className="absolute bottom-0 left-12 right-0 flex justify-between gap-2">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex-1 text-center font-mono text-[10px] text-dim font-medium"
            >
              {d.day_label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityChartSkeleton() {
  return (
    <div className="lg:col-span-3 py-6 pr-6">
      <div className="flex items-end justify-between pb-3 border-b border-hairline">
        <Sk className="w-32 h-4" />
      </div>
      <div className="mt-6 h-[200px] flex items-end gap-2 pl-12">
        {[55, 80, 45, 90, 70, 35, 60].map((h, i) => (
          <div key={i} className="flex-1 flex items-end gap-1 h-full">
            <div
              className="flex-1 animate-pulse bg-white/[0.06] rounded-sm"
              style={{ height: `${h}%` }}
            />
            <div className="w-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Ingestas ─────────────────────────────────────────────────────────

function RecentIngestas({ docs }: { docs: RecentDoc[] }) {
  return (
    <div className="lg:col-span-2 py-6 pl-6 border-l border-hairline">
      <SectionHeader index={6} title="Últimas ingestas" />
      <ul className="mt-4 space-y-1">
        {docs.map((d, i) => (
          <li
            key={d.id}
            className="grid grid-cols-[20px_1fr_auto] items-center gap-3 py-2.5 border-b border-hairline last:border-b-0 hover:bg-white/[0.02] transition-colors -mx-2 px-2"
          >
            <span className="font-mono text-[10px] text-dim tabular">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] text-white truncate font-medium">
                {d.filename}
              </div>
              <div className="text-[10px] text-muted font-mono tabular mt-0.5">
                {timeAgo(d.uploaded_at)}
              </div>
            </div>
            <StatusBadge status={d.status} />
          </li>
        ))}
        {docs.length === 0 && (
          <li className="py-8 text-center text-[12px] text-muted">
            Sin documentos aún
          </li>
        )}
      </ul>
    </div>
  );
}

function RecentIngestasSkeleton() {
  return (
    <div className="lg:col-span-2 py-6 pl-6 border-l border-hairline">
      <div className="flex items-end pb-3 border-b border-hairline gap-4">
        <Sk className="w-6 h-3" />
        <Sk className="w-28 h-4" />
      </div>
      <ul className="mt-4 space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="grid grid-cols-[20px_1fr_auto] items-center gap-3 py-2.5 border-b border-hairline last:border-b-0">
            <Sk className="w-4 h-2.5" />
            <div className="space-y-1.5">
              <Sk className="h-3.5 w-full" />
              <Sk className="h-2.5 w-16" />
            </div>
            <Sk className="w-14 h-4" />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

export default function Overview({
  token,
  onNav,
}: {
  token: string;
  onNav?: (page: "documents") => void;
}) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await getOverviewStats(token);
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar estadísticas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const kpis = stats
    ? [
        {
          label: "Documentos Listos",
          value: stats.documents_ready,
          hint: `de ${stats.documents_total} totales`,
        },
        {
          label: "Chunks Indexados",
          value: stats.chunks_total,
          hint: "embedding 1024d",
        },
        {
          label: "Sesiones de Chat Hoy",
          value: stats.sessions_today,
          hint: "sesiones únicas",
        },
        {
          label: "Queries Hoy",
          value: stats.queries_today,
          hint: "mensajes de usuario",
        },
      ]
    : null;

  const tertiary = stats
    ? [
        {
          k: "Tiempo medio de respuesta",
          v: stats.avg_latency_ms != null
            ? `${(stats.avg_latency_ms / 1000).toFixed(2)}s`
            : "—",
          s: stats.avg_latency_ms != null ? "promedio hoy" : "sin datos hoy",
        },
        {
          k: "Documentos procesados",
          v: `${stats.documents_ready}/${stats.documents_total}`,
          s: stats.documents_error > 0
            ? `${stats.documents_error} con error`
            : "sin errores",
        },
        {
          k: "Almacenamiento vectores",
          v: formatVectorStorage(stats.chunks_total),
          s: "estimado (1024d · float32)",
        },
      ]
    : null;

  const subText = stats
    ? `${stats.documents_ready} docs listos · ${stats.queries_today} queries hoy · ${stats.sessions_today} sesiones`
    : error
    ? "Error al cargar estadísticas"
    : "Cargando…";

  return (
    <div>
      <PageHeader
        section="Inicio · Resumen"
        title={
          <>
            Bienvenido,
            <br />
            <span className="text-muted">Admin.</span>
          </>
        }
        sub={<span>{subText}</span>}
        right={
          <>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchStats(true)}
              disabled={refreshing || loading}
              className={refreshing ? "opacity-60" : ""}
            >
              {refreshing ? "Actualizando…" : "Actualizar"}
            </Button>
            <Button
              variant="gold"
              size="sm"
              icon={Plus}
              onClick={() => onNav?.("documents")}
            >
              Importar PDF
            </Button>
          </>
        }
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-y border-hairline -mx-px">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-l border-hairline px-6">
                <KpiSkeleton />
              </div>
            ))
          : kpis?.map((k, i) => (
              <div key={i} className="border-l border-hairline px-6">
                <KpiCell index={i + 1} label={k.label} value={k.value} hint={k.hint} />
              </div>
            ))}
      </div>

      {/* Activity + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-5 border-b border-hairline">
        {loading || !stats ? (
          <>
            <ActivityChartSkeleton />
            <RecentIngestasSkeleton />
          </>
        ) : (
          <>
            <ActivityChart data={stats.activity_7d} />
            <RecentIngestas docs={stats.recent_documents} />
          </>
        )}
      </div>

      {/* Tertiary metrics strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-hairline">
        {loading || !tertiary
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cx("px-6 py-5", i > 0 && "border-l border-hairline")}>
                <Sk className="w-32 h-2.5 mb-3" />
                <Sk className="w-20 h-7" />
                <Sk className="w-36 h-2.5 mt-2" />
              </div>
            ))
          : tertiary.map((s, i) => (
              <div key={i} className={cx("px-6 py-5", i > 0 && "border-l border-hairline")}>
                <div className="eyebrow text-dim mb-3">{s.k}</div>
                <div className="display text-[28px] font-semibold text-white tabular">
                  {s.v}
                </div>
                <div className="text-[11px] text-muted mt-2">{s.s}</div>
              </div>
            ))}
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div className="mt-4 px-4 py-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          {error} —{" "}
          <button
            className="underline underline-offset-2 hover:text-red-200"
            onClick={() => fetchStats()}
          >
            reintentar
          </button>
        </div>
      )}
    </div>
  );
}
