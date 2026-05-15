"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import type { IngestionProgress } from "@/types";

interface UploadFormProps {
  onUpload: (file: File) => Promise<void>;
  progress: IngestionProgress | null;
}

export default function UploadForm({ onUpload, progress }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
          id="pdf-upload"
        />
        <Button
          variant="primary"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          Subir PDF
        </Button>
        <span className="text-xs text-gray-400">Máx. 50 MB</span>
      </div>

      {progress && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{progress.message}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-uti-blue transition-all duration-300 rounded-full"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
