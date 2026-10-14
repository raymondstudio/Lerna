"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ChatInput } from "./ChatInput";
import { ChatMessage as ChatMessageComponent } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { useAuth } from "@/hooks/use-auth";
import type { ChatMessage } from "@/lib/chat/types";
import type { ChatReferenceSelection } from "@/lib/chat/references";
import type { StudySessionRecord } from "@/lib/study-sessions/types";
import type { UploadedMaterialRecord } from "@/lib/uploads/types";
import { useDashboard } from "@/context/dashboard-context";

type ApiErrorResponse = {
  code: string;
  message: string;
};

type SessionApiResponse = {
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
  } = useDashboard();

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatReference, setChatReference] = useState<ChatReferenceSelection | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingActiveSession, setLoadingActiveSession] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const [activeSessionMaterials, setActiveSessionMaterials] = useState<UploadedMaterialRecord[]>([]);
  const [, setLoadingMaterials] = useState(false);

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

  const hasSessionRef = useRef(false);
  hasSessionRef.current = sessions.some(s => s.id === currentSessionId);

  useEffect(() => {
    if (!ready || !user || !currentSessionId) {
      setLoadingActiveSession(false);
      return;
    }

    const controller = new AbortController();
    
    // Only show loading state if we don't already have this session locally.
    // We still fetch to ensure we have the latest messages (stale-while-revalidate).
    if (!hasSessionRef.current) {
      setLoadingActiveSession(true);
    }

    void (async () => {
      try {
        const response = await fetch(`/api/study-sessions/${encodeURIComponent(currentSessionId)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as SessionApiResponse;
        if (!response.ok || !payload.success || !payload.data?.session) {
          throw new Error(payload.error?.message || "Unable to load this conversation.");
        }
        upsertSession(payload.data.session);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load this conversation.");
        router.replace("/chat");
      } finally {
        if (!controller.signal.aborted) setLoadingActiveSession(false);
      }
    })();

    return () => controller.abort();
  }, [currentSessionId, ready, router, upsertSession, user]);

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
          ...(chatReference?.courseId ? { courseId: chatReference.courseId } : {}),
          ...(chatReference?.materialId ? { materialId: chatReference.materialId } : {}),
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
        content: `*Analyzing your document: ${file.name}…*`,
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

  const composer = (
    <ChatInput
      onSend={handleSend}
      onUpload={handleUpload}
      isUploading={isUploading}
      disabled={sending || loadingSessions || loadingActiveSession || authLoading || !ready}
      onReferenceChange={setChatReference}
      materials={activeSessionMaterials}
      onDeleteMaterial={handleDeleteMaterial}
    />
  );

  return (
    <div className="relative flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0a0a]">
      {error && (
        <div className="absolute left-1/2 top-4 z-20 w-full max-w-md -translate-x-1/2 p-4" role="alert">
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow-xl">
            {error}
          </div>
        </div>
      )}

      {(loadingSessions || loadingActiveSession) && currentSessionId ? (
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-8 pt-12 md:px-8 md:pt-16" aria-label="Loading conversation" role="status">
          <div className="mx-auto flex w-full max-w-3xl animate-pulse flex-col gap-6 motion-reduce:animate-none">
            <div className="flex items-start gap-4">
              <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 rounded bg-white/10" />
                <div className="h-4 w-5/6 rounded bg-white/5" />
                <div className="h-4 w-2/3 rounded bg-white/5" />
              </div>
            </div>
            <div className="flex items-start gap-4 pt-6">
              <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/5 rounded bg-white/10" />
                <div className="h-4 w-3/4 rounded bg-white/5" />
              </div>
            </div>
          </div>
        </div>
      ) : hasMessages ? (
        <>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-8 md:px-8 md:pt-12"
            ref={transcriptRef}
            onScroll={handleTranscriptScroll}
            aria-busy={sending}
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {activeMessages.map((message) => (
                <ChatMessageComponent key={message.id} message={message} />
              ))}
              {sending && (
                <div className="flex justify-start" role="status" aria-label="Lerna is responding">
                  <TypingIndicator />
                </div>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          </div>
          <div className="z-10 shrink-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-[#0a0a0a]/80 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 md:pb-4">
            <div className="mx-auto max-w-3xl">
              {composer}
              <p className="mt-2 text-center text-[11px] text-slate-500">Lerna can make mistakes. Verify important information.</p>
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 md:px-8">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-end pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 md:justify-center md:py-12">
            <h1 className="mb-5 text-center text-2xl font-medium text-white text-balance sm:text-3xl md:mb-7 md:text-4xl">
              Where should we begin?
            </h1>

            {composer}
            <div className="h-[clamp(1rem,7dvh,4rem)] shrink-0 md:hidden" aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}
