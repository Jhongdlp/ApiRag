"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  Check,
  Database,
  Eye,
  FileSearch,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Document, IngestionProgress } from "@/types";
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  createIngestionSocket,
} from "@/lib/api";
import {
  Button,
  ConfirmModal,
  EmptyState,
  Input,
  PageHeader,
  SectionHeader,
  Select,
  StatusBadge,
  cx,
  useToast,
} from "./ui";

// ─── Step definitions (matching real API step keys) ──────────────────────────

interface IngestStep {
  id: string;
  label: string;
  Icon: LucideIcon;
}

const INGEST_STEPS: IngestStep[] = [
  { id: "load",  label: "Cargando",     Icon: UploadCloud },
  { id: "ext",   label: "Extrayendo",   Icon: FileSearch },
  { id: "chunk", label: "Fragmentando", Icon: Scissors },
  { id: "emb",   label: "Embeddings",   Icon: Sparkles },
  { id: "idx",   label: "Indexando",    Icon: Database },
];

function wsStepToIndex(step: string): number {
  switch (step) {
    case "loading":    return 0;
    case "extraction": return 1;
    case "conversion": return 1;
    case "chunking":   return 2;
    case "embedding":  return 3;
    case "indexing":   return 4;
    case "done":       return 5;
    default:           return 0;
  }
}

// ─── DropZone ────────────────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [drag, setDrag] = useState(false);
  const [staged, setStaged] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setErr("Solo se permiten archivos PDF.");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setErr("El archivo supera el límite de 50 MB.");
      return;
    }
    setErr(null);
    setStaged(f);
  }

  return (
    <div>
      <SectionHeader
        index={1}
        title="Subir documento"
        right={
          <span className="font-mono text-[10px] uppercase tracking-wider text-dim">
            Máx. 50 MB · Solo PDF
          </span>
        }
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={cx(
          "mt-5 relative cursor-pointer transition-colors",
          drag ? "bg-gold/5" : "hover:bg-white/[0.02]"
        )}
      >
        {/* Animated dashed border via SVG */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          <rect
            x="0.5" y="0.5"
            width="99%" height="99%"
            fill="none"
            strokeWidth="1"
            stroke={drag ? "#F5A623" : "rgba(255,255,255,0.18)"}
            strokeDasharray="6 5"
            className="dashed-anim"
          />
        </svg>

        <div className="relative flex flex-col items-center justify-center text-center py-16 px-6">
          <UploadCloud
            size={32}
            strokeWidth={1.5}
            className={drag ? "text-gold" : "text-muted"}
          />
          <div className="mt-5 text-[15px] font-medium text-white tracking-tight">
            {drag ? "Suelta para subir" : "Arrastra tu PDF aquí"}
          </div>
          <div className="text-xs text-muted mt-1.5">
            o haz clic para seleccionar archivo
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {err && (
        <p className="mt-2 text-xs text-red-400 flex items-center gap-1.5 font-mono">
          <span className="w-1.5 h-1.5 bg-red-400 inline-block" />
          {err}
        </p>
      )}

      {staged && (
        <div className="mt-3 flex items-center gap-3 p-3 border border-hairline bg-paper animate-fade-in">
          <FileText size={18} strokeWidth={1.5} className="text-muted" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate font-medium">
              {staged.name}
            </div>
            <div className="text-[11px] text-muted font-mono tabular">
              {(staged.size / 1024 / 1024).toFixed(2)} MB · listo
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setStaged(null); }}
          >
            Cancelar
          </Button>
          <Button
            variant="gold"
            size="sm"
            icon={ArrowUp}
            onClick={(e) => {
              e.stopPropagation();
              onFile(staged);
              setStaged(null);
            }}
          >
            Subir
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── IngestProgress ──────────────────────────────────────────────────────────

interface IngestRun {
  name: string;
  stepIndex: number;
  log: string;
  error?: boolean;
}

function IngestProgressView({ run }: { run: IngestRun }) {
  const total = INGEST_STEPS.length;
  const done = run.stepIndex >= total;
  const err = run.error === true;

  return (
    <div>
      <SectionHeader
        index={2}
        title="Ingesta en curso"
        sub={<span className="font-mono">{run.name}</span>}
        right={
          <span className="font-mono text-[11px] text-muted tabular">
            {String(Math.min(run.stepIndex + 1, total)).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
        }
      />

      <div className="mt-6 grid grid-cols-5 gap-px bg-hairline">
        {INGEST_STEPS.map((s, i) => {
          const isDone   = i < run.stepIndex;
          const isActive = i === run.stepIndex && !done && !err;
          const { Icon } = s;
          return (
            <div
              key={s.id}
              className={cx(
                "p-4 flex flex-col items-start gap-3 transition-colors",
                isDone   && "bg-emerald-500/[0.05]",
                isActive && "bg-blue-500/[0.06]",
                !isDone && !isActive && "bg-paper"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={cx(
                    "font-mono text-[10px] uppercase tracking-wider tabular",
                    isDone   ? "text-emerald-300" :
                    isActive ? "text-blue-300" : "text-dim"
                  )}
                >
                  Paso {String(i + 1).padStart(2, "0")}
                </span>
                {isDone   && <Check size={14} strokeWidth={1.5} className="text-emerald-300" />}
                {isActive && <Loader2 size={14} strokeWidth={1.5} className="text-blue-300 spin-slow" />}
              </div>
              <Icon
                size={20}
                strokeWidth={1.5}
                className={cx(
                  isDone   ? "text-emerald-300" :
                  isActive ? "text-blue-300" : "text-muted"
                )}
              />
              <div
                className={cx(
                  "text-[13px] font-medium",
                  isDone   ? "text-emerald-200" :
                  isActive ? "text-white" : "text-muted"
                )}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-px bg-hairline relative">
        <div
          className={cx(
            "absolute inset-y-0 left-0 transition-all duration-500",
            err ? "bg-red-400" : "bg-gold"
          )}
          style={{
            width: `${Math.min(((run.stepIndex + 0.6) / total) * 100, 100)}%`,
          }}
        />
      </div>

      {/* Log line */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="font-mono text-[10px] text-dim uppercase tracking-wider">
          log
        </span>
        <span className="font-mono text-[11px] text-muted truncate">
          → {run.log}
        </span>
        {!done && !err && (
          <span className="font-mono text-[11px] text-blue-300 animate-blink-cur">
            ▌
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Documents Table ─────────────────────────────────────────────────────────

function CategoryChip({ cat }: { cat: string }) {
  const colorMap: Record<string, string> = {
    Reglamentos: "bg-white",
    Manuales:    "bg-gold",
    Normativas:  "bg-emerald-400",
  };
  const dotCls = colorMap[cat] ?? "bg-violet-400";
  return (
    <span className="inline-flex items-center text-[11px] uppercase tracking-wider font-medium text-muted">
      <span className={cx("w-1.5 h-1.5 mr-2 inline-block", dotCls)} />
      {cat}
    </span>
  );
}

function DocumentsTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: Document[];
  onSelect: (d: Document) => void;
  onDelete: (d: Document) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Ningún documento aún"
        body="Sube tu primer PDF para comenzar a indexar conocimiento."
      />
    );
  }
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-hairline">
            {["#", "Documento", "Categoría", "Estado", "Páginas", "Chunks", "Fecha", ""].map(
              (h, i) => (
                <th
                  key={i}
                  className={cx(
                    "font-medium px-2 py-3 eyebrow text-dim",
                    i >= 4 && i <= 5 ? "text-right" : "text-left",
                    i === 7 && "w-20 text-right"
                  )}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => (
            <tr
              key={d.id}
              onClick={() => onSelect(d)}
              className="border-b border-hairline hover:bg-white/[0.02] cursor-pointer transition-colors group"
            >
              <td className="px-2 py-3 font-mono text-[11px] text-dim tabular">
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="px-2 py-3">
                <div className="text-white font-medium truncate max-w-[40ch]">
                  {d.filename}
                </div>
                <div className="text-[10px] text-dim font-mono mt-0.5">{d.id}</div>
              </td>
              <td className="px-2 py-3">
                <CategoryChip cat={d.category ?? "Otros"} />
              </td>
              <td className="px-2 py-3">
                <StatusBadge status={d.status} />
              </td>
              <td className="px-2 py-3 text-right tabular text-white">
                {d.page_count ?? "—"}
              </td>
              <td className="px-2 py-3 text-right tabular text-white font-medium">
                {d.chunk_count.toLocaleString("es-EC")}
              </td>
              <td className="px-2 py-3 text-muted tabular font-mono text-[12px]">
                {d.uploaded_at.slice(0, 10)}
              </td>
              <td className="px-2 py-3">
                <div className="flex items-center justify-end gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(d); }}
                    className="text-muted hover:text-white"
                    title="Ver"
                  >
                    <Eye size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(d); }}
                    className="text-muted hover:text-red-300"
                    title="Eliminar"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detail Drawer ───────────────────────────────────────────────────────────

function DetailDrawer({
  doc,
  onClose,
}: {
  doc: Document | null;
  onClose: () => void;
}) {
  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-40 animate-fade-in">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="absolute right-0 top-0 bottom-0 w-full max-w-[440px] bg-ink border-l border-hairline flex flex-col animate-slide-in">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="eyebrow text-dim">Detalle de documento</div>
            <button onClick={onClose} className="text-muted hover:text-white">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
          <h3 className="mt-3 text-[18px] font-semibold text-white tracking-tight leading-tight">
            {doc.filename}
          </h3>
          <div className="mt-1.5 font-mono text-[11px] text-muted">
            {doc.id} · {doc.uploaded_at.slice(0, 10)}
          </div>
        </div>

        <div className="h-px w-full bg-hairline" />

        <div className="flex-1 overflow-y-auto scroll-thin">
          <div className="grid grid-cols-3 border-b border-hairline">
            {[
              { label: "Páginas",  value: doc.page_count ?? "—" },
              { label: "Chunks",   value: doc.chunk_count.toLocaleString("es-EC") },
              { label: "Estado",   value: <StatusBadge status={doc.status} /> },
            ].map((m, i) => (
              <div
                key={i}
                className={cx("px-5 py-4", i > 0 && "border-l border-hairline")}
              >
                <div className="eyebrow text-dim">{m.label}</div>
                <div className="mt-2 text-white font-semibold tabular display text-[20px]">
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          <div className="p-6">
            <div className="eyebrow text-dim mb-4">Metadatos</div>
            <dl className="grid grid-cols-2 gap-y-3 text-[12px]">
              <dt className="text-muted">Categoría</dt>
              <dd className="text-white text-right">
                <CategoryChip cat={doc.category ?? "Otros"} />
              </dd>
              <dt className="text-muted">Modelo embed.</dt>
              <dd className="text-white text-right font-mono">bge-m3-1024d</dd>
              <dt className="text-muted">Hash</dt>
              <dd className="text-white text-right font-mono">
                {doc.file_hash ? doc.file_hash.slice(0, 8) + "…" : "—"}
              </dd>
              <dt className="text-muted">Subido</dt>
              <dd className="text-white text-right font-mono">
                {doc.uploaded_at.slice(0, 16).replace("T", " ")}
              </dd>
            </dl>
          </div>
        </div>

        <div className="h-px w-full bg-hairline" />
        <div className="px-6 py-4 flex justify-end items-center gap-3">
          <Button variant="outline" size="sm" icon={RefreshCw}>
            Reindexar
          </Button>
        </div>
      </aside>
    </div>
  );
}

// ─── Documents Page ──────────────────────────────────────────────────────────

export default function Documents({ token }: { token: string }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Document | null>(null);
  const [toDelete, setToDelete] = useState<Document | null>(null);
  const [run, setRun] = useState<IngestRun | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { push } = useToast();

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const data = await listDocuments(token);
      setDocs(data);
    } catch {
      setFetchErr("No se pudo cargar la lista de documentos.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const { task_id } = await uploadDocument(file, token);
        setRun({ name: file.name, stepIndex: 0, log: `cargando "${file.name}"...` });
        push({ type: "info", title: "Ingesta iniciada", body: file.name });

        const ws = createIngestionSocket(task_id);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          const msg: IngestionProgress = JSON.parse(e.data);
          const idx = wsStepToIndex(msg.step);
          setRun({ name: file.name, stepIndex: idx, log: msg.message });

          if (msg.step === "done") {
            ws.close();
            push({ type: "success", title: "Ingesta completada", body: file.name });
            fetchDocs();
            setTimeout(() => setRun(null), 3000);
          }
          if (msg.step === "error") {
            ws.close();
            push({ type: "error", title: "Error de ingesta", body: msg.message });
            setRun({ name: file.name, stepIndex: idx, log: msg.message, error: true });
            setTimeout(() => setRun(null), 5000);
          }
        };
        ws.onerror = () => {
          ws.close();
          setRun(null);
          push({ type: "error", title: "Error de conexión WebSocket" });
        };
      } catch (err) {
        push({ type: "error", title: "Error al subir archivo" });
      }
    },
    [token, fetchDocs, push]
  );

  const handleDelete = useCallback(async () => {
    if (!toDelete) return;
    try {
      await deleteDocument(toDelete.id, token);
      setDocs((prev) => prev.filter((d) => d.id !== toDelete.id));
      push({ type: "success", title: "Documento eliminado", body: toDelete.filename });
    } catch {
      push({ type: "error", title: "Error al eliminar documento" });
    } finally {
      setToDelete(null);
    }
  }, [toDelete, token, push]);

  const filtered = docs.filter(
    (d) =>
      (filter === "all" || d.status === filter) &&
      (q === "" || d.filename.toLowerCase().includes(q.toLowerCase()))
  );

  const totalChunks = docs.reduce((a, d) => a + d.chunk_count, 0);

  return (
    <div>
      <PageHeader
        section="Knowledge Base · 02"
        title="Documentos"
        sub={
          <span>
            {docs.length} documentos · {totalChunks.toLocaleString("es-EC")}{" "}
            chunks indexados
          </span>
        }
        right={
          <Button variant="gold" size="sm" icon={Plus}>
            Importar PDF
          </Button>
        }
      />

      {/* Upload zone */}
      <div className="py-10 border-b border-hairline">
        <DropZone onFile={handleFile} />
      </div>

      {/* Ingestion progress */}
      {run && (
        <div className="py-10 border-b border-hairline">
          <IngestProgressView run={run} />
        </div>
      )}

      {/* Indexed documents */}
      <div className="py-10">
        <SectionHeader
          index={3}
          title="Documentos indexados"
          right={
            <div className="flex items-center gap-3">
              <Input
                icon={Search}
                placeholder="Buscar..."
                wrapperClassName="w-60"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="ready">Listo</option>
                <option value="processing">Procesando</option>
                <option value="error">Error</option>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                icon={loading ? Loader2 : RefreshCw}
                onClick={fetchDocs}
                disabled={loading}
              />
              <span className="text-[11px] text-muted tabular font-mono">
                {String(filtered.length).padStart(3, "0")}
              </span>
            </div>
          }
        />

        {fetchErr && (
          <div className="mt-4 p-4 border border-red-500/40 text-red-300 text-sm">
            {fetchErr}
          </div>
        )}

        <div className="mt-2">
          <DocumentsTable
            rows={filtered}
            onSelect={setSelected}
            onDelete={setToDelete}
          />
        </div>
      </div>

      <DetailDrawer doc={selected} onClose={() => setSelected(null)} />
      <ConfirmModal
        open={!!toDelete}
        title={`¿Eliminar "${toDelete?.filename}"?`}
        body={
          toDelete
            ? `Se borrarán los ${toDelete.chunk_count.toLocaleString("es-EC")} chunks vectorizados asociados. Esta acción es irreversible.`
            : ""
        }
        onCancel={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
