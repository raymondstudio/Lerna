'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Timer,
  Trophy,
  Plus,
  Trash2,
  Edit,
  ArrowLeft,
  Loader2,
  FileText,
  Paperclip,
  CheckCircle2,
  GraduationCap,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { UPLOADED_MATERIALS_BUCKET, buildUploadPath, isAllowedUploadMimeType, getAcceptedUploadMimeTypes } from '@/lib/uploads/constants';

type Course = {
  id: string;
  code: string;
  title: string;
  description?: string;
  created_at: string;
};

type Material = {
  id: string;
  file_name: string;
  file_type: string;
  status: string;
  created_at: string;
};

type StudySession = {
  id: string;
  duration_seconds: number;
  status: string;
};

type Quiz = {
  id: string;
  score: number;
  total_questions: number;
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CourseDetailsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;
  
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Data states
  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / UI states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editCode, setEditCode] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch course details & stats
  const fetchDetails = async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (res.ok) {
        const payload = await res.json();
        const data = payload.data;
        setCourse(data.course);
        setMaterials(data.materials);
        setSessions(data.sessions);
        setQuizzes(data.quizzes);

        // Prep edit states
        setEditCode(data.course.code);
        setEditTitle(data.course.title);
        setEditDesc(data.course.description || '');
      } else {
        router.push('/courses');
      }
    } catch (e) {
      console.error('Failed to load course details', e);
      router.push('/courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && courseId) {
      fetchDetails();
    }
  }, [user, courseId]);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCode.trim() || !editTitle.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editCode.trim(),
          title: editTitle.trim(),
          description: editDesc.trim(),
        }),
      });

      if (res.ok) {
        const payload = await res.json();
        setCourse(payload.data.course);
        setEditModalOpen(false);
      } else {
        alert('Failed to update course details.');
      }
    } catch (e) {
      alert('An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCourse = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/courses');
      } else {
        alert('Failed to delete course.');
      }
    } catch (e) {
      alert('An error occurred.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAllowedUploadMimeType(file.type)) {
      alert('Invalid file format. Please upload PDF or Word document.');
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error('Supabase client missing');

      const storagePath = buildUploadPath(user!.id, courseId, file.name);

      // 1. Upload file to Storage Bucket
      const { error: uploadError } = await supabase.storage
        .from(UPLOADED_MATERIALS_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Insert record in DB
      const { data: material, error: insertError } = await supabase
        .from('uploaded_materials')
        .insert({
          user_id: user!.id,
          course_id: courseId,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          storage_path: storagePath,
        })
        .select('id, file_name, file_type, status, created_at')
        .single();

      if (insertError) throw insertError;

      setMaterials((prev) => [material, ...prev]);

      // 3. Process document chunks in background
      fetch(`/api/materials/${material.id}/process`, { method: 'POST' }).catch(() => {});

    } catch (err) {
      console.error(err);
      alert('Failed to upload material.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMaterial = async (matId: string) => {
    if (!confirm('Are you sure you want to remove this study material?')) return;

    try {
      const res = await fetch(`/api/materials/${matId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMaterials((prev) => prev.filter((m) => m.id !== matId));
      } else {
        alert('Failed to delete material.');
      }
    } catch (e) {
      alert('An error occurred.');
    }
  };

  const handleOpenMaterial = async (matId: string) => {
    try {
      const res = await fetch(`/api/materials/${matId}/view`, { method: 'POST' });
      const payload = await res.json();
      if (payload.success && payload.data?.signedUrl) {
        window.open(payload.data.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('Failed to open preview link.');
      }
    } catch (e) {
      alert('Unable to load file preview.');
    }
  };

  // ─── Stat Computations ──────────────────────────────────────────────────────
  const totalStudyTime = sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
  
  const avgQuizAccuracy = quizzes.length > 0
    ? Math.round(quizzes.reduce((acc, q) => acc + (q.score || 0), 0) / quizzes.length)
    : 0;

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${seconds}s`;
  }

  if (loading || authLoading) {
    return (
      <DashboardShell>
        <div className="h-full overflow-y-auto bg-[#0a0a0a] text-white font-body px-6 py-8 animate-pulse">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="h-4 bg-white/5 rounded w-16" />
            <div className="rounded-3xl border border-white/5 bg-[#141414] p-8 space-y-4">
              <div className="h-6 bg-white/10 rounded w-1/4" />
              <div className="h-10 bg-white/10 rounded w-3/4" />
              <div className="h-4 bg-white/5 rounded w-1/2" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-32 bg-[#141414] border border-white/5 rounded-2xl" />
              <div className="h-32 bg-[#141414] border border-white/5 rounded-2xl" />
              <div className="h-32 bg-[#141414] border border-white/5 rounded-2xl" />
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!course) return null;

  return (
    <DashboardShell>
      <div className="h-full overflow-y-auto bg-[#0a0a0a] text-white font-body px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Top navigation row */}
          <button
            onClick={() => router.push('/courses')}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors uppercase tracking-widest"
          >
            <ArrowLeft size={14} />
            Back to Hub
          </button>

          {/* Glassmorphic header card */}
          <div className="relative rounded-3xl border border-white/5 bg-[#141414] p-8 flex flex-col md:flex-row md:items-start justify-between gap-6 overflow-hidden">
            <div className="space-y-3 z-10">
              <span className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-widest rounded-full">
                {course.code}
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-white">{course.title}</h1>
              <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                {course.description || 'No description provided for this course. Click Edit to add details.'}
              </p>
            </div>

            <div className="flex gap-2 z-10 shrink-0">
              <button
                onClick={() => setEditModalOpen(true)}
                className="p-2.5 bg-[#0a0a0a] hover:bg-[#202020] border border-white/10 rounded-xl transition-all text-slate-400 hover:text-white"
                title="Edit Course"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="p-2.5 bg-[#0a0a0a] hover:bg-red-500/15 border border-red-500/25 rounded-xl transition-all text-slate-400 hover:text-red-400"
                title="Delete Course"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Study Time',
                value: formatTime(totalStudyTime),
                desc: 'Across all active sessions',
                icon: Timer,
              },
              {
                label: 'Sessions Completed',
                value: sessions.length.toString(),
                desc: 'Focus sessions logged',
                icon: BookOpen,
              },
              {
                label: 'Avg Quiz Accuracy',
                value: `${avgQuizAccuracy}%`,
                desc: 'Practice scores computed',
                icon: Trophy,
              },
            ].map(({ label, value, desc, icon: Icon }) => (
              <div
                key={label}
                className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex items-start gap-4"
              >
                <div className="p-3 bg-[#0a0a0a] rounded-xl border border-white/10 text-cyan-400">
                  <Icon size={18} />
                </div>
                <div className="space-y-1">
                  <span className="text-2xl font-black text-white tracking-tight">{value}</span>
                  <p className="text-xs font-semibold text-slate-300 leading-none">{label}</p>
                  <p className="text-[10px] text-slate-500 leading-none">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Workspace launch zones */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => router.push(`/study?courseId=${courseId}`)}
              className="bg-[#141414] border border-white/5 hover:border-cyan-500/30 rounded-2xl p-6 cursor-pointer group transition-all"
            >
              <Timer size={22} className="text-cyan-400 group-hover:scale-110 transition-transform mb-3" />
              <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">Start Study Session</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Launch Pomodoro timer and log completions to compute study statistics.</p>
            </div>

            <div
              onClick={() => router.push(`/quiz?courseId=${courseId}`)}
              className="bg-[#141414] border border-white/5 hover:border-cyan-500/30 rounded-2xl p-6 cursor-pointer group transition-all"
            >
              <GraduationCap size={22} className="text-cyan-400 group-hover:scale-110 transition-transform mb-3" />
              <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">Practice Quizzes</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Test your understanding by generating tailored AI question sets.</p>
            </div>

            <div
              onClick={() => router.push(`/chat?courseId=${courseId}`)} // Note: standard chat view
              className="bg-[#141414] border border-white/5 hover:border-cyan-500/30 rounded-2xl p-6 cursor-pointer group transition-all"
            >
              <MessageSquare size={22} className="text-cyan-400 group-hover:scale-110 transition-transform mb-3" />
              <h3 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">Chat with AI Tutor</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Ask study questions and retrieve references from uploaded course materials.</p>
            </div>
          </div>

          {/* Materials Section */}
          <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Paperclip size={18} className="text-cyan-400" />
                Course Materials
              </h2>
              
              <label className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs rounded-xl cursor-pointer transition-colors">
                <Plus size={14} />
                Upload Document
                <input
                  type="file"
                  accept={getAcceptedUploadMimeTypes()}
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>

            {isUploading && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[#0a0a0a] border border-cyan-500/20 text-cyan-400 rounded-xl text-sm">
                <Loader2 size={16} className="animate-spin shrink-0" />
                Uploading document to course files…
              </div>
            )}

            {materials.length === 0 ? (
              <div className="text-center py-12 bg-[#0a0a0a] border border-white/5 rounded-xl text-slate-500 text-sm">
                No materials uploaded for this course yet. Add documents to scope AI queries!
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {materials.map((mat) => (
                  <div
                    key={mat.id}
                    className="flex items-center justify-between p-4 bg-[#0a0a0a] border border-white/5 hover:border-white/10 rounded-2xl transition-all group/mat"
                  >
                    <div
                      onClick={() => handleOpenMaterial(mat.id)}
                      className="flex items-center gap-3 min-w-0 cursor-pointer"
                    >
                      <div className="p-2.5 bg-[#141414] rounded-lg text-slate-500 group-hover/mat:text-cyan-400 transition-colors">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 group-hover/mat:text-white truncate">
                          {mat.file_name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Uploaded on {new Date(mat.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        mat.status === 'ready' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                      }`}>
                        {mat.status}
                      </span>
                      <button
                        onClick={() => handleDeleteMaterial(mat.id)}
                        className="p-2 bg-[#141414] hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-white/5 rounded-lg transition-all"
                        title="Remove Material"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ─── Edit Course Modal ─── */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white">Edit Course Details</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Course Code</label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="e.g. PHYS 101"
                  className="bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Course Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Intro to Quantum Mechanics"
                  className="bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500/50"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Course outline or study topics…"
                  rows={3}
                  className="bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#0a0a0a] border border-white/10 text-slate-400 hover:text-white rounded-xl text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {isSaving && <Loader2 size={13} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#141414] border border-white/10 rounded-3xl p-6 text-center space-y-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
              <Trash2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Delete Course?</h2>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                This action is irreversible. All uploaded materials, sessions logs, and quiz results linked to this course will be dissociated.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2.5 bg-[#0a0a0a] border border-white/10 text-slate-400 hover:text-white rounded-xl text-sm font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCourse}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-1.5"
              >
                {isDeleting && <Loader2 size={13} className="animate-spin" />}
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
