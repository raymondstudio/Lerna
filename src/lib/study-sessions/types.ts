import type { ChatSource } from "@/lib/chat/types";

export type StudyMessageRole = "user" | "assistant";

export type StudySessionMessage = {
  id: string;
  role: StudyMessageRole;
  content: string;
  createdAt: string;
  sources?: ChatSource[];
};

export type StudySessionRecord = {
  id: string;
  title: string;
  topicCategory: string;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
  messages: StudySessionMessage[];
  courseId?: string;
  status?: "active" | "paused" | "completed";
  durationSeconds?: number;
  topicsCovered?: string[];
  summary?: string;
  notes?: string;
  notesRevision?: number;
  notesUpdatedAt?: string;
};
