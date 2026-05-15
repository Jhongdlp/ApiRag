"use client";

import { useCallback, useRef, useState, DragEvent } from "react";
import { UploadCloud, FileText, X } from "lucide-react";

interface DropZoneProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropZone({ onUpload, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [staged, setStaged] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    if (!file.name.toLowerCase().endsWith(".pdf"))
      return "Solo se permiten archivos PDF.";
    if (file.size > 50 * 1024 * 1024)
      return "El archivo supera el límite de 50 MB.";
    return null;
  };

  const stageFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) { setFileError(err); return; }
    setFileError(null);
    setStaged(file);
  }, []);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) stageFile(file);
  };

  const handleConfirm = async () => {
    if (!staged) return;
    setUploading(true);
    try {
      await onUpload(staged);
      setStaged(null);
    } finally {
      setUploading(false);
    }
  };

  if (staged) {
    return (
      <div className="border-2 border-[#003087] bg-blue-50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#003087]/10 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#003087]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{staged.name}</p>
              <p className="text-xs text-gray-500">{formatBytes(staged.size)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStaged(null)}
              disabled={uploading}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleConfirm}
              disabled={uploading}
              className="px-5 py-2 bg-[#003087] text-white text-sm font-semibold rounded-lg hover:bg-[#002070] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {uploading ? "Subiendo..." : "Subir e indexar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
          ${dragging
            ? "border-[#003087] bg-blue-50 scale-[1.01]"
            : "border-gray-200 bg-gray-50 hover:border-[#003087]/50 hover:bg-blue-50/30"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) stageFile(f); e.target.value = ""; }}
        />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${dragging ? "bg-[#003087]" : "bg-[#003087]/10"}`}>
            <UploadCloud className={`w-7 h-7 transition-colors ${dragging ? "text-white" : "text-[#003087]"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">
              {dragging ? "Suelta el archivo aquí" : "Arrastra un PDF aquí"}
            </p>
            <p className="text-xs text-gray-400 mt-1">o haz clic para seleccionar · PDF · Máx. 50 MB</p>
          </div>
        </div>
      </div>

      {fileError && (
        <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          {fileError}
        </p>
      )}
    </div>
  );
}
