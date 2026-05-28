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
  doc_ids?: string[] | null;
  doc_names?: string[];
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

export interface SeriesPoint {
  day: number;
  date: string;
  queries: number;
  ingestas: number;
}

export interface TopDoc {
  doc_id: string;
  filename: string;
  hits: number;
}

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

export interface AnalyticsStats {
  range: string;
  total_queries: number;
  queries_delta_pct?: number | null;
  avg_latency_ms?: number | null;
  latency_delta_pct?: number | null;
  ingest_success_rate?: number | null;
  ingest_breakdown: { done: number; failed: number; in_progress: number };
  series: SeriesPoint[];
  top_documents: TopDoc[];
  category_distribution: CategorySlice[];
}

export interface LogEntry {
  ts: string;
  level: "info" | "warn" | "error";
  text: string;
}

export interface LogList {
  entries: LogEntry[];
}

export interface ConversationSummary {
  id: string;
  session_token?: string | null;
  last_query?: string | null;
  message_count: number;
  created_at?: string | null;
  last_active_at?: string | null;
  has_dislike: boolean;
}

export interface ConversationMessageSource {
  chunk_id: string;
  doc_id: string;
  filename: string;
  page_number?: number | null;
  heading_path?: string | null;
  score?: number | null;
  rank?: number | null;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string | null;
  latency_ms?: number | null;
  rating?: number | null;
  sources: ConversationMessageSource[];
}

export interface ConversationDetail {
  id: string;
  session_token?: string | null;
  message_count: number;
  created_at?: string | null;
  last_active_at?: string | null;
  messages: ConversationMessage[];
}
