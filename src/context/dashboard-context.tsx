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

type WireMessage = { id: string; role: "user"|"assistant"; content: string; createdAt?: string; created_at?: string; sources?: ChatMessage["sources"] };
type SessionWire = Omit<Partial<StudySessionRecord>, "messages"> & { id:string;title:string;messages?:WireMessage[];study_messages?:WireMessage[];topic_category?:string;topics_covered?:string[];duration_seconds?:number;last_message?:string;created_at?:string;updated_at?:string;course_id?:string;notes_revision?:number;notes_updated_at?:string };
function normalizeSession(session: SessionWire): StudySessionRecord {
  const messages = Array.isArray(session.messages) ? session.messages : session.study_messages ?? [];
  return {
    id:session.id,title:session.title,topicCategory:session.topicCategory??session.topic_category??"General",
    notes:session.notes,notesRevision:session.notesRevision??session.notes_revision,notesUpdatedAt:session.notesUpdatedAt??session.notes_updated_at,
    courseId:session.courseId??session.course_id,summary:session.summary,
    topicsCovered:session.topicsCovered??session.topics_covered??[],status:session.status,durationSeconds:session.durationSeconds??session.duration_seconds??0,
    lastMessage:session.lastMessage??session.last_message??"",createdAt:session.createdAt??session.created_at??new Date().toISOString(),updatedAt:session.updatedAt??session.updated_at??new Date().toISOString(),
    messages:messages.map(message=>({id:message.id,role:message.role,content:message.content,createdAt:message.createdAt??message.created_at??new Date().toISOString(),sources:message.sources??[]})),
  };
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  // A different identity gets a fresh subtree before its first render: previous
  // titles/messages and pending callbacks never enter the next account's cache.
  return <DashboardSessionProvider key={`${ready}:${user?.id ?? "anonymous"}`} userId={user?.id ?? null} ready={ready}>{children}</DashboardSessionProvider>;
}

function DashboardSessionProvider({ children, userId, ready }: { children: ReactNode; userId: string | null; ready: boolean }) {
  const [sessions, setSessions] = useState<StudySessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(Boolean(ready && userId));
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const deletedSessionIdsRef = useRef(new Set<string>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!ready || !userId) return;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/study-sessions?summary=true&limit=50", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
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

    return () => { cancelled = true; controller.abort(); };
  }, [ready, userId]);

  const upsertSession = useCallback((session: StudySessionRecord) => {
    if (!alive.current) return;
    const normalizedSession = normalizeSession(session);
    if (deletedSessionIdsRef.current.has(normalizedSession.id)) return;
    setSessions((current) => {
      const withoutCurrent = current.filter((item) => item.id !== normalizedSession.id);
      const previous = current.find((item) => item.id === normalizedSession.id);
      // Partial responses from chat must not erase independently persisted note metadata.
      const supplied = Object.fromEntries(Object.entries(session).filter(([, value]) => value !== undefined));
      return sortSessions([normalizeSession({ ...previous, ...normalizedSession, ...supplied,
        notes: session.notes ?? previous?.notes,
        notesRevision: session.notesRevision ?? previous?.notesRevision,
        notesUpdatedAt: session.notesUpdatedAt ?? previous?.notesUpdatedAt,
        summary: session.summary ?? previous?.summary,
      }), ...withoutCurrent]);
    });
    setActiveSessionId(normalizedSession.id);
  }, []);

  const appendMessage = useCallback((sessionId: string, message: ChatMessage) => {
    if (!alive.current) return;
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
    if (!alive.current || !userId) throw new Error("Your account changed. Please try again.");
    const response = await fetch("/api/study-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstPrompt,
        title: firstPrompt ? undefined : DEFAULT_STUDY_SESSION_TITLE,
      }),
    });

    const payload = (await response.json()) as SessionCreateApiResponse;
    if (!alive.current) throw new Error("Your account changed. Reload its conversations.");

    if (!response.ok || !payload.success || !payload.data?.session) {
      throw new Error(payload.error?.message || "Unable to create a study session.");
    }

    const session = payload.data.session;
    upsertSession(session);
    return session;
  }, [upsertSession, userId]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!alive.current || !userId) throw new Error("Your account changed. Please try again.");
    setError(null);
    const response = await fetch(`/api/study-sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { success?: boolean; error?: ApiErrorResponse };
    if (!alive.current) throw new Error("Your account changed. Reload its conversations.");

    if (!response.ok || !payload.success) {
      const message = payload.error?.message || "Unable to delete this conversation.";
      setError(message);
      throw new Error(message);
    }

    setSessions((current) => current.filter((session) => session.id !== sessionId));
    deletedSessionIdsRef.current.add(sessionId);
    setActiveSessionId((current) => current === sessionId ? null : current);
  }, [userId]);

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
