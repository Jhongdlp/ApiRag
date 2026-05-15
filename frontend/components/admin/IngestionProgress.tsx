import { CheckCircle, Loader2, FileSearch, FileCode, Scissors, Cpu, Database } from "lucide-react";
import type { IngestionProgress as IngestionProgressType } from "@/types";

const STEPS = [
  { key: "extraction",  label: "Extracción",  icon: FileSearch },
  { key: "conversion",  label: "Conversión",  icon: FileCode },
  { key: "chunking",    label: "Chunks",      icon: Scissors },
  { key: "embedding",   label: "Embeddings",  icon: Cpu },
  { key: "indexing",    label: "Indexación",  icon: Database },
];

function stepIndex(step: string) {
  return STEPS.findIndex((s) => s.key === step);
}

export default function IngestionProgress({ progress }: { progress: IngestionProgressType }) {
  const current = stepIndex(progress.step);
  const isDone = progress.step === "done";
  const isError = progress.step === "error";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Procesando documento</h3>
        <span className="text-xs font-medium text-[#003087]">{progress.progress}%</span>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = isDone || i < current;
          const active = !isDone && i === current;
          const pending = !isDone && i > current;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    done
                      ? "bg-emerald-500"
                      : active
                      ? "bg-[#003087]"
                      : "bg-gray-100"
                  }`}
                >
                  {done ? (
                    <CheckCircle className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                  ) : active ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Icon className={`w-4 h-4 ${pending ? "text-gray-300" : "text-white"}`} />
                  )}
                </div>
                <span className={`text-[10px] font-medium text-center leading-tight ${
                  done ? "text-emerald-600" : active ? "text-[#003087]" : "text-gray-400"
                }`}>
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-full mx-1 mb-5 rounded-full transition-colors duration-500 ${
                  done || isDone ? "bg-emerald-400" : "bg-gray-200"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isError ? "bg-red-500" : isDone ? "bg-emerald-500" : "bg-[#003087]"
            }`}
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <p className={`text-xs ${isError ? "text-red-600" : "text-gray-500"}`}>
          {progress.message}
        </p>
      </div>
    </div>
  );
}
