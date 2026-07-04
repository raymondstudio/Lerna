'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Zap,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  Trophy,
  Target,
  Loader2,
  BookOpen,
  History,
  ArrowLeft,
  ChevronLeft,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { DashboardShell } from '@/components/layout/DashboardShell';

type QuizType = 'mcq' | 'flashcard' | 'short_answer';
type Phase = 'setup' | 'quiz' | 'results' | 'review';

interface Course {
  id: string;
  title: string;
  code: string;
}

interface Material {
  id: string;
  file_name: string;
  course_id: string;
  status: string;
}

interface Question {
  id: string;
  question: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  topic?: string;
}

interface AnswerRecord {
  questionId: string;
  correct: boolean;
  question: Question;
}

interface PastQuiz {
  id: string;
  title: string;
  score: number;
  total_questions: number;
  created_at: string;
  course_id: string | null;
  courses?: {
    code: string;
    title: string;
  } | null;
}

interface ReviewQuestion {
  id: string;
  questionText: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  userAnswer?: string;
  isCorrect: boolean;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 mb-2">
        <span>
          Question {current} of {total}
        </span>
        <span>{pct}% complete</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-cyan-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function MCQQuestion({
  question,
  onAnswer,
}: {
  question: Question;
  onAnswer: (correct: boolean, selectedOption: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const handleSelect = (option: string) => {
    if (revealed) return;
    setSelected(option);
    setRevealed(true);
    onAnswer(option === question.correct_answer, option);
  };

  const getOptionStyle = (option: string) => {
    if (!revealed) {
      return 'bg-[#1c1f26] border border-white/10 hover:border-cyan-500/40 hover:bg-[#202020] cursor-pointer';
    }
    if (option === question.correct_answer) {
      return 'bg-green-500/20 border border-green-500/50 cursor-default';
    }
    if (option === selected && option !== question.correct_answer) {
      return 'bg-red-500/20 border border-red-500/50 cursor-default';
    }
    return 'bg-[#1c1f26] border border-white/5 opacity-50 cursor-default';
  };

  const labels = ['A', 'B', 'C', 'D'];

  return (
    <div className="space-y-3">
      {(question.options ?? []).map((option, i) => (
        <button
          key={option}
          onClick={() => handleSelect(option)}
          className={`w-full flex items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-all duration-200 ${getOptionStyle(option)}`}
        >
          <span className="flex-shrink-0 w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-xs font-semibold text-slate-400">
            {labels[i]}
          </span>
          <span className="text-sm text-slate-200 leading-relaxed">
            {option}
          </span>
          {revealed && option === question.correct_answer && (
            <CheckCircle2 className="ml-auto flex-shrink-0 h-4 w-4 text-green-400 mt-0.5" />
          )}
          {revealed && option === selected && option !== question.correct_answer && (
            <XCircle className="ml-auto flex-shrink-0 h-4 w-4 text-red-400 mt-0.5" />
          )}
        </button>
      ))}
      {revealed && question.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 px-4 py-3"
        >
          <p className="text-xs font-medium text-cyan-400 mb-1">Explanation</p>
          <p className="text-sm text-slate-300 leading-relaxed">
            {question.explanation}
          </p>
        </motion.div>
      )}
    </div>
  );
}

function FlashcardQuestion({
  question,
  onAnswer,
}: {
  question: Question;
  onAnswer: (correct: boolean, selectedOption: string) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);

  const handleFlip = () => {
    if (!answered) setFlipped(true);
  };

  const handleAnswer = (correct: boolean) => {
    setAnswered(true);
    onAnswer(correct, correct ? question.correct_answer : 'Self-marked incorrect');
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="w-full max-w-xl h-60 cursor-pointer"
        style={{ perspective: '1200px' }}
        onClick={handleFlip}
      >
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.55, ease: 'easeInOut' }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-[#141414] border border-white/10 px-8 py-6 text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <BookOpen className="h-6 w-6 text-cyan-500 mb-4 opacity-60" />
            <p className="text-lg font-medium text-white leading-relaxed">
              {question.question}
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Click to reveal answer
            </p>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-[#1c2333] border border-cyan-500/20 px-8 py-6 text-center"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <CheckCircle2 className="h-6 w-6 text-cyan-400 mb-4 opacity-70" />
            <p className="text-base text-slate-200 leading-relaxed font-semibold">
              {question.correct_answer}
            </p>
            {question.explanation && (
              <p className="mt-3 text-xs text-slate-400 leading-relaxed max-w-sm">
                {question.explanation}
              </p>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {flipped && !answered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex gap-3"
          >
            <button
              onClick={() => handleAnswer(false)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Still learning
            </button>
            <button
              onClick={() => handleAnswer(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/25 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              Know it!
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShortAnswerQuestion({
  question,
  onAnswer,
}: {
  question: Question;
  onAnswer: (correct: boolean, textAnswer: string) => void;
}) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = () => {
    if (!value.trim() || submitted) return;
    const correct = value.trim().toLowerCase() === question.correct_answer.trim().toLowerCase() || value.trim().length > 0;
    setIsCorrect(correct);
    setSubmitted(true);
    onAnswer(correct, value.trim());
  };

  return (
    <div className="space-y-4">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={submitted}
        placeholder="Type your answer here…"
        rows={4}
        className="w-full resize-none rounded-xl bg-[#1c1f26] border border-white/10 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors disabled:opacity-60"
      />
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 text-black font-medium text-sm hover:bg-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Zap className="h-4 w-4" />
          Submit Answer
        </button>
      )}
      {submitted && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 ${isCorrect ? 'bg-green-500/15 border border-green-500/30' : 'bg-red-500/15 border border-red-500/30'}`}
          >
            {isCorrect ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-sm text-green-300 font-medium">
                  Answer submitted
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm text-red-300 font-medium">
                  No answer provided
                </span>
              </>
            )}
          </div>
          <div className="rounded-xl bg-[#1c1f26] border border-white/5 px-4 py-3">
            <p className="text-xs text-slate-400 mb-1">Correct answer</p>
            <p className="text-sm text-slate-200 leading-relaxed font-semibold">
              {question.correct_answer}
            </p>
          </div>
          {question.explanation && (
            <div className="rounded-xl bg-cyan-500/5 border border-cyan-500/20 px-4 py-3">
              <p className="text-xs font-medium text-cyan-400 mb-1">
                Explanation
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {question.explanation}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── Main Content Component ──────────────────────────────────────────────────

function QuizPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryCourseId = searchParams.get('courseId');
  const queryMaterialId = searchParams.get('materialId');

  // Tabs / Phases
  const [setupTab, setSetupTab] = useState<'create' | 'history'>('create');
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup state
  const [courses, setCourses] = useState<Course[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [quizType, setQuizType] = useState<QuizType>('mcq');
  const [questionCount, setQuestionCount] = useState<number>(5);

  // Active quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [currentAnswered, setCurrentAnswered] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<{ correct: boolean; selection: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Previous quizzes list & review state
  const [pastQuizzes, setPastQuizzes] = useState<PastQuiz[]>([]);
  const [loadingPastQuizzes, setLoadingPastQuizzes] = useState(false);
  const [selectedPastQuiz, setSelectedPastQuiz] = useState<PastQuiz | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);

  // Last recorded user answer option/text
  const [lastUserAnswerVal, setLastUserAnswerVal] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);

  // ─── Fetch courses & materials ─────────────────────────────────────────────
  const fetchSetupData = useCallback(async () => {
    try {
      const [coursesRes, materialsRes] = await Promise.all([
        fetch('/api/courses'),
        fetch('/api/materials'),
      ]);

      if (coursesRes.ok) {
        const data = await coursesRes.json();
        const list: Course[] = data.data?.courses ?? data.courses ?? [];
        setCourses(list);

        // Preselect course from query
        if (list.length > 0) {
          const match = queryCourseId && list.some(c => c.id === queryCourseId);
          setSelectedCourseId(match ? queryCourseId : '');
        }
      }

      if (materialsRes.ok) {
        const payload = await materialsRes.json();
        const list: Material[] = payload.data?.materials ?? payload.materials ?? [];
        setMaterials(list);

        // Preselect material from query
        if (list.length > 0 && queryMaterialId) {
          const mat = list.find(m => m.id === queryMaterialId);
          if (mat) {
            setSelectedMaterialId(mat.id);
            setSelectedCourseId(mat.course_id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load setup details', e);
    }
  }, [queryCourseId, queryMaterialId]);

  useEffect(() => {
    if (user) {
      fetchSetupData();
    }
  }, [user, fetchSetupData]);

  // ─── Fetch Past Quizzes ────────────────────────────────────────────────────
  const fetchPastQuizzes = useCallback(async () => {
    if (!user) return;
    setLoadingPastQuizzes(true);
    try {
      const res = await fetch('/api/quiz');
      const payload = await res.json();
      if (payload.success) {
        setPastQuizzes(payload.data.quizzes || []);
      }
    } catch (e) {
      console.error('Failed to fetch past quizzes', e);
    } finally {
      setLoadingPastQuizzes(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && setupTab === 'history') {
      fetchPastQuizzes();
    }
  }, [user, setupTab, fetchPastQuizzes]);

  // Filter materials based on selected course
  const filteredMaterials = selectedCourseId
    ? materials.filter(m => m.course_id === selectedCourseId && m.status === 'ready')
    : materials.filter(m => m.status === 'ready');

  // ─── Generate quiz ────────────────────────────────────────────────────────
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || generating) return;
    setSetupError(null);
    setGenerating(true);

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId || null,
          materialId: selectedMaterialId || null,
          count: questionCount,
          type: quizType,
        }),
      });

      const payload = await res.json();
      if (res.ok && payload.success && Array.isArray(payload.data?.questions)) {
        const qs = payload.data.questions.map((q: any, idx: number) => ({
          id: `q-${idx}`,
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          topic: q.topic || 'General',
        }));
        startQuiz(qs);
        return;
      }
    } catch (e) {
      console.warn('AI Quiz generation failed, falling back to course content.', e);
    } finally {
      setGenerating(false);
    }
    setSetupError('Unable to generate AI quiz questions. Please check that you selected a course or material with text chunks.');
  };

  const startQuiz = (qs: Question[]) => {
    setQuestions(qs);
    setCurrentIndex(0);
    setAnswers([]);
    setCurrentAnswered(false);
    setCurrentAnswer(null);
    setStartTime(Date.now());
    setPhase('quiz');
  };

  // ─── Handle answer recording ──────────────────────────────────────────────
  const handleAnswer = (correct: boolean, selection: string) => {
    if (currentAnswered) return;
    setLastUserAnswerVal(selection);
    setCurrentAnswered(true);
    setCurrentAnswer({ correct, selection });
  };

  const handleNext = async () => {
    if (!currentAnswer) return;

    const newAnswerRecord = {
      questionId: questions[currentIndex].id,
      correct: currentAnswer.correct,
      question: questions[currentIndex],
    };

    const updatedAnswers = [...answers, newAnswerRecord];
    setAnswers(updatedAnswers);
    setCurrentAnswer(null);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setCurrentAnswered(false);
    } else {
      setPhase('results');
      // Save quiz results to PostgreSQL database
      try {
        const scoreCount = updatedAnswers.filter((a) => a.correct).length;
        const accuracyPct = Math.round((scoreCount / questions.length) * 100);

        const currentCourse = courses.find((c) => c.id === selectedCourseId);
        const title = `Quiz — ${currentCourse ? currentCourse.code : 'General Knowledge'} (${new Date().toLocaleDateString()})`;
        const timeSpent = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;

        await fetch('/api/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: selectedCourseId || null,
            materialId: selectedMaterialId || null,
            title,
            score: accuracyPct,
            totalQuestions: questions.length,
            type: quizType,
            timeSpent,
            difficulty: 'Medium',
            topic: questions[0]?.topic || 'General',
            questions: updatedAnswers.map((a, idx) => ({
              questionText: a.question.question,
              options: a.question.options || [],
              correctAnswer: a.question.correct_answer,
              explanation: a.question.explanation,
              userAnswer: idx === currentIndex ? lastUserAnswerVal : 'Answered', // fallback or track options
              isCorrect: a.correct,
            })),
          }),
        });
      } catch (err) {
        console.error('Failed to save quiz results to database', err);
      }
    }
  };

  // ─── Results helpers ──────────────────────────────────────────────────────
  const correctCount = answers.filter((a) => a.correct).length;
  const accuracy = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;
  const weakQuestions = answers.filter((a) => !a.correct).map((a) => a.question);

  const handleRetryWrong = () => {
    if (weakQuestions.length === 0) return;
    const qs = weakQuestions.map((q, i) => ({ ...q, id: `retry-${i}-${Date.now()}` }));
    startQuiz(qs);
  };

  const handleNewQuiz = () => {
    setPhase('setup');
    setQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setCurrentAnswered(false);
    setCurrentAnswer(null);
  };

  // ─── Review Past Quiz ──────────────────────────────────────────────────────
  const handleReviewQuiz = async (quiz: PastQuiz) => {
    setSelectedPastQuiz(quiz);
    setLoadingReview(true);
    setPhase('review');
    try {
      const res = await fetch(`/api/quiz/${quiz.id}`);
      if (res.ok) {
        const payload = await res.json();
        setReviewQuestions(payload.data?.questions ?? []);
      }
    } catch (e) {
      console.error('Failed to fetch past quiz details', e);
    } finally {
      setLoadingReview(false);
    }
  };

  const getAccuracyColor = (acc: number) =>
    acc >= 80 ? 'text-green-400' : acc >= 50 ? 'text-cyan-400' : 'text-red-400';

  return (
    <DashboardShell>
      <div className="h-full overflow-y-auto bg-[#0a0a0a] font-body text-white">
        {/* Header */}
        <div className="border-b border-white/5 bg-[#141414] shrink-0 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <Brain className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-base font-semibold leading-none text-white">
                  AI Quiz Workspace
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Powered by Gemini & Elasticsearch</p>
              </div>
            </div>

            {phase === 'setup' && (
              <div className="flex bg-[#0a0a0a] border border-white/10 rounded-xl p-0.5">
                <button
                  onClick={() => setSetupTab('create')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    setupTab === 'create'
                      ? 'bg-cyan-500 text-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Quiz
                </button>
                <button
                  onClick={() => setSetupTab('history')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    setupTab === 'history'
                      ? 'bg-cyan-500 text-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History size={12} />
                  History
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-10">
          <AnimatePresence mode="wait">
            {/* ════════════════════════════ SETUP PHASE ══════════════════════════ */}
            {phase === 'setup' && setupTab === 'create' && (
              <motion.div
                key="setup-create"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Create a Practice Quiz</h2>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                    Test your understanding by generating quizzes scoped directly to your course or materials.
                  </p>
                </div>

                <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
                  {/* Select Course */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Target Course
                    </label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => {
                        setSelectedCourseId(e.target.value);
                        setSelectedMaterialId('');
                      }}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="">— Use general knowledge —</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Study Material */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Study Material (PDF/Word)
                    </label>
                    <select
                      value={selectedMaterialId}
                      onChange={(e) => setSelectedMaterialId(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none cursor-pointer disabled:opacity-50"
                      disabled={!selectedCourseId}
                    >
                      <option value="">— Entire Course curriculum —</option>
                      {filteredMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.file_name}
                        </option>
                      ))}
                    </select>
                    {!selectedCourseId && (
                      <p className="text-[10px] text-slate-500">
                        Please select a Target Course first to filter study materials.
                      </p>
                    )}
                  </div>

                  {/* Quiz Type */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Quiz Format
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { value: 'mcq', label: 'MCQ', desc: 'Multiple choices', icon: Target },
                          { value: 'flashcard', label: 'Flashcard', desc: 'Active recall', icon: BookOpen },
                          { value: 'short_answer', label: 'Written', desc: 'Model checking', icon: Zap },
                        ] as const
                      ).map(({ value, label, desc, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setQuizType(value)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                            quizType === value
                              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                              : 'bg-[#0a0a0a] border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <Icon size={16} className="mb-1" />
                          <span className="text-xs font-semibold">{label}</span>
                          <span className="text-[10px] opacity-60 mt-0.5">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Count */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Question Count
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 10, 15].map((count) => (
                        <button
                          key={count}
                          onClick={() => setQuestionCount(count)}
                          className={`py-2.5 rounded-xl border transition-all text-xs font-medium ${
                            questionCount === count
                              ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                              : 'bg-[#0a0a0a] border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          {count} Questions
                        </button>
                      ))}
                    </div>
                  </div>

                  {setupError && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2">
                      <AlertCircle size={13} className="shrink-0" />
                      {setupError}
                    </div>
                  )}

                  {/* Generate Trigger */}
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Analyzing text & writing quiz…
                      </>
                    ) : (
                      <>
                        <Brain size={16} />
                        Generate AI Quiz
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════ SETUP HISTORY ══════════════════════════ */}
            {phase === 'setup' && setupTab === 'history' && (
              <motion.div
                key="setup-history"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Quiz History</h2>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                    Review your performance and track learning improvements over time.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {loadingPastQuizzes ? (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-[72px] w-full bg-[#141414] border border-white/5 rounded-2xl animate-pulse flex items-center justify-between p-4">
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-white/10 rounded w-1/3" />
                            <div className="h-3 bg-white/5 rounded w-1/6" />
                          </div>
                          <div className="h-8 w-16 bg-white/10 rounded-lg shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : pastQuizzes.length === 0 ? (
                    <div className="text-center py-16 bg-[#141414] border border-white/5 rounded-2xl text-slate-500 text-sm">
                      No quiz results found. Generate and complete a quiz to begin tracking history!
                    </div>
                  ) : (
                    pastQuizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        onClick={() => handleReviewQuiz(quiz)}
                        className="flex items-center justify-between p-4 bg-[#141414] border border-white/5 hover:border-white/10 rounded-2xl cursor-pointer transition-all group"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
                            {quiz.title}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            {quiz.courses && (
                              <span className="px-2 py-0.5 bg-[#0a0a0a] rounded text-[10px] text-slate-400">
                                {quiz.courses.code}
                              </span>
                            )}
                            <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="flex flex-col items-end">
                            <span className={`text-base font-bold ${getAccuracyColor(quiz.score)}`}>
                              {quiz.score}%
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {quiz.total_questions} questions
                            </span>
                          </div>
                          <ChevronRight size={16} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════ ACTIVE QUIZ ══════════════════════════ */}
            {phase === 'quiz' && questions.length > 0 && (
              <motion.div
                key={`quiz-active-${currentIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Progress bar */}
                <ProgressBar current={currentIndex + 1} total={questions.length} />

                {/* Question block */}
                <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
                  {questions[currentIndex].topic && (
                    <span className="inline-block px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-semibold uppercase tracking-wider rounded-full">
                      {questions[currentIndex].topic}
                    </span>
                  )}
                  <h3 className="text-lg font-medium leading-relaxed text-white">
                    {questions[currentIndex].question}
                  </h3>

                  {/* Render based on format */}
                  {quizType === 'mcq' && (
                    <MCQQuestion
                      key={`mcq-${currentIndex}`}
                      question={questions[currentIndex]}
                      onAnswer={handleAnswer}
                    />
                  )}
                  {quizType === 'flashcard' && (
                    <FlashcardQuestion
                      key={`fc-${currentIndex}`}
                      question={questions[currentIndex]}
                      onAnswer={handleAnswer}
                    />
                  )}
                  {quizType === 'short_answer' && (
                    <ShortAnswerQuestion
                      key={`sa-${currentIndex}`}
                      question={questions[currentIndex]}
                      onAnswer={handleAnswer}
                    />
                  )}
                </div>

                {/* Footer buttons */}
                {currentAnswered && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-end"
                  >
                    <button
                      onClick={handleNext}
                      className="flex items-center gap-1.5 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl transition-all text-sm"
                    >
                      {currentIndex < questions.length - 1 ? (
                        <>
                          Next Question
                          <ChevronRight size={14} />
                        </>
                      ) : (
                        <>
                          View Results
                          <Trophy size={14} />
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ════════════════════════════ RESULTS VIEW ══════════════════════════ */}
            {phase === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Result Hero */}
                <div className="bg-[#141414] border border-white/5 rounded-2xl p-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                    <Trophy size={28} className="text-cyan-400" />
                  </div>
                  <span className="text-slate-500 text-xs uppercase tracking-widest font-semibold">Quiz Complete</span>
                  <span className={`text-6xl font-black mt-2 font-heading tracking-tight ${getAccuracyColor(accuracy)}`}>
                    {accuracy}%
                  </span>
                  <span className="text-slate-400 text-sm mt-2">
                    You got {correctCount} correct out of {questions.length} questions
                  </span>
                </div>

                {/* Missed questions review */}
                {weakQuestions.length > 0 && (
                  <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-white/5 pb-3">
                      <XCircle size={15} className="text-red-400" />
                      Missed Questions
                    </h3>
                    <div className="flex flex-col gap-3">
                      {weakQuestions.map((q, idx) => (
                        <div key={q.id} className="p-4 bg-[#0a0a0a] border border-white/5 rounded-xl space-y-2">
                          <div className="flex items-start gap-2.5">
                            <span className="text-xs text-slate-500 font-semibold mt-0.5">{idx + 1}.</span>
                            <div className="space-y-1">
                              <span className="text-xs text-red-400 font-semibold">{q.topic || 'Incorrect'}</span>
                              <p className="text-sm text-slate-300 leading-relaxed font-medium">{q.question}</p>
                            </div>
                          </div>
                          <div className="pl-6 text-xs border-l border-white/5 space-y-1">
                            <p className="text-slate-500">Correct Answer: <span className="text-slate-300 font-medium">{q.correct_answer}</span></p>
                            {q.explanation && (
                              <p className="text-slate-500 mt-1 leading-relaxed">
                                <span className="text-cyan-400 font-semibold block text-[10px] uppercase">Explanation</span>
                                {q.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  {weakQuestions.length > 0 && (
                    <button
                      onClick={handleRetryWrong}
                      className="flex-1 py-3 bg-[#141414] border border-white/10 hover:bg-[#202020] text-slate-300 rounded-xl transition-all text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={15} className="text-cyan-400" />
                      Retry Incorrect ({weakQuestions.length})
                    </button>
                  )}
                  <button
                    onClick={handleNewQuiz}
                    className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Brain size={15} />
                    Start New Quiz
                  </button>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════ REVIEW PHASE ══════════════════════════ */}
            {phase === 'review' && selectedPastQuiz && (
              <motion.div
                key="review"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Back button */}
                <button
                  onClick={() => {
                    setPhase('setup');
                    setSetupTab('history');
                  }}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors uppercase tracking-wider"
                >
                  <ChevronLeft size={16} />
                  Back to History
                </button>

                {/* Quiz Summary card */}
                <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 flex justify-between items-center">
                  <div className="space-y-1.5 min-w-0">
                    <h2 className="text-lg font-bold text-white truncate leading-tight">
                      {selectedPastQuiz.title}
                    </h2>
                    {selectedPastQuiz.courses && (
                      <span className="inline-block px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-semibold uppercase tracking-wider rounded-full">
                        {selectedPastQuiz.courses.code} · {selectedPastQuiz.courses.title}
                      </span>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-3xl font-black ${getAccuracyColor(selectedPastQuiz.score)}`}>
                      {selectedPastQuiz.score}%
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Accuracy Score
                    </p>
                  </div>
                </div>

                {/* Review Questions list */}
                {loadingReview ? (
                  <div className="flex flex-col gap-4 animate-pulse">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] space-y-3">
                        <div className="h-3 w-16 bg-white/10 rounded" />
                        <div className="h-4 bg-white/10 rounded w-5/6" />
                        <div className="h-3 bg-white/5 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {reviewQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        className={`p-5 rounded-2xl border ${
                          q.isCorrect
                            ? 'bg-green-500/5 border-green-500/20'
                            : 'bg-red-500/5 border-red-500/20'
                        } space-y-4`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-xs text-slate-500 font-semibold mt-0.5">{idx + 1}.</span>
                          <div className="space-y-1">
                            <span className={`text-[10px] font-semibold uppercase tracking-wide ${q.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                              {q.isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                            <p className="text-sm font-semibold text-slate-200 leading-relaxed">
                              {q.questionText}
                            </p>
                          </div>
                        </div>

                        {/* Options rendered if MCQ */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 pl-5">
                            {q.options.map((option) => {
                              const isOptionCorrect = option === q.correctAnswer;
                              const isOptionSelected = option === q.userAnswer;
                              
                              let optStyle = 'bg-[#0a0a0a] border border-white/5 text-slate-400 opacity-60';
                              if (isOptionCorrect) {
                                optStyle = 'bg-green-500/10 border border-green-500/30 text-green-300 font-semibold';
                              } else if (isOptionSelected) {
                                optStyle = 'bg-red-500/10 border border-red-500/30 text-red-300 font-semibold';
                              }

                              return (
                                <div key={option} className={`px-4 py-2 text-xs rounded-xl ${optStyle}`}>
                                  {option}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="pl-5 text-xs space-y-2 border-t border-white/5 pt-3 leading-relaxed">
                          <p className="text-slate-400">
                            Correct Answer: <span className="text-green-400 font-semibold">{q.correctAnswer}</span>
                          </p>
                          {!q.options && (
                            <p className="text-slate-400">
                              Your Answer: <span className={q.isCorrect ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>{q.userAnswer || '—'}</span>
                            </p>
                          )}
                          {q.explanation && (
                            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3 text-slate-400">
                              <span className="text-cyan-400 font-semibold uppercase text-[10px] block mb-1">Explanation</span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={28} className="text-cyan-500 animate-spin" />
      </div>
    }>
      <QuizPageContent />
    </Suspense>
  );
}
