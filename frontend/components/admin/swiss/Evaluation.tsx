"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Download,
  FileBarChart2,
  Loader2,
  PlayCircle,
  XCircle,
} from "lucide-react";
import {
  Button,
  PageHeader,
  SectionHeader,
  cx,
  useToast,
} from "./ui";
import {
  createEvaluationSocket,
  downloadEvaluationReport,
  listDocuments,
  startEvaluation,
} from "@/lib/api";
import type { Document, EvalProgressEvent, EvalSample, EvaluationStatus, RagasMetrics } from "@/types";

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface EvalState {
  taskId: string | null;
  status: EvaluationStatus;
  progress: number;
  stepMessage: string;
  currentStep: string;
  metrics: RagasMetrics | null;
  samples: EvalSample[];
}

const INITIAL_STATE: EvalState = {
  taskId: null,
  status: "pending",
  progress: 0,
  stepMessage: "",
  currentStep: "",
  metrics: null,
  samples: [],
};

const STEPS = [
  { key: "fetch_chunks",    label: "Cargando chunks" },
  { key: "generate_qa",     label: "Generando preguntas" },
  { key: "run_rag",         label: "Ejecutando pipeline RAG" },
  { key: "evaluate",        label: "Calculando métricas RAGAS" },
  { key: "generate_report", label: "Generando reporte PDF" },
];

const METRIC_CONFIG = [
  { key: "faithfulness",      label: "Faithfulness",       desc: "Fidelidad al contexto", color: "#10B981" },
  { key: "answer_relevancy",  label: "Answer Relevancy",   desc: "Relevancia de la respuesta", color: "#3B82F6" },
  { key: "context_precision", label: "Context Precision",  desc: "Precisión del retrieval", color: "#F5A623" },
  { key: "context_recall",    label: "Context Recall",     desc: "Cobertura del retrieval", color: "#8B5CF6" },
] as const;

// ── Subcomponentes ────────────────────────────────────────────────────────────

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-3 h-1 w-full bg-white/8">
      <div
        className="h-full transition-all duration-700"
        style={{ width: `${Math.round(value * 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function MetricCard({
  label,
  desc,
  value,
  color,
}: {
  label: string;
  desc: string;
  value: number;
  color: string;
}) {
  const pct = Math.round(value * 100);
  const quality = pct >= 80 ? "text-emerald-300" : pct >= 60 ? "text-amber-300" : "text-red-300";
  return (
    <div className="border border-hairline p-5 flex flex-col">
      <div className="eyebrow text-dim mb-1">{desc}</div>
      <div className="text-white text-[13px] font-medium mb-3">{label}</div>
      <div className={cx("font-mono text-[32px] font-bold leading-none tabular", quality)}>
        {pct}
        <span className="text-[18px] text-muted ml-0.5">%</span>
      </div>
      <ScoreBar value={value} color={color} />
    </div>
  );
}

function OverallCard({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const quality = pct >= 80 ? "text-emerald-300" : pct >= 60 ? "text-amber-300" : "text-red-300";
  return (
    <div className="border border-gold/40 p-5 flex flex-col bg-gold/5">
      <div className="eyebrow text-gold mb-1">Score compuesto</div>
      <div className="text-white text-[13px] font-medium mb-3">Evaluación Global</div>
      <div className={cx("font-mono text-[40px] font-bold leading-none tabular", quality)}>
        {pct}
        <span className="text-[20px] text-muted ml-0.5">%</span>
      </div>
      <div className="mt-3 h-1 w-full bg-white/8">
        <div
          className="h-full bg-gold transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 text-[11px] text-muted">
        {pct >= 80
          ? "Sistema con excelente calidad de respuestas"
          : pct >= 60
          ? "Sistema con buena calidad — hay margen de mejora"
          : "Sistema requiere ajustes en retrieval o generación"}
      </div>
    </div>
  );
}

function StepIndicator({
  steps,
  currentStep,
  status,
}: {
  steps: typeof STEPS;
  currentStep: string;
  status: EvaluationStatus;
}) {
  const currentIdx = steps.findIndex((s) => s.key === currentStep);
  return (
    <ul className="space-y-2 mt-4">
      {steps.map((s, i) => {
        const done = i < currentIdx || status === "done";
        const active = s.key === currentStep && status === "running";
        const hasError = status === "error" && s.key === currentStep;
        return (
          <li key={s.key} className="flex items-center gap-3">
            {hasError ? (
              <XCircle size={14} className="text-red-400 shrink-0" />
            ) : done ? (
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            ) : active ? (
              <Loader2 size={14} className="text-gold shrink-0 spin-slow" />
            ) : (
              <Circle size={14} className="text-dim shrink-0" />
            )}
            <span
              className={cx(
                "text-[12px]",
                done ? "text-white" : active ? "text-gold" : hasError ? "text-red-300" : "text-dim"
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SamplesTable({ samples }: { samples: EvalSample[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!samples.length) return null;

  const rows: React.ReactNode[] = [];
  samples.forEach((s, i) => {
    const isOpen = expanded === i;
    rows.push(
      <tr
        key={i}
        className="border-b border-hairline/50 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(isOpen ? null : i)}
      >
        <td className="py-2.5 pr-4 text-dim font-mono">{String(i + 1).padStart(2, "0")}</td>
        <td className="py-2.5 pr-4 text-white max-w-xs">
          <span className="line-clamp-1">{s.question}</span>
        </td>
        <td className={cx("py-2.5 pr-3 text-right font-mono tabular", scoreColor(s.faithfulness))}>
          {s.faithfulness.toFixed(2)}
        </td>
        <td className={cx("py-2.5 pr-3 text-right font-mono tabular", scoreColor(s.answer_relevancy))}>
          {s.answer_relevancy.toFixed(2)}
        </td>
        <td className={cx("py-2.5 pr-3 text-right font-mono tabular", scoreColor(s.context_precision))}>
          {s.context_precision.toFixed(2)}
        </td>
        <td className={cx("py-2.5 text-right font-mono tabular", scoreColor(s.context_recall))}>
          {s.context_recall.toFixed(2)}
        </td>
      </tr>
    );
    if (isOpen) {
      rows.push(
        <tr key={`d${i}`} className="bg-white/[0.02]">
          <td colSpan={6} className="px-2 py-3">
            <div className="space-y-2 text-[11px]">
              <div>
                <span className="text-dim font-mono uppercase tracking-wider text-[10px]">Pregunta — </span>
                <span className="text-white">{s.question}</span>
              </div>
              <div>
                <span className="text-dim font-mono uppercase tracking-wider text-[10px]">Respuesta RAG — </span>
                <span className="text-muted">{s.answer}</span>
              </div>
              <div>
                <span className="text-dim font-mono uppercase tracking-wider text-[10px]">Ground Truth — </span>
                <span className="text-muted">{s.ground_truth}</span>
              </div>
            </div>
          </td>
        </tr>
      );
    }
  });

  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-hairline">
            <th className="text-left py-2 pr-4 text-dim font-mono uppercase tracking-wider w-8">#</th>
            <th className="text-left py-2 pr-4 text-dim font-mono uppercase tracking-wider">Pregunta</th>
            <th className="text-right py-2 pr-3 text-dim font-mono uppercase tracking-wider w-20">Faith.</th>
            <th className="text-right py-2 pr-3 text-dim font-mono uppercase tracking-wider w-20">A.Rel.</th>
            <th className="text-right py-2 pr-3 text-dim font-mono uppercase tracking-wider w-20">C.Prec.</th>
            <th className="text-right py-2 text-dim font-mono uppercase tracking-wider w-20">C.Rec.</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function scoreColor(v: number): string {
  if (v >= 0.8) return "text-emerald-300";
  if (v >= 0.6) return "text-amber-300";
  return "text-red-300";
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EvaluationPage({ token }: { token: string }) {
  const { push: toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [useAllDocs, setUseAllDocs] = useState(true);
  const [nSamples, setNSamples] = useState(5);
  const [evalState, setEvalState] = useState<EvalState>(INITIAL_STATE);
  const [downloading, setDownloading] = useState(false);

  const isRunning = evalState.status === "running";
  const isDone = evalState.status === "done";
  const isError = evalState.status === "error";

  // Carga documentos listos
  useEffect(() => {
    listDocuments(token)
      .then((all) => setDocs(all.filter((d) => d.status === "ready")))
      .catch(() => {});
  }, [token]);

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleStart = async () => {
    setEvalState({ ...INITIAL_STATE, status: "running", stepMessage: "Iniciando evaluación..." });

    try {
      const docIds = useAllDocs ? null : selectedDocIds.length > 0 ? selectedDocIds : null;
      const { task_id } = await startEvaluation(token, docIds, nSamples);

      setEvalState((prev) => ({ ...prev, taskId: task_id }));

      // Abre WebSocket para recibir progreso en tiempo real
      const ws = createEvaluationSocket(task_id);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        const data: EvalProgressEvent = JSON.parse(evt.data);
        setEvalState((prev) => ({
          ...prev,
          progress: data.progress,
          stepMessage: data.message,
          currentStep: data.step,
          status: data.step === "done" ? "done" : data.step === "error" ? "error" : "running",
          metrics: data.metrics ?? prev.metrics,
          samples: data.samples ?? prev.samples,
        }));
      };

      ws.onerror = () => {
        setEvalState((prev) => ({
          ...prev,
          status: "error",
          stepMessage: "Error de conexión con el servidor.",
        }));
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar la evaluación.";
      toast({ type: "error", title: msg });
      setEvalState(INITIAL_STATE);
    }
  };

  const handleDownload = async () => {
    if (!evalState.taskId) return;
    setDownloading(true);
    try {
      await downloadEvaluationReport(token, evalState.taskId);
    } catch {
      toast({ type: "error", title: "Error al descargar el reporte." });
    } finally {
      setDownloading(false);
    }
  };

  const handleReset = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setEvalState(INITIAL_STATE);
  };

  return (
    <div className="pt-10 space-y-10 fade-in">
      <PageHeader
        section="07"
        title="Evaluación RAGAS"
        sub="Mide automáticamente la calidad del sistema RAG"
      />

      {/* ── 01 Configuración ────────────────────────────────────────────────── */}
      {!isRunning && !isDone && !isError && (
        <section>
          <SectionHeader index={1} title="Configuración" sub="Selecciona documentos y parámetros de evaluación" />

          <div className="border border-hairline p-6 space-y-6 mt-4">
            {/* Selector de documentos */}
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-dim font-mono">Documentos a evaluar</div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  checked={useAllDocs}
                  onChange={() => setUseAllDocs(true)}
                  className="accent-gold"
                />
                <span className="text-[13px] text-white">
                  Todos los documentos listos
                  <span className="ml-2 text-[11px] text-muted font-mono">({docs.length} disponibles)</span>
                </span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  checked={!useAllDocs}
                  onChange={() => setUseAllDocs(false)}
                  className="accent-gold"
                />
                <span className="text-[13px] text-white">Seleccionar documentos específicos</span>
              </label>

              {!useAllDocs && docs.length > 0 && (
                <div className="ml-6 mt-2 max-h-48 overflow-y-auto scroll-thin border border-hairline divide-y divide-hairline">
                  {docs.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-white/[0.04] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(d.id)}
                        onChange={() => toggleDoc(d.id)}
                        className="accent-gold"
                      />
                      <span className="text-[12px] text-white flex-1 truncate">{d.filename}</span>
                      <span className="text-[10px] text-dim font-mono shrink-0">
                        {d.chunk_count} chunks
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {!useAllDocs && docs.length === 0 && (
                <p className="ml-6 text-[12px] text-muted">No hay documentos listos para evaluar.</p>
              )}
            </div>

            {/* N samples */}
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-dim font-mono">
                Preguntas por documento
              </div>
              <div className="flex items-center gap-4">
                {[3, 5, 8, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNSamples(n)}
                    className={cx(
                      "w-10 h-10 border text-[13px] font-mono font-medium transition-colors",
                      nSamples === n
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-hairline text-muted hover:text-white hover:border-white/30"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-dim">
                Total estimado: ~{nSamples * Math.max(docs.length, 1)} preguntas · duración ~{Math.round(nSamples * Math.max(docs.length, 1) * 1.5)} min
              </p>
            </div>

            <Button
              variant="gold"
              icon={PlayCircle}
              onClick={handleStart}
              disabled={!useAllDocs && selectedDocIds.length === 0}
            >
              Iniciar Evaluación RAGAS
            </Button>
          </div>
        </section>
      )}

      {/* ── 02 Progreso ─────────────────────────────────────────────────────── */}
      {(isRunning || isError) && (
        <section>
          <SectionHeader
            index={2}
            title="Progreso"
            sub={isError ? "La evaluación encontró un error" : "Evaluación en curso — esto puede tomar varios minutos"}
            right={
              isError && (
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Reintentar
                </Button>
              )
            }
          />

          <div className="border border-hairline p-6 mt-4 space-y-5">
            {/* Barra de progreso */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-dim font-mono uppercase tracking-wider">
                  {evalState.stepMessage || "Procesando..."}
                </span>
                <span className={cx("font-mono text-[13px] font-semibold tabular", isError ? "text-red-300" : "text-gold")}>
                  {evalState.progress}%
                </span>
              </div>
              <div className="h-1 w-full bg-white/8">
                <div
                  className={cx(
                    "h-full transition-all duration-500",
                    isError ? "bg-red-500" : "bg-gold"
                  )}
                  style={{ width: `${evalState.progress}%` }}
                />
              </div>
            </div>

            {/* Pasos */}
            <StepIndicator
              steps={STEPS}
              currentStep={evalState.currentStep}
              status={evalState.status}
            />

            {isError && evalState.stepMessage && (
              <div className="text-[12px] text-red-300 border border-red-500/30 px-3 py-2 bg-red-500/5">
                {evalState.stepMessage}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 03 Métricas ─────────────────────────────────────────────────────── */}
      {isDone && evalState.metrics && (
        <section>
          <SectionHeader
            index={3}
            title="Resultados"
            sub={`${evalState.samples.length} preguntas evaluadas`}
            right={
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Nueva evaluación
              </Button>
            }
          />

          {/* Cards de métricas */}
          <div className="grid grid-cols-5 gap-3 mt-4">
            <div className="col-span-1">
              <OverallCard value={evalState.metrics.overall} />
            </div>
            {METRIC_CONFIG.map((m) => (
              <MetricCard
                key={m.key}
                label={m.label}
                desc={m.desc}
                value={evalState.metrics![m.key]}
                color={m.color}
              />
            ))}
          </div>

          {/* Tabla de muestras */}
          {evalState.samples.length > 0 && (
            <div className="mt-6">
              <div className="text-[11px] uppercase tracking-wider text-dim font-mono mb-3">
                Detalle por pregunta — click para expandir
              </div>
              <SamplesTable samples={evalState.samples} />
            </div>
          )}
        </section>
      )}

      {/* ── 04 Reporte ──────────────────────────────────────────────────────── */}
      {isDone && (
        <section>
          <SectionHeader index={4} title="Reporte" sub="Descarga el análisis completo en PDF" />
          <div className="border border-hairline p-6 mt-4 flex items-center gap-6">
            <FileBarChart2 size={32} className="text-gold shrink-0" strokeWidth={1.2} />
            <div className="flex-1 min-w-0">
              <div className="text-white text-[13px] font-medium">Reporte de Evaluación RAGAS</div>
              <div className="text-[11px] text-muted mt-0.5">
                Contiene métricas globales, tabla de muestras e interpretación automática de resultados.
              </div>
            </div>
            <Button
              variant="outline"
              icon={Download}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "Descargando..." : "Descargar PDF"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
