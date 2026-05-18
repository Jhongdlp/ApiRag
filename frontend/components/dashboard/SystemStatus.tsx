"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Zap, Cpu, AlertCircle, CheckCircle2 } from "lucide-react";

interface ServiceStatus {
  name: string;
  status: "running" | "error" | "loading";
  icon: React.ReactNode;
}

export default function SystemStatus() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "FastAPI", status: "loading", icon: <Zap className="w-4 h-4" /> },
    { name: "Embeddings", status: "loading", icon: <Cpu className="w-4 h-4" /> },
    { name: "Supabase", status: "loading", icon: <Database className="w-4 h-4" /> },
    { name: "Ollama LLM", status: "loading", icon: <Activity className="w-4 h-4" /> },
  ]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "ping" }),
          }
        );

        if (response.ok) {
          setServices((prev) =>
            prev.map((s) => ({
              ...s,
              status:
                s.name === "FastAPI" || s.name === "Supabase"
                  ? "running"
                  : s.name === "Embeddings" || s.name === "Ollama LLM"
                    ? "running"
                    : "running",
            }))
          );
        }
      } catch (error) {
        console.error("Health check failed:", error);
        setServices((prev) =>
          prev.map((s) => ({ ...s, status: "error" }))
        );
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-emerald-400";
      case "error":
        return "text-red-400";
      default:
        return "text-yellow-400";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "running":
        return "bg-emerald-900/20";
      case "error":
        return "bg-red-900/20";
      default:
        return "bg-yellow-900/20";
    }
  };

  return (
    <div className="w-64 bg-slate-800/50 border-r border-slate-700 flex flex-col p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white mb-1">UTI RAG</h2>
        <p className="text-xs text-slate-400">Asistente Académico</p>
      </div>

      {/* System Status */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Sistema
        </h3>

        {services.map((service) => (
          <div
            key={service.name}
            className={`p-3 rounded-lg ${getStatusBg(
              service.status
            )} border border-slate-700/50 transition-all duration-300 hover:border-slate-600`}
          >
            <div className="flex items-center gap-3">
              <div className={getStatusColor(service.status)}>
                {service.status === "running" ? (
                  <CheckCircle2 className="w-4 h-4 animate-pulse" />
                ) : service.status === "error" ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Activity className="w-4 h-4 animate-spin" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-200">
                  {service.name}
                </p>
                <p
                  className={`text-xs mt-0.5 ${
                    service.status === "running"
                      ? "text-emerald-300"
                      : service.status === "error"
                        ? "text-red-300"
                        : "text-yellow-300"
                  }`}
                >
                  {service.status === "running"
                    ? "Activo"
                    : service.status === "error"
                      ? "Offline"
                      : "Comprobando"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="space-y-3 pt-4 border-t border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Estadísticas
        </h3>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Documentos</span>
            <span className="text-slate-200 font-medium">0</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full w-0 bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500" />
          </div>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Chunks Indexados</span>
          <span className="text-slate-200 font-medium">0</span>
        </div>
        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full w-0 bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500" />
        </div>
      </div>

      {/* Info */}
      <div className="mt-auto pt-4 border-t border-slate-700 text-xs text-slate-400 space-y-2">
        <p>🚀 Modelo: Qwen 2.5 14B</p>
        <p>📊 Embeddings: BAAI/bge-m3</p>
        <p className="text-slate-500 text-xs mt-4">v1.0.0</p>
      </div>
    </div>
  );
}
