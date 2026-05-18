import type { ChatResponse, Document } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function sendMessage(query: string): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error("Error al contactar al asistente.");
  return res.json();
}

export async function listDocuments(token: string): Promise<Document[]> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/documents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("No autorizado.");
  return res.json();
}

export async function uploadDocument(
  file: File,
  token: string
): Promise<{ doc_id: string; task_id: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/api/v1/admin/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error("Error al subir el archivo.");
  return res.json();
}

export async function deleteDocument(docId: string, token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/documents/${docId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al eliminar el documento.");
}

export function createIngestionSocket(taskId: string): WebSocket {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  return new WebSocket(`${proto}//${host}:8000/api/v1/ws/ingestion/${taskId}`);
}
