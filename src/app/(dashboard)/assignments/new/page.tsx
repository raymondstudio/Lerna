"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  UploadCloud,
  X,
  Sparkles,
  ArrowLeft,
  Check,
  Loader2,
  FileCheck,
} from "lucide-react";
import { useCourses } from "@/hooks/use-courses";

export default function NewAssignmentPage() {
  const router = useRouter();
  const { data: courses = [] } = useCourses();

  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [mode, setMode] = useState<"answer" | "explain">("explain");
  const [typedPrompt, setTypedPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (selectedFile: File) => {
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("File size exceeds 20MB limit.");
      return;
    }
    setError(null);
    setFile(selectedFile);
    if (!title.trim()) {
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !typedPrompt.trim()) {
      setError("Please upload an assignment document or type your questions.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append("title", title.trim() || (file ? file.name : "Assignment Problem"));
      if (courseId) formData.append("courseId", courseId);
      formData.append("mode", mode);
      if (typedPrompt.trim()) formData.append("prompt", typedPrompt.trim());
      if (file) formData.append("file", file);

      const res = await fetch("/api/assignments", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to create assignment.");
      }

      router.push(`/assignments/${json.assignment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating assignment.");
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* ── Top Header ────────────────────────────────────────────── */}
        <div>
          <Link
            href="/assignments"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Assignments</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-cyan-400" />
            <span>New Assignment</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload an assignment document (image or PDF) or type questions directly. Lerna will solve every problem step-by-step.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── 1. Select Mode ──────────────────────────────────────── */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Tutoring Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Explain Mode */}
              <div
                onClick={() => setMode("explain")}
                className={`rounded-2xl border p-5 cursor-pointer transition-all ${
                  mode === "explain"
                    ? "bg-[#141414] border-cyan-500/50 shadow-sm"
                    : "bg-[#141414] border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  {mode === "explain" && (
                    <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">Explain Mode</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  In-depth reasoning showing <em>why</em> formulas are chosen, step-by-step algebraic breakdowns, and intuitive conceptual explanations.
                </p>
              </div>

              {/* Answer Mode */}
              <div
                onClick={() => setMode("answer")}
                className={`rounded-2xl border p-5 cursor-pointer transition-all ${
                  mode === "answer"
                    ? "bg-[#141414] border-cyan-500/50 shadow-sm"
                    : "bg-[#141414] border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  {mode === "answer" && (
                    <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">Answer Mode</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Direct, concise worked solutions showing formulas, substitutions, and verified final answers without conversational narrative.
                </p>
              </div>
            </div>
          </div>

          {/* ── 2. Course & Title ───────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                Course
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full h-10 rounded-xl bg-[#141414] border border-white/10 px-3 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
              >
                <option value="">General Assignment (No Course)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                Assignment Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Calculus Problem Set 3"
                className="w-full h-10 rounded-xl bg-[#141414] border border-white/10 px-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
          </div>

          {/* ── 3. File Upload Dropzone ─────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Upload Document (Images, PDF)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
              className="hidden"
            />

            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-cyan-400 bg-cyan-500/5"
                    : "border-white/10 bg-[#141414] hover:border-white/20"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <UploadCloud className="w-5 h-5 text-cyan-400" />
                </div>
                <p className="text-sm font-medium text-white mb-1">
                  Drop your assignment file here, or <span className="text-cyan-400 underline">browse</span>
                </p>
                <p className="text-xs text-slate-500">
                  PNG, JPG, WebP, PDF documents up to 20MB. Multi-page PDFs supported.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-cyan-500/30 bg-[#141414] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white line-clamp-1">{file.name}</p>
                    <p className="text-[11px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* ── 4. Direct Typed Prompt ──────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Or Type / Paste Questions Directly
            </label>
            <textarea
              value={typedPrompt}
              onChange={(e) => setTypedPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. 1. Solve for x: 3x^2 - 12x + 9 = 0&#10;2. Find the derivative of f(x) = x * sin(x)..."
              className="w-full rounded-xl bg-[#141414] border border-white/10 p-3.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-y"
            />
          </div>

          {/* ── Submit CTA ──────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || (!file && !typedPrompt.trim())}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Solve Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
