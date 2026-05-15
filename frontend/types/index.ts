export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export interface Source {
  filename?: string;
  h1?: string;
  h2?: string;
  chunk_index?: number;
}

export interface ChatRequest {
  query: string;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
}

export interface Document {
  id: string;
  filename: string;
  uploaded_at: string;
  status: "processing" | "ready" | "error";
  chunk_count: number;
}

export interface IngestionProgress {
  step: string;
  progress: number;
  message: string;
}
