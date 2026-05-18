"use client";

import { useState } from "react";
import { Trash2, FileText, Layers, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import type { Document } from "@/types";

interface DocumentTableProps {
  documents: Document[];
  onDelete: (id: string) => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusIcon(status: string) {
  switch (status) {
    case "ready":
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    case "processing":
      return <Clock className="w-5 h-5 text-blue-400 animate-spin" />;
    case "error":
      return <AlertTriangle className="w-5 h-5 text-red-400" />;
    default:
      return <FileText className="w-5 h-5 text-slate-400" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "ready":
      return "bg-emerald-900/30 border-emerald-500/50 text-emerald-300";
    case "processing":
      return "bg-blue-900/30 border-blue-500/50 text-blue-300";
    case "error":
      return "bg-red-900/30 border-red-500/50 text-red-300";
    default:
      return "bg-slate-900/30 border-slate-500/50 text-slate-300";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "ready":
      return "Listo";
    case "processing":
      return "Procesando";
    case "error":
      return "Error";
    default:
      return status;
  }
}

export default function DocumentTable({ documents, onDelete }: DocumentTableProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await onDelete(id);
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  };

  return (
    <div className="space-y-4">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="bg-slate-700/30 border border-slate-600 rounded-lg p-5 hover:bg-slate-700/50 hover:border-slate-500 transition-all duration-200 group"
        >
          <div className="flex items-start justify-between gap-4">
            {/* File info */}
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="p-3 bg-slate-700/50 rounded-lg flex-shrink-0 group-hover:bg-slate-600/50 transition-all">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate mb-2">
                  {doc.filename}
                </h3>

                <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                  {/* Status */}
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Estado</p>
                    <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${getStatusColor(doc.status)}`}>
                      {getStatusIcon(doc.status)}
                      <span className="text-xs font-medium">{getStatusLabel(doc.status)}</span>
                    </div>
                  </div>

                  {/* Chunks */}
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Chunks</p>
                    <div className="flex items-center gap-2 text-slate-200 text-sm font-medium">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      {doc.chunk_count || 0}
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <p className="text-slate-400 text-xs mb-1">Subido</p>
                    <p className="text-slate-300 text-sm font-medium">
                      {formatDate(doc.uploaded_at)}
                    </p>
                  </div>
                </div>

                {/* Progress bar if processing */}
                {doc.status === "processing" && (
                  <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse" style={{width: "60%"}} />
                  </div>
                )}
              </div>
            </div>

            {/* Delete button */}
            {confirming === doc.id ? (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/50 rounded-lg px-4 py-2">
                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={!!deleting}
                  className="text-xs font-semibold text-red-300 hover:text-red-200 disabled:opacity-50"
                >
                  {deleting === doc.id ? "Eliminando..." : "Confirmar"}
                </button>
                <span className="text-slate-500">•</span>
                <button
                  onClick={() => setConfirming(null)}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(doc.id)}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                title="Eliminar documento"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
