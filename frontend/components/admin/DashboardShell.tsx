"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import { listDocuments, uploadDocument, deleteDocument, createIngestionSocket } from "@/lib/api";
import DropZone from "./DropZone";
import DocumentTable from "./DocumentTable";
import IngestionProgress from "./IngestionProgress";
import { FileText, Layers, CheckCircle, LogOut, RefreshCw, Upload, BarChart3 } from "lucide-react";
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
      await fetchDocuments();

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
  const errorCount = documents.filter((d) => d.status === "error").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white sticky top-0 z-20 shadow-xl border-b border-blue-500/30">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/30">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl">Centro de Documentos</h1>
              <p className="text-blue-100 text-sm mt-0.5">Gestión inteligente de base de conocimiento</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-blue-100 text-sm hidden md:block px-4 py-2 bg-white/10 rounded-lg">
              {email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all duration-200 text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            icon={<FileText className="w-6 h-6" />}
            label="Total Documentos"
            value={documents.length}
            color="from-blue-500 to-cyan-500"
          />
          <StatCard
            icon={<CheckCircle className="w-6 h-6" />}
            label="Procesados"
            value={readyCount}
            color="from-emerald-500 to-teal-500"
          />
          <StatCard
            icon={<Layers className="w-6 h-6" />}
            label="Chunks Totales"
            value={totalChunks}
            color="from-purple-500 to-pink-500"
          />
          <StatCard
            icon={<Upload className="w-6 h-6" />}
            label="En Proceso"
            value={processingCount}
            color="from-yellow-500 to-orange-500"
          />
        </div>

        {/* Upload Section */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-2xl backdrop-blur-sm p-8 space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Importar Documento</h2>
              <p className="text-slate-400 text-sm mt-1">
                Arrastra un PDF o haz clic para seleccionar • Máx. 50 MB
              </p>
            </div>
          </div>
          <DropZone onUpload={handleUpload} disabled={processingCount > 0} />
          {processingCount > 0 && (
            <p className="text-sm text-yellow-300 text-center pt-2">
              ⚠️ Un documento se está procesando. Espera a que termine para subir otro.
            </p>
          )}
        </section>

        {/* Ingestion Progress */}
        {progress && <IngestionProgress progress={progress} />}

        {/* Documents Section */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-2xl backdrop-blur-sm p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Documentos Indexados</h2>
              <p className="text-slate-400 text-sm mt-1">
                {documents.length === 0
                  ? "Ningún documento aún"
                  : `${documents.length} documento${documents.length !== 1 ? "s" : ""} • ${totalChunks} chunks`}
              </p>
            </div>
            <button
              onClick={fetchDocuments}
              disabled={loadingDocs}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDocs ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>

          {fetchError && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-300 text-sm">
              {fetchError}
            </div>
          )}

          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Sube tu primer documento para comenzar</p>
            </div>
          ) : (
            <DocumentTable documents={documents} onDelete={handleDelete} />
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm hover:border-slate-600 transition-all duration-200 group">
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} text-white flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-blue-500/30 transition-all duration-200`}>
        {icon}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-slate-400 text-sm mt-2">{label}</p>
    </div>
  );
}
