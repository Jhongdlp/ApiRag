"use client";

import type { Document } from "@/types";
import Button from "@/components/ui/Button";

const statusLabel: Record<Document["status"], string> = {
  processing: "Procesando...",
  ready: "Listo",
  error: "Error",
};

const statusColor: Record<Document["status"], string> = {
  processing: "text-yellow-600 bg-yellow-50",
  ready: "text-green-700 bg-green-50",
  error: "text-red-600 bg-red-50",
};

interface DocumentListProps {
  documents: Document[];
  onDelete: (id: string) => void;
}

export default function DocumentList({ documents, onDelete }: DocumentListProps) {
  if (documents.length === 0) {
    return <p className="text-gray-400 text-sm">No hay documentos indexados.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-gray-800">{doc.filename}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {doc.chunk_count} chunks ·{" "}
              {new Date(doc.uploaded_at).toLocaleDateString("es-EC")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[doc.status]}`}
            >
              {statusLabel[doc.status]}
            </span>
            <Button variant="danger" onClick={() => onDelete(doc.id)} className="text-xs px-3 py-1">
              Eliminar
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
