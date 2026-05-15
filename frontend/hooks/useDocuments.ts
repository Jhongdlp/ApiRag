"use client";

import { useState, useCallback } from "react";
import { listDocuments, uploadDocument, deleteDocument, createIngestionSocket } from "@/lib/api";
import type { Document, IngestionProgress } from "@/types";

export function useDocuments(token: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<IngestionProgress | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listDocuments(token);
      setDocuments(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const upload = useCallback(
    async (file: File) => {
      const { task_id } = await uploadDocument(file, token);
      const ws = createIngestionSocket(task_id);
      ws.onmessage = (e) => {
        const msg: IngestionProgress = JSON.parse(e.data);
        setProgress(msg);
        if (msg.step === "done" || msg.step === "error") {
          ws.close();
          fetchDocuments();
        }
      };
    },
    [token, fetchDocuments]
  );

  const remove = useCallback(
    async (docId: string) => {
      await deleteDocument(docId, token);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    },
    [token]
  );

  return { documents, loading, progress, fetchDocuments, upload, remove };
}
