export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  latency_ms?: number;
  message_id?: string | null;
}

export interface Source {
  doc_id?: string;
  chunk_id?: string;
  filename?: string;
  page_number?: number;
  heading_path?: string;
  snippet?: string;
  score?: number;
  h1?: string;
  h2?: string;
  chunk_index?: number;
}

export interface ChatRequest {
  query: string;
  session_token?: string | null;
  top_k?: number;
  filter_doc_ids?: string[] | null;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  latency_ms?: number;
  message_id?: string | null;
}

export interface Document {
  id: string;
  filename: string;
  uploaded_at: string;
  status: "processing" | "ready" | "error";
  chunk_count: number;
  category?: string;
  file_hash?: string;
  page_count?: number;
}

export interface IngestionProgress {
  step: string;
  progress: number;
  message: string;
}

export interface DislikedMessage {
  message_id: string;
  answer: string;
  user_query?: string | null;
  created_at?: string | null;
}

export interface FeedbackStats {
  likes: number;
  dislikes: number;
  disliked_messages: DislikedMessage[];
}

export interface DayActivity {
  date: string;
  day_label: string;
  queries: number;
  ingestas: number;
}

export interface RecentDoc {
  id: string;
  filename: string;
  status: string;
  uploaded_at?: string | null;
}

export interface OverviewStats {
  documents_total: number;
  documents_ready: number;
  documents_processing: number;
  documents_error: number;
  chunks_total: number;
  sessions_today: number;
  queries_today: number;
  avg_latency_ms?: number | null;
  activity_7d: DayActivity[];
  recent_documents: RecentDoc[];
}

export interface RagasMetrics {
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  context_recall: number;
  overall: number;
}

export interface EvalSample {
  question: string;
  answer: string;
  ground_truth: string;
  faithfulness: number;
  answer_relevancy: number;
  context_precision: number;
  context_recall: number;
}

export type EvaluationStatus = "pending" | "running" | "done" | "error";

export interface EvaluationJob {
  task_id: string;
  status: EvaluationStatus;
  n_samples?: number;
  metrics?: RagasMetrics;
  samples?: EvalSample[];
  error_msg?: string | null;
  created_at?: string | null;
  finished_at?: string | null;
}

export interface EvalProgressEvent {
  step: string;
  progress: number;
  message: string;
  metrics?: RagasMetrics;
  samples?: EvalSample[];
}
