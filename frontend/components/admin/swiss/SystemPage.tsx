"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, RefreshCw } from "lucide-react";
import { Button, PageHeader, SectionHeader, cx, useToast } from "./ui";
import { getSystemLogs } from "@/lib/api";
import type { LogEntry } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceStatus = "up" | "warn" | "down" | "loading";

interface ServiceInfo {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  status: ServiceStatus;
}

// ─── Static service definitions ──────────────────────────────────────────────

const SERVICE_DEFS: Omit<ServiceInfo, "status">[] = [
  { id: "fastapi",    name: "FastAPI",     primary: "API REST",      secondary: "Endpoints · /api/v1/*" },
  { id: "embeddings", name: "Embeddings",  primary: "BAAI/bge-m3",   secondary: "1024 dims · multilingüe" },
  { id: "supabase",   name: "Supabase",    primary: "PostgreSQL",    secondary: "pgvector · RLS activo" },
  { id: "ollama",     name: "Ollama LLM",  primary: "qwen2.5:14b",   secondary: "Q4_K_M · ~9 GB VRAM" },
];

const LOADING_SERVICES: ServiceInfo[] = SERVICE_DEFS.map((d) => ({
  ...d,
  status: "loading",
}));

// ─── Status styles ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ServiceStatus, { dot: string; label: string; cls: string; bar: string; health: number }> = {
  up:      { dot: "bg-emerald-400",         label: "Operativo",   cls: "text-emerald-300", bar: "bg-emerald-400", health: 1.0 },
  warn:    { dot: "bg-amber-400",            label: "Degradado",   cls: "text-amber-300",   bar: "bg-amber-400",   health: 0.7 },
  down:    { dot: "bg-red-400",              label: "Inactivo",    cls: "text-red-300",     bar: "bg-red-400",     health: 0.0 },
  loading: { dot: "bg-white/30 animate-pulse", label: "Verificando", cls: "text-dim",       bar: "bg-white/20",   health: 0.0 },
};

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ svc, index }: { svc: ServiceInfo; index: number }) {
  const t = STATUS_STYLES[svc.status];
  return (
    <div className="p-4 sm:p-6 flex flex-col">
      <div className="flex items-start justify-between">
        <span className="font-mono text-[10px] text-dim tabular">
          {String(index).padStart(2, "0")}
        </span>
        <span className={cx("inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold", t.cls)}>
          <span className={cx("w-1.5 h-1.5 inline-block", t.dot)} />
          {t.label}
        </span>
      </div>
      <div className="mt-3 sm:mt-5">
        <h3 className="text-[14px] sm:text-[15px] font-semibold text-white tracking-tight">
          {svc.name}
        </h3>
      </div>
      <div className="mt-4 sm:mt-auto sm:pt-8">
        <div className="display text-[22px] sm:text-[28px] font-bold text-white leading-none tabular">
          {svc.primary}
        </div>
        <div className="text-[11px] text-muted mt-1.5 sm:mt-2 font-mono">{svc.secondary}</div>
        <div className="mt-3 sm:mt-4 h-px bg-hairline relative overflow-hidden">
          <div
            className={cx("absolute inset-y-0 left-0 transition-all duration-700", t.bar)}
            style={{ width: `${Math.round(t.health * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── GPU Card ─────────────────────────────────────────────────────────────────

function GpuCard() {
  const used = 9.1, total = 16;
  const pct = (used / total) * 100;
  const barCls = pct < 70 ? "bg-emerald-400" : pct < 90 ? "bg-amber-400" : "bg-red-400";

  return (
    <div className="p-5 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 sm:gap-6">
        <div>
          <div className="eyebrow text-dim">Acelerador · 05</div>
          <h2 className="display text-[26px] sm:text-[34px] font-bold text-white mt-2 tracking-tight">
            NVIDIA Tesla V100
          </h2>
          <div className="flex items-center gap-3 text-[11px] mt-2 font-mono uppercase tracking-wider flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="w-1.5 h-1.5 bg-emerald-400 inline-block" /> En línea
            </span>
            <span className="text-dim">·</span>
            <span className="text-muted tabular">uptime 18d 04h 22m</span>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-4 sm:gap-8">
          {[
            { label: "Modelo",      value: "qwen2.5:14b", hint: "Q4_K_M · 8.9 GB" },
            { label: "Temperatura", value: "62°C",         hint: "óptima" },
            { label: "Power",       value: "184 W",        hint: "de 250 W" },
          ].map((s) => (
            <div key={s.label}>
              <div className="eyebrow text-dim">{s.label}</div>
              <div className="text-[13px] sm:text-[15px] font-semibold text-white mt-2 tabular font-mono">{s.value}</div>
              <div className="text-[10px] mt-1 font-mono uppercase tracking-wider text-muted">{s.hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow text-dim">VRAM en uso</div>
          <div className="text-[13px] font-mono tabular">
            <span className="font-semibold text-white">{used.toFixed(1)} GB</span>
            <span className="text-dim"> / {total} GB · {Math.round(pct)}%</span>
          </div>
        </div>
        <div className="relative h-6 bg-paper border border-hairline">
          {[25, 50, 75].map((p) => (
            <div key={p} className="absolute top-0 bottom-0 w-px bg-hairline" style={{ left: `${p}%` }} />
          ))}
          <div className={cx("h-full transition-all duration-700", barCls)} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-5 text-[10px] text-dim font-mono tabular">
          <span>0</span>
          <span className="text-center">4</span>
          <span className="text-center">8</span>
          <span className="text-center">12</span>
          <span className="text-right">16 GB</span>
        </div>
      </div>
    </div>
  );
}

// ─── SystemPage ───────────────────────────────────────────────────────────────

export default function SystemPage({ token }: { token: string }) {
  const [services, setServices] = useState<ServiceInfo[]>(LOADING_SERVICES);
  const [secondsSince, setSecondsSince] = useState(0);
  const [checking, setChecking] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const { push } = useToast();

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await getSystemLogs(token, 20);
      setLogs(res.entries);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [token]);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    setSecondsSince(0);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/health`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) {
        const data = await res.json();
        const KEY_MAP: Record<string, string> = {
          fastapi: "fastapi",
          embeddings: "embeddings",
          supabase: "supabase",
          ollama: "ollama",
        };
        setServices(
          SERVICE_DEFS.map((def) => {
            const apiKey = KEY_MAP[def.id];
            const apiStatus = data[apiKey]?.status;
            return { ...def, status: apiStatus === "running" ? "up" : "down" };
          })
        );
      } else {
        setServices(SERVICE_DEFS.map((d) => ({ ...d, status: "down" })));
      }
    } catch {
      setServices(SERVICE_DEFS.map((d) => ({ ...d, status: "down" })));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 60000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    const t = setInterval(() => setSecondsSince((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const upCount = services.filter((s) => s.status === "up").length;
  const total = services.length;

  return (
    <div>
      <PageHeader
        section="Infraestructura · 04"
        title="Estado del Sistema"
        sub={
          <span className="font-mono">
            {checking
              ? "Verificando servicios…"
              : `Última verificación: hace ${secondsSince}s · ${upCount}/${total} servicios operativos`}
          </span>
        }
        right={
          <>
            <Button variant="outline" size="sm" icon={Bell}>
              Alertas
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                checkHealth();
                push({ type: "info", title: "Verificación lanzada", body: "Comprobando servicios…" });
              }}
            >
              Verificar ahora
            </Button>
          </>
        }
      />

      {/* Service cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline border-b border-hairline">
        {services.map((s, i) => (
          <div key={s.id} className="bg-ink">
            <ServiceCard svc={s} index={i + 1} />
          </div>
        ))}
      </div>

      {/* GPU card */}
      <div className="border-b border-hairline">
        <GpuCard />
      </div>

      {/* System log */}
      <div className="py-10">
        <SectionHeader
          index={6}
          title="Bitácora del sistema"
          sub={
            logsLoading
              ? "Cargando…"
              : `${logs.length} eventos recientes`
          }
          right={
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchLogs()}
            >
              Refrescar
            </Button>
          }
        />
        {logsLoading ? (
          <div className="py-10 text-center font-mono text-[11px] text-dim uppercase tracking-wider animate-pulse">
            Cargando bitácora…
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center font-mono text-[11px] text-dim uppercase tracking-wider">
            Sin eventos registrados
          </div>
        ) : (
          <ul className="mt-4">
            {logs.map((e, i) => {
              const date = e.ts ? new Date(e.ts) : null;
              const timeLabel = date
                ? date.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : "—";
              const dayLabel = date
                ? date.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" })
                : "";
              return (
                <li
                  key={i}
                  className="grid grid-cols-[16px_auto_1fr] sm:grid-cols-[20px_80px_60px_1fr] gap-2 sm:gap-4 items-center px-2 py-3 border-b border-hairline hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-mono text-[10px] text-dim tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[11px] text-muted tabular hidden sm:block">
                    <span className="text-dim">{dayLabel}</span> {timeLabel}
                  </span>
                  <span
                    className={cx(
                      "font-mono text-[10px] font-semibold uppercase tracking-wider",
                      e.level === "info"
                        ? "text-blue-300"
                        : e.level === "warn"
                        ? "text-amber-300"
                        : "text-red-300"
                    )}
                  >
                    {e.level}
                  </span>
                  <span className="text-[12px] sm:text-[13px] text-white">{e.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
