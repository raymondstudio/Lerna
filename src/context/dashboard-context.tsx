"use client";

import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { ChatMessage } from "@/lib/chat/types";
import type { StudySessionRecord } from "@/lib/study-sessions/types";
import { DEFAULT_STUDY_SESSION_TITLE } from "@/lib/study-sessions/title";

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

type DashboardContextType = {
  sessions: StudySessionRecord[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  loadingSessions: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  createSession: (firstPrompt?: string) => Promise<StudySessionRecord>;
  deleteSession: (sessionId: string) => Promise<void>;
  upsertSession: (session: StudySessionRecord) => void;
  appendMessage: (sessionId: string, message: ChatMessage) => void;
};

const DashboardContext = createContext<DashboardContextType | null>(null);

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

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const deletedSessionIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!ready || !user) {
      deletedSessionIdsRef.current.clear();
      setSessions([]);
      setActiveSessionId(null);
      setLoadingSessions(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setLoadingSessions(true);
      setError(null);

      try {
        const response = await fetch("/api/study-sessions?summary=true&limit=50", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const payload = (await response.json()) as SessionsApiResponse;

        if (cancelled) return;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || "Unable to load study sessions.");
        }

        const nextSessions = sortSessions(
          (payload.data?.sessions ?? [])
            .map(normalizeSession)
            .filter((session) => !deletedSessionIdsRef.current.has(session.id)),
        );
        setSessions(nextSessions);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load study sessions.");
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    })();

    return () => { cancelled = true; };
  }, [ready, user]);

  const upsertSession = useCallback((session: StudySessionRecord) => {
    const normalizedSession = normalizeSession(session);
    if (deletedSessionIdsRef.current.has(normalizedSession.id)) return;
    setSessions((current) => {
      const withoutCurrent = current.filter((item) => item.id !== normalizedSession.id);
      return sortSessions([normalizedSession, ...withoutCurrent]);
    });
    setActiveSessionId(normalizedSession.id);
  }, []);

  const appendMessage = useCallback((sessionId: string, message: ChatMessage) => {
    setSessions((current) =>
      sortSessions(
        current.map((session) => {
          if (session.id !== sessionId) return session;
          return {
            ...session,
            lastMessage: message.content,
            updatedAt: new Date(message.timestamp).toISOString(),
            messages: [
              ...session.messages,
              {
                id: message.id,
                role: message.role,
                content: message.content,
                createdAt: new Date(message.timestamp).toISOString(),
                sources: message.sources ?? [],
              },
            ],
          };
        })
      )
    );
  }, []);

  const createSession = useCallback(async (firstPrompt = "") => {
    const response = await fetch("/api/study-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstPrompt,
        title: firstPrompt ? undefined : DEFAULT_STUDY_SESSION_TITLE,
      }),
    });

    const payload = (await response.json()) as SessionCreateApiResponse;

    if (!response.ok || !payload.success || !payload.data?.session) {
      throw new Error(payload.error?.message || "Unable to create a study session.");
    }

    const session = payload.data.session;
    upsertSession(session);
    return session;
  }, [upsertSession]);

  const deleteSession = useCallback(async (sessionId: string) => {
    setError(null);
    const response = await fetch(`/api/study-sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { success?: boolean; error?: ApiErrorResponse };

    if (!response.ok || !payload.success) {
      const message = payload.error?.message || "Unable to delete this conversation.";
      setError(message);
      throw new Error(message);
    }

    setSessions((current) => current.filter((session) => session.id !== sessionId));
    deletedSessionIdsRef.current.add(sessionId);
    setActiveSessionId((current) => current === sessionId ? null : current);
  }, []);

  const value = useMemo(
    () => ({
      sessions,
      activeSessionId,
      setActiveSessionId,
      loadingSessions,
      error,
      setError,
      sidebarOpen,
      setSidebarOpen,
      mobileSidebarOpen,
      setMobileSidebarOpen,
      createSession,
      deleteSession,
      upsertSession,
      appendMessage,
    }),
    [sessions, activeSessionId, loadingSessions, error, sidebarOpen, mobileSidebarOpen, createSession, deleteSession, upsertSession, appendMessage]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}
