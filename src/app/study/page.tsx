'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  BookOpen,
  Timer,
  NotebookPen,
  Send,
  Trophy,
  Loader2,
  Plus,
  Paperclip,
  FileText,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { UPLOADED_MATERIALS_BUCKET, buildUploadPath, isAllowedUploadMimeType, getAcceptedUploadMimeTypes } from '@/lib/uploads/constants';
import { ChatMessage as ChatMessageComponent } from '@/components/chat/ChatMessage';

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  code: string;
  title: string;
  description?: string;
};

type ChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
};

type Material = {
  id: string;
  file_name: string;
  course_id: string;
  status: string;
};

type Phase = 'setup' | 'active' | 'summary';
type PomodoroMode = 'work' | 'break';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const CIRCLE_RADIUS = 88;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Helper function to dynamically merge Tailwind classes
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PomodoroCircle({
  seconds,
  totalSeconds,
  mode,
  isRunning,
  onPlayPause,
  onStop,
}: {
  seconds: number;
  totalSeconds: number;
  mode: PomodoroMode;
  isRunning: boolean;
  onPlayPause: () => void;
  onStop: () => void;
}) {
  const progress = seconds / totalSeconds;
  const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-3 md:gap-6">
      {/* Mode Label */}
      <div
        className={`px-4 py-1.5 rounded-full text-[10px] md:text-xs font-semibold uppercase tracking-widest ${
          mode === 'work'
            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}
      >
        {mode === 'work' ? 'Focus Work' : 'Short Break'}
      </div>

      {/* SVG Timer Circle */}
      <div className="relative flex items-center justify-center w-36 h-36 md:w-[220px] md:h-[220px]">
        <svg
          viewBox="0 0 220 220"
          className="-rotate-90 w-full h-full"
        >
          {/* Track */}
          <circle
            cx="110"
            cy="110"
            r={CIRCLE_RADIUS}
            fill="none"
            stroke="#ffffff08"
            strokeWidth="10"
          />
          {/* Progress */}
          <circle
            cx="110"
            cy="110"
            r={CIRCLE_RADIUS}
            fill="none"
            stroke={mode === 'work' ? '#06b6d4' : '#10b981'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCLE_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>

        {/* Time Text */}
        <div className="absolute flex flex-col items-center gap-0.5 md:gap-1">
          <span className="text-3xl md:text-5xl font-mono font-bold text-white tracking-tight tabular-nums">
            {formatTime(seconds)}
          </span>
          <span className="text-[9px] md:text-xs text-slate-500 uppercase tracking-widest">
            remaining
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onStop}
          className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-white/10 text-slate-400 hover:bg-[#202020] hover:text-white transition-all text-xs md:text-sm"
        >
          <Square size={13} />
          Reset
        </button>
        <button
          onClick={onPlayPause}
          className={`flex items-center gap-1.5 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-semibold text-xs md:text-sm transition-all ${
            mode === 'work'
              ? 'bg-cyan-500 hover:bg-cyan-400 text-black'
              : 'bg-emerald-500 hover:bg-emerald-400 text-black'
          }`}
        >
          {isRunning ? <Pause size={13} /> : <Play size={13} />}
          {isRunning ? 'Pause' : 'Start'}
        </button>
      </div>
    </div>
  );
}

function TopicTracker({
  topics,
  onAdd,
}: {
  topics: string[];
  onAdd: (topic: string) => void;
}) {
  const [input, setInput] = useState('');

  const handleMark = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setInput('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <BookOpen size={15} className="text-cyan-400" />
        Topic Tracker
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleMark()}
          placeholder="Current topic..."
          className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
        />
        <button
          onClick={handleMark}
          disabled={!input.trim()}
          className="flex items-center gap-1 px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 text-sm hover:bg-cyan-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <Plus size={14} />
          Mark
        </button>
      </div>

      {/* Completed topics */}
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {topics.length === 0 && (
            <p className="text-xs text-slate-600 italic px-1">
              No topics marked yet.
            </p>
          )}
          {topics.map((t, i) => (
            <motion.div
              key={`${t}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 px-3 py-2 bg-[#0a0a0a] rounded-xl border border-white/5"
            >
              <CheckCircle2 size={14} className="text-cyan-500 mt-0.5 shrink-0" />
              <span className="text-sm text-slate-300 leading-tight">{t}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function QuickNotes({
  value,
  onChange,
  isSaved,
}: {
  value: string;
  onChange: (v: string) => void;
  isSaved: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-semibold text-white">
        <span className="flex items-center gap-2">
          <NotebookPen size={15} className="text-cyan-400" />
          Quick Notes
        </span>
        <span className="text-[10px] font-normal text-slate-500 flex items-center gap-1">
          {isSaved ? (
            <>
              <Check size={10} className="text-emerald-500" />
              Saved
            </>
          ) : (
            <>
              <Loader2 size={10} className="animate-spin text-cyan-500" />
              Saving...
            </>
          )}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jot down thoughts, formulas, reminders..."
        rows={6}
        className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none leading-relaxed"
      />
    </div>
  );
}

function InlineChat({
  messages,
  courseId,
  sessionId,
  onNewMessage,
}: {
  messages: ChatMsg[];
  courseId: string;
  sessionId: string;
  onNewMessage: (msg: ChatMsg) => void;
}) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMsg = { id: generateId(), role: 'user', content: trimmed };
    onNewMessage(userMsg);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: Date.now(),
            })),
            {
              id: userMsg.id,
              role: 'user',
              content: trimmed,
              timestamp: Date.now(),
            },
          ],
          sessionId,
          courseId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMsg = {
          id: generateId(),
          role: 'assistant',
          content: data.data?.message?.content ?? data.reply ?? data.message ?? 'I received your message.',
          sources: data.data?.message?.sources ?? []
        };
        onNewMessage(assistantMsg);
      } else {
        onNewMessage({
          id: generateId(),
          role: 'assistant',
          content: "Sorry, I couldn't process that right now. Please try again.",
        });
      }
    } catch {
      onNewMessage({
        id: generateId(),
        role: 'assistant',
        content: 'Network error. Please check your connection.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 px-1 pb-4 min-h-0 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <BookOpen size={20} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">AI Study Assistant</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                Ask anything related to your course. I'm here to help you understand concepts, solve problems, and stay on track.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessageComponent key={msg.id} message={{
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: Date.now(),
            sources: msg.sources ?? []
          }} />
        ))}
        {isSending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-[#1a1a1a] border border-white/5 flex items-center gap-2">
              <Loader2 size={14} className="text-cyan-400 animate-spin" />
              <span className="text-xs text-slate-500">Thinking…</span>
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-white/5 mt-2 shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask a question about this course…"
          rows={2}
          className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
        />
        <button
          onClick={send}
          disabled={!input.trim() || isSending}
          className="self-end px-3 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all h-10 flex items-center justify-center shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Content component ───────────────────────────────────────────────────

function StudyPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySessionId = searchParams.get('session');
  const queryCourseId = searchParams.get('courseId');

  // ── Phase ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('setup');
  const [activeTab, setActiveTab] = useState<'study' | 'notes'>('study');

  // ── Setup ─────────────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // ── Session ───────────────────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ── Pomodoro ──────────────────────────────────────────────────────────────
  const [pomMode, setPomMode] = useState<PomodoroMode>('work');
  const [pomSeconds, setPomSeconds] = useState(WORK_SECONDS);
  const [pomRunning, setPomRunning] = useState(false);
  const pomIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Topics & Notes ────────────────────────────────────────────────────────
  const [topics, setTopics] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  // ── Materials ──────────────────────────────────────────────────────────────
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // ── Summary ───────────────────────────────────────────────────────────────
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);

  // ─── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // ─── Fetch courses & materials ─────────────────────────────────────────────
  const loadSetupData = useCallback(async () => {
    try {
      const [coursesRes, materialsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/materials')
      ]);

      if (coursesRes.ok) {
        const data = await coursesRes.ok ? await coursesRes.json() : { courses: [] };
        const list: Course[] = Array.isArray(data) ? data : data.courses ?? [];
        setCourses(list);
        
        // Select course from query or default
        if (list.length > 0) {
          const match = queryCourseId && list.some(c => c.id === queryCourseId);
          setSelectedCourseId(match ? queryCourseId : list[0].id);
        }
      }

      if (materialsRes.ok) {
        const payload = await materialsRes.json();
        setAllMaterials(payload.data?.materials ?? []);
      }
    } catch (err) {
      console.error("Failed to load setup details", err);
    } finally {
      setCoursesLoading(false);
    }
  }, [queryCourseId]);

  useEffect(() => {
    if (user) {
      loadSetupData();
    }
  }, [user, loadSetupData]);

  // Filter materials for selected course
  const courseMaterials = allMaterials.filter(m => m.course_id === selectedCourseId);

  // ─── Restore active study session from DB ──────────────────────────────────
  useEffect(() => {
    if (!user || !querySessionId) return;

    async function restore() {
      try {
        const res = await fetch(`/api/study-sessions/${querySessionId}`);
        if (res.ok) {
          const payload = await res.json();
          const session = payload.data?.session;
          if (session && session.status !== 'completed') {
            setSessionId(session.id);
            setSelectedCourseId(session.courseId || '');
            setSessionStart(new Date(session.createdAt));
            setElapsedSeconds(session.durationSeconds || 0);
            setTopics(session.topicsCovered || []);
            setNotes(session.notes || '');
            setChatMessages(session.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              sources: m.sources
            })));
            setPhase('active');
          }
        }
      } catch (e) {
        console.error("Failed to restore session state", e);
      }
    }
    restore();
  }, [querySessionId, user]);

  // ─── Debounced notes auto-save ─────────────────────────────────────────────
  const [debouncedNotes, setDebouncedNotes] = useState(notes);

  useEffect(() => {
    if (phase !== 'active') return;
    setNotesSaved(false);
    const handler = setTimeout(() => {
      setDebouncedNotes(notes);
    }, 1500);

    return () => clearTimeout(handler);
  }, [notes, phase]);

  useEffect(() => {
    if (phase === 'active' && sessionId && debouncedNotes !== undefined) {
      fetch(`/api/study-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: debouncedNotes })
      })
      .then(() => setNotesSaved(true))
      .catch(() => {});
    }
  }, [debouncedNotes, sessionId, phase]);

  // ─── Elapsed session timer ─────────────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (phase === 'active' && sessionStart) {
      interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, sessionStart]);

  // ─── Pomodoro tick ─────────────────────────────────────────────────────────
  const advancePomMode = useCallback(() => {
    setPomMode((prev) => {
      const next = prev === 'work' ? 'break' : 'work';
      setPomSeconds(next === 'work' ? WORK_SECONDS : BREAK_SECONDS);
      return next;
    });
  }, []);

  useEffect(() => {
    if (pomRunning) {
      pomIntervalRef.current = setInterval(() => {
        setPomSeconds((prev) => {
          if (prev <= 1) {
            advancePomMode();
            return prev === 1 ? 0 : prev;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (pomIntervalRef.current) clearInterval(pomIntervalRef.current);
    }
    return () => {
      if (pomIntervalRef.current) clearInterval(pomIntervalRef.current);
    };
  }, [pomRunning, advancePomMode]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const startSession = async () => {
    if (!selectedCourseId) return;
    
    try {
      const currentCourse = courses.find((c) => c.id === selectedCourseId);
      const res = await fetch('/api/study-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          title: `Study Session - ${currentCourse?.code || 'General'}`,
          topicCategory: 'General'
        })
      });

      if (res.ok) {
        const payload = await res.json();
        const session = payload.data?.session;
        if (session) {
          router.push(`/study?session=${session.id}`);
          setSessionId(session.id);
          setSessionStart(new Date());
          setElapsedSeconds(0);
          setTopics([]);
          setNotes('');
          setChatMessages([]);
          setPomMode('work');
          setPomSeconds(WORK_SECONDS);
          setPomRunning(false);
          setAiSummary(null);
          setPhase('active');
        }
      }
    } catch (e) {
      console.error("Failed to start study session", e);
    }
  };

  const endSession = async () => {
    if (!sessionId) return;
    setPomRunning(false);
    const duration = elapsedSeconds;
    setTotalDuration(duration);
    setPhase('summary');
    setSummaryLoading(true);

    try {
      // 1. Save final stats (duration, topics, completed status)
      await fetch(`/api/study-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: duration,
          topicsCovered: topics,
          status: 'completed'
        })
      });

      // 2. Fetch AI-generated summary
      const summaryRes = await fetch(`/api/study-sessions/${sessionId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (summaryRes.ok) {
        const payload = await summaryRes.json();
        setAiSummary(payload.data?.summary ?? "Unable to compile session details.");
      } else {
        throw new Error("Summary generation failed.");
      }
    } catch (err) {
      setAiSummary(
        `Great session! You covered ${topics.length} topic${topics.length !== 1 ? 's' : ''} over ${formatDuration(duration)}. ` +
        `Your notes have been saved. Review your progress and continue studying to build momentum!`
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  const resetToSetup = () => {
    setPomRunning(false);
    setPhase('setup');
    setSessionId(null);
    setElapsedSeconds(0);
    setTopics([]);
    setNotes('');
    setChatMessages([]);
    setAiSummary(null);
    setPomMode('work');
    setPomSeconds(WORK_SECONDS);
    router.push('/study');
  };

  const addTopic = async (t: string) => {
    const nextTopics = [...topics, t];
    setTopics(nextTopics);
    // Explicitly update topics list in DB
    if (sessionId) {
      await fetch(`/api/study-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicsCovered: nextTopics })
      });
    }
  };

  const addChatMsg = (msg: ChatMsg) => setChatMessages((prev) => [...prev, msg]);

  const handleSidebarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCourseId) return;

    if (!isAllowedUploadMimeType(file.type)) {
      alert("Invalid file type. Please upload a PDF or Word document.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error('Supabase client not initialized');
      
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;
      if (!userId) throw new Error('User not authenticated');

      const storagePath = buildUploadPath(userId, selectedCourseId, file.name);
      
      // Upload to bucket
      const { error: uploadError } = await supabase.storage.from(UPLOADED_MATERIALS_BUCKET).upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      // Insert Row
      const { data: insertedRow, error: insertError } = await supabase.from('uploaded_materials').insert({
        user_id: userId,
        course_id: selectedCourseId,
        session_id: sessionId, // associate with active session if possible
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        storage_path: storagePath,
      }).select('id, file_name, course_id, status').single();

      if (insertError) throw insertError;

      // Add to local state
      setAllMaterials((prev) => [insertedRow, ...prev]);

      // Process document in background
      fetch(`/api/materials/${insertedRow.id}/process`, { method: "POST" }).catch(() => {});

    } catch (err) {
      console.error("Document upload failed", err);
      alert("Failed to upload document. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewMaterial = async (matId: string) => {
    try {
      const res = await fetch(`/api/materials/${matId}/view`, { method: "POST" });
      const payload = await res.json();
      if (payload.success && payload.data?.signedUrl) {
        window.open(payload.data.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        alert("Failed to retrieve document view link.");
      }
    } catch (e) {
      alert("Could not open preview for this file.");
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={28} className="text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardShell>
      <div className="h-full w-full flex flex-col min-h-0 bg-[#0a0a0a] text-white">
        <AnimatePresence mode="wait">
        {/* ═══════════════════════════════ SETUP PHASE ══════════════════════════ */}
        {phase === 'setup' && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="h-full w-full flex items-center justify-center overflow-y-auto px-4 py-8"
          >
            <div className="w-full max-w-md">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="flex justify-center mb-8"
              >
                <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Timer size={36} className="text-cyan-400" />
                </div>
              </motion.div>

              <h1 className="text-3xl font-bold text-center mb-2 tracking-tight">
                Study Session
              </h1>
              <p className="text-slate-400 text-center text-sm mb-10 leading-relaxed">
                Choose a course and start a focused Pomodoro session with AI assistance.
              </p>

              {/* Card */}
              <div className="bg-[#141414] border border-white/5 rounded-3xl p-8 flex flex-col gap-6">
                {/* Course picker */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-300">
                    Select Course
                  </label>
                  {coursesLoading ? (
                    <div className="w-full h-11 bg-white/5 animate-pulse rounded-xl border border-white/5" />
                  ) : courses.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">
                      No courses found. Please enroll in a course first.
                    </p>
                  ) : (
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none cursor-pointer"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Session info */}
                <div className="flex flex-col gap-2 px-4 py-3 bg-[#0a0a0a] rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Work interval</span>
                    <span className="text-slate-300 font-medium">25 minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Break interval</span>
                    <span className="text-slate-300 font-medium">5 minutes</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>AI assistance</span>
                    <span className="text-cyan-400 font-medium">Enabled</span>
                  </div>
                </div>

                {/* Start button */}
                <button
                  onClick={startSession}
                  disabled={!selectedCourseId || coursesLoading}
                  className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/30 disabled:cursor-not-allowed text-black font-semibold rounded-2xl transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  Start Session
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════ ACTIVE SESSION ══════════════════════════ */}
        {phase === 'active' && sessionId && (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full flex flex-col min-h-0 overflow-hidden"
          >
            {/* ── Header ── */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#141414] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Timer size={15} className="text-cyan-400" />
                </div>
                {selectedCourse && (
                  <div className="px-3 py-1 bg-[#0a0a0a] border border-white/10 rounded-full text-xs font-medium text-slate-300">
                    {selectedCourse.code} · {selectedCourse.title}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* Elapsed */}
                <div className="flex items-center gap-2 text-sm text-slate-400 font-mono">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                  {formatTime(elapsedSeconds)}
                </div>

                {/* End Session */}
                <button
                  onClick={endSession}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
                >
                  <Square size={14} />
                  End Session
                </button>
              </div>
            </header>

            {/* Mobile Tab Switcher */}
            <div className="flex lg:hidden border-b border-white/5 bg-[#141414] shrink-0">
              <button
                onClick={() => setActiveTab('study')}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'study'
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Focus & Assistant
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'notes'
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Notes & Tracker
              </button>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* ── Left/Main Panel ── */}
              <div className={cn(
                "flex-1 flex flex-col md:flex-row overflow-hidden min-w-0 bg-[#0a0a0a]",
                activeTab === 'study' ? "flex" : "hidden lg:flex"
              )}>
                {/* Pomodoro */}
                <div className="flex justify-center items-center py-4 md:py-8 px-4 md:px-6 border-b md:border-b-0 md:border-r border-white/5 shrink-0 bg-[#0c0c0c] w-full md:w-80">
                  <PomodoroCircle
                    seconds={pomSeconds}
                    totalSeconds={pomMode === 'work' ? WORK_SECONDS : BREAK_SECONDS}
                    mode={pomMode}
                    isRunning={pomRunning}
                    onPlayPause={() => setPomRunning((p) => !p)}
                    onStop={() => {
                      setPomRunning(false);
                      setPomMode('work');
                      setPomSeconds(WORK_SECONDS);
                    }}
                  />
                </div>

                {/* Inline Chat */}
                <div className="flex-1 flex flex-col overflow-hidden px-4 md:px-6 pt-5 pb-4 min-h-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white mb-4 shrink-0">
                    <BookOpen size={15} className="text-cyan-400" />
                    AI Study Assistant
                    {selectedCourse && (
                      <span className="text-xs text-slate-500 font-normal">
                        — scoped to {selectedCourse.code}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <InlineChat
                      messages={chatMessages}
                      courseId={selectedCourseId}
                      sessionId={sessionId}
                      onNewMessage={addChatMsg}
                    />
                  </div>
                </div>
              </div>

              {/* ── Right Sidebar ── */}
              <aside className={cn(
                "w-full lg:w-80 shrink-0 bg-[#141414] border-l border-white/5 flex flex-col gap-6 p-5 overflow-y-auto scrollbar-thin",
                activeTab === 'notes' ? "flex" : "hidden lg:flex"
              )}>
                <TopicTracker topics={topics} onAdd={addTopic} />
                <div className="border-t border-white/5" />
                <QuickNotes value={notes} onChange={setNotes} isSaved={notesSaved} />
                <div className="border-t border-white/5" />
                
                {/* Course Materials List */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-white">
                    <span className="flex items-center gap-2">
                      <Paperclip size={15} className="text-cyan-400" />
                      Course Materials
                    </span>
                    {selectedCourseId && (
                      <label className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer">
                        <Plus size={12} />
                        Upload
                        <input
                          type="file"
                          accept={getAcceptedUploadMimeTypes()}
                          onChange={handleSidebarUpload}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                    )}
                  </div>
                  {isUploading && (
                    <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-500/5 border border-cyan-500/10 rounded-xl px-3 py-2">
                      <Loader2 size={12} className="animate-spin" />
                      Uploading document...
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {courseMaterials.length === 0 ? (
                      <p className="text-xs text-slate-600 italic px-1">
                        No materials uploaded for this course.
                      </p>
                    ) : (
                      courseMaterials.map((mat) => (
                        <div
                          key={mat.id}
                          onClick={() => handleViewMaterial(mat.id)}
                          className="flex items-center justify-between px-3 py-2 bg-[#0a0a0a] rounded-xl border border-white/5 hover:border-white/10 cursor-pointer group/item transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText size={14} className="text-slate-500 group-hover/item:text-cyan-400 shrink-0" />
                            <span className="text-xs text-slate-300 truncate leading-none">{mat.file_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-600 group-hover/item:text-cyan-400 shrink-0 capitalize">{mat.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════ POST-SESSION SUMMARY ══════════════════════ */}
        {phase === 'summary' && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="h-full w-full overflow-y-auto flex items-start justify-center px-4 py-16 scrollbar-hide"
          >
            <div className="w-full max-w-2xl flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col items-center gap-4 text-center mb-2">
                <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Trophy size={28} className="text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Session Complete!</h1>
                  <p className="text-slate-400 text-sm mt-1">
                    Here's a summary of your study session.
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Duration',
                    value: formatDuration(totalDuration),
                    icon: Timer,
                  },
                  {
                    label: 'Topics Covered',
                    value: topics.length.toString(),
                    icon: CheckCircle2,
                  },
                  {
                    label: 'Notes Taken',
                    value: notes.trim() ? 'Yes' : 'None',
                    icon: NotebookPen,
                  },
                ].map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="bg-[#141414] border border-white/5 rounded-2xl px-4 py-4 flex flex-col gap-1"
                  >
                    <Icon size={16} className="text-cyan-400 mb-1" />
                    <span className="text-lg font-bold text-white">{value}</span>
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                ))}
              </div>

              {/* Topics list */}
              {topics.length > 0 && (
                <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <BookOpen size={14} className="text-cyan-400" />
                    Topics Covered
                  </h2>
                  <div className="flex flex-col gap-2">
                    {topics.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-slate-300"
                      >
                        <CheckCircle2 size={13} className="text-cyan-500 shrink-0" />
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick notes */}
              {notes.trim() && (
                <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <NotebookPen size={14} className="text-cyan-400" />
                    Your Notes
                  </h2>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {notes}
                  </p>
                </div>
              )}

              {/* AI Summary */}
              <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BookOpen size={14} className="text-cyan-400" />
                  AI Session Summary
                </h2>
                <AnimatePresence mode="wait">
                  {summaryLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3 animate-pulse py-3"
                    >
                      <div className="h-4 bg-white/10 rounded w-full" />
                      <div className="h-4 bg-white/5 rounded w-5/6" />
                      <div className="h-4 bg-white/5 rounded w-2/3" />
                    </motion.div>
                  ) : (
                    <motion.p
                      key="summary"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap"
                    >
                      {aiSummary}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={resetToSetup}
                  className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-2xl transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Play size={15} />
                  Start New Session
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-[#141414] border border-white/10 text-slate-300 hover:bg-[#202020] hover:text-white rounded-2xl transition-all text-sm font-medium"
                >
                  Dashboard
                </button>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={28} className="text-cyan-500 animate-spin" />
      </div>
    }>
      <StudyPageContent />
    </Suspense>
  );
}
