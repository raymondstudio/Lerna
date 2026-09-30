'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Plus, GraduationCap, Loader2, X } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useCourses, useInvalidateCourses } from '@/hooks/use-courses'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { UPLOADED_MATERIALS_BUCKET, buildUploadPath, getAcceptedUploadMimeTypes, isAllowedUploadMimeType } from '@/lib/uploads/constants'

interface Course {
  id: string
  code: string
  title: string
  description?: string
  created_at: string
  uploaded_materials?: { id: string }[]
}

function formatDate(dateStr?: string) {
  if (!dateStr) return 'Unknown date'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-3 w-16 bg-white/10 rounded" />
        <div className="h-3 w-20 bg-white/10 rounded" />
      </div>
      <div className="h-5 w-3/4 bg-white/10 rounded mb-3" />
      <div className="h-3 w-full bg-white/10 rounded mb-2" />
      <div className="h-3 w-2/3 bg-white/10 rounded" />
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-28 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-[#141414] border border-white/5 flex items-center justify-center mb-6">
        <GraduationCap className="w-9 h-9 text-slate-600" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">No courses yet</h3>
      <p className="text-sm text-slate-400 max-w-xs mb-8">
        Add your first course to get started. Courses help organise your study sessions and AI tutoring.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold rounded-xl transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Course
      </button>
    </motion.div>
  )
}

// ─── Add Course Modal ─────────────────────────────────────────────────────────
interface AddCourseModalProps {
  open: boolean
  onClose: () => void
  onCreated: (course: Course) => void
}

function AddCourseModal({ open, onClose, onCreated }: AddCourseModalProps) {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  function resetForm() {
    setCode('')
    setTitle('')
    setDescription('')
    setFile(null)
    setError(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !title.trim()) {
      setError('Course code and title are required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create course.')
      }
      
      const newCourse: Course = data.course;
      
      if (file && newCourse) {
        try {
          const supabase = createSupabaseBrowserClient();
          if (!supabase) {
            throw new Error('Supabase client not initialized');
          }
          const userRes = await supabase.auth.getUser();
          const userId = userRes.data.user?.id;
          
          if (userId) {
             const storagePath = buildUploadPath(userId, newCourse.id, file.name);
             const { error: uploadError } = await supabase.storage.from(UPLOADED_MATERIALS_BUCKET).upload(storagePath, file, {
               contentType: file.type || "application/octet-stream",
               upsert: false,
             });
             
             if (!uploadError) {
               const { data: insertedRow } = await supabase.from('uploaded_materials').insert({
                 user_id: userId,
                 course_id: newCourse.id,
                 file_name: file.name,
                 file_type: file.type || "application/octet-stream",
                 storage_path: storagePath,
               }).select('id').single();
               
               if (insertedRow) {
                 newCourse.uploaded_materials = [{ id: insertedRow.id }];
                 // Trigger processing in background
                 fetch(`/api/materials/${insertedRow.id}/process`, { method: "POST" }).catch(() => {});
               }
             }
          }
        } catch (uploadErr) {
          console.error("Failed to upload course material", uploadErr);
        }
      }
      
      onCreated(newCourse)
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Panel */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-md bg-[#141414] border border-white/10 rounded-2xl p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                  </div>
                  <h2 className="text-base font-semibold text-white">Add Course</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Course Code */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
                    Course Code <span className="text-cyan-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MTH101"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={12}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>

                {/* Course Title */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
                    Course Title <span className="text-cyan-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Introduction to Calculus"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
                    Description <span className="text-slate-600">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Brief description of this course…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 tracking-wide uppercase">
                    Course Material <span className="text-slate-600">(PDF, DOCX)</span>
                  </label>
                  <input
                    type="file"
                    accept={getAcceptedUploadMimeTypes()}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && isAllowedUploadMimeType(f.type)) {
                        setFile(f);
                        setError(null);
                      } else if (f) {
                        setError("Invalid file type. Please upload a PDF, DOCX, etc.");
                        setFile(null);
                      }
                    }}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-300 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 focus:outline-none transition-colors"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create Course
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CoursesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const { data: courses = [], isLoading: fetching } = useCourses()
  const invalidateCourses = useInvalidateCourses()
  const [modalOpen, setModalOpen] = useState(false)

  function handleCourseCreated(_course: Course) {
    invalidateCourses()
  }

  // Auth loading guard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    
      <div className="h-full overflow-y-auto bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ── Page Header ───────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2.5 mb-2"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs font-semibold tracking-widest text-cyan-500 uppercase">
                Learning Hub
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="text-3xl font-bold text-white mb-1"
            >
              Courses
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="text-sm text-slate-400"
            >
              Manage and explore your enrolled courses. Get AI-powered tutoring for any subject.
            </motion.p>
          </div>

          {/* Add Course Button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold rounded-xl transition-colors shrink-0 mt-1"
          >
            <Plus className="w-4 h-4" />
            Add Course
          </motion.button>
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div className="border-t border-white/5 mb-8" />

        {/* ── Stats Bar ─────────────────────────────────────────────── */}
        {!fetching && courses.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="flex items-center gap-2 mb-7"
          >
            <span className="text-sm text-slate-500">
              {courses.length} {courses.length === 1 ? 'course' : 'courses'} enrolled
            </span>
          </motion.div>
        )}

        {/* ── Course Grid ───────────────────────────────────────────── */}
        {fetching ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState onAdd={() => setModalOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
                onClick={() => {
                  router.push(`/courses/${course.id}`);
                }}
                className="group bg-[#141414] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors cursor-pointer"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <span className="text-xs font-semibold tracking-widest text-cyan-400 uppercase">
                    {course.code}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDate(course.created_at)}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-50 transition-colors">
                  {course.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-slate-400 line-clamp-2 mb-5">
                  {course.description || 'No description provided.'}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600 group-hover:text-slate-500 transition-colors">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Open course</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Course Modal ──────────────────────────────────────────── */}
      <AddCourseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCourseCreated}
      />
      </div>
    
  )
}
