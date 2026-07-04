export type Role = "user" | "assistant";

export type ChatSource = {
  documentId: string;
  documentName: string;
  chunkId?: string;
  page?: number;
  slide?: number;
  chapter?: string;
  section?: string;
  score?: number;
};

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  sources?: ChatSource[];
  usage?: {
    modelUsed: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}
