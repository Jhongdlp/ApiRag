import type {
  AnalyticsStats,
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
  Document,
  EvaluationJob,
  FeedbackStats,
  LogList,
  OverviewStats,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function sendMessage(
  query: string,
  sessionToken: string | null = null,
  topK = 5
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, session_token: sessionToken, top_k: topK }),
  });
  if (!res.ok) {
    let detail = "Error al contactar al asistente.";
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (typeof body.detail === "object") detail = body.detail.message ?? detail;
    } catch { /* ignore parse error */ }
    throw new Error(detail);
  }
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
  const host = window.location.host; // includes port, goes through Next.js proxy
  return new WebSocket(`${proto}//${host}/api/v1/ws/ingestion/${taskId}`);
}

export async function submitFeedback(
  messageId: string,
  rating: 1 | -1 | null
): Promise<void> {
  await fetch(`${BASE_URL}/api/v1/chat/${messageId}/feedback`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
}

export async function getOverviewStats(token: string): Promise<OverviewStats> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al obtener estadísticas del dashboard.");
  return res.json();
}

export async function getAnalytics(
  token: string,
  range: "7d" | "30d" | "90d" = "30d"
): Promise<AnalyticsStats> {
  const res = await fetch(
    `${BASE_URL}/api/v1/admin/stats/analytics?range=${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Error al obtener analítica.");
  return res.json();
}

export async function listConversations(
  token: string,
  limit = 50
): Promise<ConversationSummary[]> {
  const res = await fetch(
    `${BASE_URL}/api/v1/admin/conversations?limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Error al listar conversaciones.");
  return res.json();
}

export async function getConversation(
  token: string,
  sessionId: string
): Promise<ConversationDetail> {
  const res = await fetch(
    `${BASE_URL}/api/v1/admin/conversations/${sessionId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Error al cargar conversación.");
  return res.json();
}

export async function getSystemLogs(
  token: string,
  limit = 20
): Promise<LogList> {
  const res = await fetch(
    `${BASE_URL}/api/v1/admin/stats/logs?limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Error al obtener la bitácora.");
  return res.json();
}

export async function getFeedbackStats(token: string): Promise<FeedbackStats> {
  const res = await fetch(`${BASE_URL}/api/v1/chat/admin/feedback`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al obtener estadísticas de feedback.");
  return res.json();
}

export async function listEvaluations(token: string): Promise<import("@/types").EvaluationJob[]> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/evaluation`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al obtener el historial.");
  return res.json();
}

export async function startEvaluation(
  token: string,
  docIds: string[] | null = null,
  nSamples = 5
): Promise<{ task_id: string }> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/evaluation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ doc_ids: docIds, n_samples: nSamples }),
  });
  if (!res.ok) throw new Error("Error al iniciar la evaluación.");
  return res.json();
}

export async function getEvaluation(token: string, taskId: string): Promise<EvaluationJob> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/evaluation/${taskId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al obtener la evaluación.");
  return res.json();
}

export function createEvaluationSocket(taskId: string): WebSocket {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host; // includes port, goes through Next.js proxy
  return new WebSocket(`${proto}//${host}/api/v1/ws/evaluation/${taskId}`);
}

export async function downloadEvaluationReport(token: string, taskId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/admin/evaluation/${taskId}/report`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al descargar el reporte.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ragas_report_${taskId.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
