"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Loader2, FileSearch, FileCode, Scissors, Cpu, Database, Zap, AlertCircle } from "lucide-react";
import type { IngestionProgress as IngestionProgressType } from "@/types";

const STEPS = [
  { key: "extraction", label: "Extracción", icon: FileSearch, color: "from-blue-500 to-cyan-500" },
  { key: "conversion", label: "Conversión", icon: FileCode, color: "from-cyan-500 to-blue-500" },
  { key: "chunking", label: "Chunking", icon: Scissors, color: "from-violet-500 to-purple-500" },
  { key: "embedding", label: "Embeddings", icon: Cpu, color: "from-purple-500 to-pink-500" },
  { key: "indexing", label: "Indexación", icon: Database, color: "from-pink-500 to-rose-500" },
];

function stepIndex(step: string) {
  return STEPS.findIndex((s) => s.key === step);
}

export default function IngestionProgress({ progress }: { progress: IngestionProgressType }) {
  const current = stepIndex(progress.step);
  const isDone = progress.step === "done";
  const isError = progress.step === "error";
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        const next = Math.min(prev + Math.random() * 15, progress.progress);
        return next;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [progress.progress]);

  useEffect(() => {
    setDisplayProgress(progress.progress);
  }, [progress.progress]);

  const totalSteps = STEPS.length;
  const completedSteps = isDone ? totalSteps : current;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl shadow-xl p-8 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Procesando documento
          </h3>
          <p className="text-sm text-slate-400 mt-1">{progress.message}</p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-semibold text-lg flex items-center gap-2 ${
          isError
            ? "bg-red-900/30 text-red-300"
            : isDone
            ? "bg-emerald-900/30 text-emerald-300"
            : "bg-blue-900/30 text-blue-300"
        }`}>
          {isError && <AlertCircle className="w-4 h-4" />}
          {isDone && <CheckCircle className="w-4 h-4" />}
          {!isDone && !isError && <Loader2 className="w-4 h-4 animate-spin" />}
          {progress.progress}%
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="space-y-2">
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden shadow-lg">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isError
                ? "bg-gradient-to-r from-red-500 to-red-600"
                : isDone
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                : "bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 shadow-lg shadow-blue-500/50"
            }`}
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>Progreso general</span>
          <span>{Math.round(displayProgress)}% completado</span>
        </div>
      </div>

      {/* Step Timeline */}
      <div>
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">Etapas del proceso</p>
        <div className="space-y-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const done = isDone || i < current;
            const active = !isDone && i === current;
            const pending = !isDone && i > current;

            return (
              <div key={step.key} className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className={`relative w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    done
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30"
                      : active
                      ? `bg-gradient-to-br ${step.color} shadow-lg shadow-blue-500/50`
                      : "bg-slate-700 opacity-40"
                  }`}
                >
                  {done ? (
                    <CheckCircle className="w-5 h-5 text-white" />
                  ) : active ? (
                    <Icon className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 text-slate-400" />
                  )}
                </div>

                {/* Step info */}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    done ? "text-emerald-300" : active ? "text-blue-300" : "text-slate-400"
                  }`}>
                    {step.label}
                  </p>
                </div>

                {/* Status badge */}
                {done && (
                  <span className="text-xs bg-emerald-900/30 text-emerald-300 px-2 py-1 rounded">
                    Completado
                  </span>
                )}
                {active && (
                  <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded animate-pulse">
                    En progreso
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-400">{completedSteps}/{totalSteps}</p>
          <p className="text-xs text-slate-400 mt-1">Etapas completadas</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-cyan-400">{Math.round(displayProgress)}%</p>
          <p className="text-xs text-slate-400 mt-1">Progreso total</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-400">{totalSteps - completedSteps}</p>
          <p className="text-xs text-slate-400 mt-1">Pendientes</p>
        </div>
      </div>

      {/* Success/Error message */}
      {isDone && (
        <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-300">¡Documento procesado exitosamente!</p>
            <p className="text-xs text-emerald-200 mt-1">El documento está listo para consultas</p>
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-300">Error durante el procesamiento</p>
            <p className="text-xs text-red-200 mt-1">{progress.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
