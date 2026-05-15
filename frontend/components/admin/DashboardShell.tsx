"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import { listDocuments, uploadDocument, deleteDocument, createIngestionSocket } from "@/lib/api";
import DropZone from "./DropZone";
import DocumentTable from "./DocumentTable";
import IngestionProgress from "./IngestionProgress";
import { FileText, Layers, CheckCircle, LogOut, RefreshCw } from "lucide-react";
import type { Document, IngestionProgress as IngestionProgressType } from "@/types";

export default function DashboardShell() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [progress, setProgress] = useState<IngestionProgressType | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Obtener sesión Supabase al montar
  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setToken(session.access_token);
      setEmail(session.user.email ?? "");
    });
  }, [router]);

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    setLoadingDocs(true);
    setFetchError(null);
    try {
      const data = await listDocuments(token);
      setDocuments(data);
    } catch {
      setFetchError("No se pudo cargar la lista de documentos.");
    } finally {
      setLoadingDocs(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchDocuments();
  }, [token, fetchDocuments]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!token) return;
      const { task_id } = await uploadDocument(file, token);
      await fetchDocuments(); // refrescar para mostrar estado "processing"

      const ws = createIngestionSocket(task_id);
      ws.onmessage = (e) => {
        const msg: IngestionProgressType = JSON.parse(e.data);
        setProgress(msg);
        if (msg.step === "done" || msg.step === "error") {
          ws.close();
          fetchDocuments();
          if (msg.step === "done") {
            setTimeout(() => setProgress(null), 3000);
          }
        }
      };
      ws.onerror = () => ws.close();
    },
    [token, fetchDocuments]
  );

  const handleDelete = useCallback(
    async (docId: string) => {
      if (!token) return;
      await deleteDocument(docId, token);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    },
    [token]
  );

  const handleLogout = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Stats
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunk_count ?? 0), 0);
  const readyCount = documents.filter((d) => d.status === "ready").length;
  const processingCount = documents.filter((d) => d.status === "processing").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#003087] text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
              <span className="text-xs font-extrabold tracking-tight">UTI</span>
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Gestión de Documentos</h1>
              <p className="text-blue-300 text-[11px]">Índice de conocimiento institucional</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-blue-300 text-xs hidden sm:block">{email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-white transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<FileText className="w-5 h-5 text-[#003087]" />}
            label="Documentos"
            value={documents.length}
            bg="bg-blue-50"
          />
          <StatCard
            icon={<Layers className="w-5 h-5 text-purple-600" />}
            label="Chunks indexados"
            value={totalChunks.toLocaleString()}
            bg="bg-purple-50"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
            label="Listos"
            value={`${readyCount} / ${documents.length}`}
            bg="bg-emerald-50"
          />
        </div>

        {/* Upload section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Subir documento</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Los PDFs se procesan automáticamente: extracción → chunks → embeddings → índice
            </p>
          </div>
          <DropZone onUpload={handleUpload} disabled={processingCount > 0} />
        </section>

        {/* Ingestion progress */}
        {progress && <IngestionProgress progress={progress} />}

        {/* Documents list */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Documentos indexados</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {documents.length > 0 ? `${documents.length} documento${documents.length !== 1 ? "s" : ""}` : "Ninguno aún"}
              </p>
            </div>
            <button
              onClick={fetchDocuments}
              disabled={loadingDocs}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#003087] transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>

          {fetchError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{fetchError}</p>
          )}

          <DocumentTable documents={documents} onDelete={handleDelete} />
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  bg: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
