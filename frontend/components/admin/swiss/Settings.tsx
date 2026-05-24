"use client";

import { Pencil } from "lucide-react";
import { Button, PageHeader, cx } from "./ui";

const PARAMS = [
  { title: "Modelo de embeddings", value: "bge-m3 (1024d)" },
  { title: "Modelo LLM",           value: "qwen2.5:14b · Q4_K_M" },
  { title: "Tamaño de chunk",      value: "512 tokens · overlap 80" },
  { title: "Top-K recuperación",   value: "6 chunks" },
  { title: "Idioma principal",     value: "Español (ES-EC)" },
  { title: "Retención de logs",    value: "90 días" },
];

export default function Settings() {
  return (
    <div>
      <PageHeader
        section="Preferencias · 06"
        title="Configuración"
        sub={<span>Ajustes generales del sistema RAG · 6 parámetros</span>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-hairline border-b border-hairline">
        {PARAMS.map((s, i) => (
          <div key={i} className="bg-ink p-6">
            <div className="flex items-baseline justify-between mb-4">
              <span className="font-mono text-[10px] text-dim tabular">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Button variant="ghost" size="sm" icon={Pencil}>
                Editar
              </Button>
            </div>
            <div className="eyebrow text-dim">{s.title}</div>
            <div className="display text-[22px] font-semibold text-white mt-2 font-mono">
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
