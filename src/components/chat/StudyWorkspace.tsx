"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, LogOut, Menu, Plus, Search, Brain, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

import { ChatInput } from "./ChatInput";
import { ChatMessage as ChatMessageComponent } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { useAuth } from "@/hooks/use-auth";
import type { ChatMessage } from "@/lib/chat/types";
import type { StudySessionRecord } from "@/lib/study-sessions/types";
import type { UploadedMaterialRecord } from "@/lib/uploads/types";
import { DEFAULT_STUDY_SESSION_TITLE } from "@/lib/study-sessions/title";
import { useDashboard } from "@/context/dashboard-context";

type ApiErrorResponse = {
  code: string;
  message: string;
};

type SessionsApiResponse = {
  success: boolean;
  requestId: string;
  data?: {
    sessions: StudySessionRecord[];
  };
  error?: ApiErrorResponse;
};

type SessionCreateApiResponse = {
  success: boolean;
  requestId: string;
  data?: {
    session: StudySessionRecord;
  };
  error?: ApiErrorResponse;
};

type ChatApiResponse = {
  success: boolean;
  requestId: string;
  data?: {
    message: ChatMessage;
    session?: StudySessionRecord;
  };
  error?: ApiErrorResponse;
};

const starterPrompts = [
  "Explain photosynthesis like I'm 12",
  "Compare mitosis and meiosis",
  "Make me a 7-day study plan for algebra",
  "Help me practice Spanish vocabulary",
];

function toChatMessage(message: StudySessionRecord["messages"][number]): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: new Date(message.createdAt).getTime(),
    sources: message.sources ?? [],
  };
}

function sessionToMessages(session: StudySessionRecord | null | undefined): ChatMessage[] {
  if (!session || session.messages.length === 0) {
    return [];
  }
  return session.messages.map(toChatMessage);
}

function sortSessions(sessions: StudySessionRecord[] = []) {
  return [...sessions].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function normalizeSession(session: any): StudySessionRecord {
  const messages = Array.isArray(session?.messages)
    ? session.messages
    : Array.isArray(session?.study_messages)
      ? session.study_messages.map((message: any) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
          sources: Array.isArray(message.sources) ? message.sources : [],
        }))
      : [];

  return {
    id: session.id,
    title: session.title,
    topicCategory: session.topicCategory ?? session.topic_category ?? "General",
    lastMessage: session.lastMessage ?? session.last_message ?? "",
    createdAt: session.createdAt ?? session.created_at ?? new Date().toISOString(),
    updatedAt: session.updatedAt ?? session.updated_at ?? new Date().toISOString(),
    messages: messages.map((message: any) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt ?? message.created_at ?? new Date().toISOString(),
      sources: Array.isArray(message.sources) ? message.sources : [],
    })),
  };
}

export function StudyWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSessionId = searchParams.get("session");
  const { user, ready, loading: authLoading } = useAuth();
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    loadingSessions,
    createSession,
    upsertSession,
    appendMessage,
    setMobileSidebarOpen,
  } = useDashboard();

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatCourseId, setChatCourseId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const [activeSessionMaterials, setActiveSessionMaterials] = useState<UploadedMaterialRecord[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const initialSyncRef = useRef(false);

  // Sync activeSessionId with search query param "session"
  useEffect(() => {
    if (!ready || authLoading) return;

    if (paramSessionId) {
      if (activeSessionId !== paramSessionId) {
        setActiveSessionId(paramSessionId);
      }
      initialSyncRef.current = true;
    } else {
      if (!initialSyncRef.current) {
        if (sessions.length > 0) {
          router.replace(`/chat?session=${sessions[0].id}`);
        }
        initialSyncRef.current = true;
      } else {
        if (activeSessionId !== null) {
          setActiveSessionId(null);
        }
      }
    }
  }, [ready, authLoading, paramSessionId, activeSessionId, sessions, setActiveSessionId, router]);

  const refreshMaterials = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/materials?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json();
      if (response.ok && payload.success && payload.data?.materials) {
        setActiveSessionMaterials(payload.data.materials);
      }
    } catch (err) {
      console.error("Failed to refresh materials for session", err);
    }
  }, []);

  const handleDeleteMaterial = useCallback(async (materialId: string) => {
    if (!activeSessionId) return;
    try {
      const response = await fetch(`/api/materials/${materialId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setActiveSessionMaterials((prev) => prev.filter((m) => m.id !== materialId));
      } else {
        const payload = await response.json();
        throw new Error(payload.error?.message || "Failed to delete document");
      }
    } catch (err) {
      console.error("Failed to delete document", err);
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }, [activeSessionId]);

  // Load materials when activeSessionId changes
  useEffect(() => {
    // Clear previous materials immediately to avoid displaying stale data
    setActiveSessionMaterials([]);

    if (!ready || !user || !activeSessionId) {
      return;
    }

    let cancelled = false;
    setLoadingMaterials(true);

    void (async () => {
      try {
        const response = await fetch(`/api/materials?sessionId=${encodeURIComponent(activeSessionId)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        const payload = await response.json();
        if (cancelled) return;
        if (response.ok && payload.success && payload.data?.materials) {
          setActiveSessionMaterials(payload.data.materials);
        }
      } catch (err) {
        console.error("Failed to load materials for session", err);
      } finally {
        if (!cancelled) setLoadingMaterials(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, user, activeSessionId]);

  const currentSessionId = paramSessionId ?? null;

  const activeSession = useMemo(
    () => (currentSessionId ? sessions.find((s) => s.id === currentSessionId) ?? null : null),
    [sessions, currentSessionId]
  );

  const activeMessages = useMemo(() => sessionToMessages(activeSession), [activeSession]);
  const hasMessages = activeMessages.length > 0;

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  const handleTranscriptScroll = () => {
    const container = transcriptRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsNearBottom(distanceFromBottom < 96);
  };

  // Scroll to bottom on session change or when new messages arrive (only if near bottom)
  const lastMessageCount = useRef(activeMessages.length);
  const lastActiveSessionId = useRef(activeSessionId);

  useEffect(() => {
    const sessionChanged = activeSessionId !== lastActiveSessionId.current;
    const newMessages = activeMessages.length > lastMessageCount.current;
    
    lastActiveSessionId.current = activeSessionId;
    lastMessageCount.current = activeMessages.length;

    if (sessionChanged) {
      scrollToBottom("auto");
    } else if (sending || (newMessages && isNearBottom)) {
      scrollToBottom("smooth");
    }
  }, [activeMessages.length, sending, activeSessionId, isNearBottom]);

  async function handleNewSession() {
    if (sending || loadingSessions) return;
    setError(null);
    setActiveSessionId(null); // Clear active session in context
    router.push("/chat");
    if (window.innerWidth < 768) setMobileSidebarOpen(false);
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || loadingSessions || authLoading || !ready) return;

    setError(null);
    setSending(true);

    let sessionForRequest = activeSession;
    let isNewSession = false;

    try {
      if (!sessionForRequest) {
        sessionForRequest = await createSession(trimmed);
        isNewSession = true;
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      const optimisticMessages = [...(sessionForRequest?.messages ?? []), userMessage];
      appendMessage(sessionForRequest.id, userMessage);
      setIsNearBottom(true);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionForRequest.id,
          messages: optimisticMessages,
          ...(chatCourseId ? { courseId: chatCourseId } : {}),
        }),
      });

      const payload = (await response.json()) as ChatApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "Failed to get a response from the tutor.");
      }

      if (payload.data?.session) {
        upsertSession(payload.data.session);
        if (isNewSession) {
          router.replace(`/chat?session=${payload.data.session.id}`);
        }
      } else if (payload.data?.message) {
        appendMessage(sessionForRequest.id, payload.data.message);
      }
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Network error. Please try again.";
      setError(message);

      if (sessionForRequest?.id) {
        appendMessage(sessionForRequest.id, {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `I couldn't process your request: ${message}. Please try again.`,
          timestamp: Date.now(),
        });
      }
    } finally {
      setSending(false);
    }
  }

  async function handleUpload(file: File) {
    if (loadingSessions || authLoading || !ready) return;
    
    setError(null);
    setIsUploading(true);
    
    try {
      let sessionForRequest = activeSession;
      let isNewSession = false;
      if (!sessionForRequest) {
        sessionForRequest = await createSession("Uploaded a document for analysis");
        isNewSession = true;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", sessionForRequest.id);

      const uploadingMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        role: "assistant",
        content: `*Analyzing your document: ${file.name}...*`,
        timestamp: Date.now(),
      };
      appendMessage(sessionForRequest.id, uploadingMsg);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
         throw new Error(payload.error || "Failed to upload document");
      }

      // Refresh the session materials list immediately
      await refreshMaterials(sessionForRequest.id);

      // Add success message
      const successMsg: ChatMessage = {
        id: `sys-${Date.now() + 1}`,
        role: "assistant",
        content: `I've successfully analyzed **${file.name}**! You can now ask me questions about it.`,
        timestamp: Date.now(),
      };
      appendMessage(sessionForRequest.id, successMsg);

      if (isNewSession) {
        router.replace(`/chat?session=${sessionForRequest.id}`);
      }

    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload file.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 h-full w-full relative min-w-0 bg-[#0a0a0a] overflow-hidden">
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-full max-w-md p-4">
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow-xl">
            {error}
          </div>
        </div>
      )}

      {loadingSessions && currentSessionId ? (
        <div className="flex-1 flex flex-col px-4 md:px-8 pb-32 pt-16 md:pt-20">
          <div className="mx-auto max-w-3xl w-full flex flex-col gap-6 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="h-8 w-8 rounded-full bg-white/10 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-white/10 rounded w-1/4" />
                <div className="h-4 bg-white/5 rounded w-5/6" />
                <div className="h-4 bg-white/5 rounded w-2/3" />
              </div>
            </div>
            <div className="flex items-start gap-4 pt-6">
              <div className="h-8 w-8 rounded-full bg-white/10 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-white/10 rounded w-1/5" />
                <div className="h-4 bg-white/5 rounded w-3/4" />
              </div>
            </div>
          </div>
        </div>
      ) : hasMessages ? (
        <div
          className="flex-1 overflow-y-auto px-4 md:px-8 pb-32 pt-16 md:pt-20 scrollbar-hide"
          ref={transcriptRef}
          onScroll={handleTranscriptScroll}
        >
          <div className="mx-auto max-w-3xl flex flex-col gap-6">
            {activeMessages.map((message) => (
              <ChatMessageComponent key={message.id} message={message} />
            ))}
            {sending && (
              <div className="flex justify-start">
                <TypingIndicator />
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 pb-32">
          <h1 className="text-3xl md:text-4xl font-medium text-white mb-8">Where should we begin?</h1>
          
          <div className="w-full max-w-3xl">
            <ChatInput
              onSend={handleSend}
              onUpload={handleUpload}
              isUploading={isUploading}
              disabled={sending || loadingSessions || authLoading || !ready}
              courseId={chatCourseId ?? undefined}
              onCourseId={(id) => setChatCourseId(id)}
              materials={activeSessionMaterials}
              onDeleteMaterial={handleDeleteMaterial}
            />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-2xl">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="rounded-full border border-white/10 bg-[#141414] px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-[#202020] hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating Input (when active) */}
      {hasMessages && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent p-4 pb-6">
          <div className="mx-auto max-w-3xl">
            <ChatInput
              onSend={handleSend}
              onUpload={handleUpload}
              isUploading={isUploading}
              disabled={sending || loadingSessions || authLoading || !ready}
              courseId={chatCourseId ?? undefined}
              onCourseId={(id) => setChatCourseId(id)}
              materials={activeSessionMaterials}
              onDeleteMaterial={handleDeleteMaterial}
            />
            <p className="text-center text-[11px] text-slate-500 mt-2">EduAgent can make mistakes. Consider verifying important information.</p>
          </div>
        </div>
      )}
    </div>
  );
}
