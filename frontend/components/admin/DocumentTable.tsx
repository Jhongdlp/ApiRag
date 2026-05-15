"use client";

import { useState } from "react";
import { Trash2, FileText, Layers, AlertCircle } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
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

export default function DocumentTable({ documents, onDelete }: DocumentTableProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await onDelete(id);
    setDeleting(null);
    setConfirming(null);
  };

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <FileText className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">Sin documentos indexados</p>
        <p className="text-xs text-gray-400 mt-1">Sube un PDF para comenzar</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Documento
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Estado
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Chunks
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Fecha
            </th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {documents.map((doc) => (
            <tr key={doc.id} className="bg-white hover:bg-gray-50/60 transition-colors group">
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#003087]/8 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-[#003087]" />
                  </div>
                  <span className="font-medium text-gray-800 truncate max-w-[220px]">
                    {doc.filename}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={doc.status} />
              </td>
              <td className="px-4 py-4">
                {doc.chunk_count > 0 ? (
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Layers className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-sm font-medium">{doc.chunk_count.toLocaleString()}</span>
                  </div>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-4 text-gray-500 text-xs">
                {formatDate(doc.uploaded_at)}
              </td>
              <td className="px-4 py-4">
                {confirming === doc.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={!!deleting}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      {deleting === doc.id ? "..." : "Confirmar"}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => setConfirming(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirming(doc.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Eliminar documento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
