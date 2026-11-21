"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  Share2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { ShareModal } from "@/components/assignments/ShareModal";
import { useCourses } from "@/hooks/use-courses";
import type { AssignmentRecord } from "@/lib/repositories/assignments";

function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return "Just now";
  const timestamp = new Date(dateStr).getTime();
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 86400000);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AssignmentsPage() {
  const router = useRouter();
  const { data: courses = [] } = useCourses();
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [shareTarget, setShareTarget] = useState<AssignmentRecord | null>(null);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/assignments");
        const json = await res.json();
        if (active && res.ok && json.success) {
          setAssignments(json.assignments || []);
        }
      } catch (err) {
        console.error("Failed to load assignments", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchesCourse = selectedCourseId === "all" || a.courseId === selectedCourseId;
      const matchesSearch =
        !search.trim() ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.courses?.code.toLowerCase().includes(search.toLowerCase());
      return matchesCourse && matchesSearch;
    });
  }, [assignments, selectedCourseId, search]);

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* ── Page Header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-xs font-semibold tracking-widest text-cyan-500 uppercase">
                Academic Workspace
              </span>
            </div>

            <h1 className="text-3xl font-bold text-white mb-1">
              Assignments
            </h1>

            <p className="text-sm text-slate-400 max-w-xl">
              Upload problem sets or documents, generate step-by-step worked solutions, and share your academic portfolio.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0 pt-1">
            <button
              onClick={() => setCollectionModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#141414] hover:bg-[#1a1a1a] border border-white/10 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Share2 className="w-4 h-4 text-cyan-400" />
              <span>Share Portfolio</span>
            </button>

            <button
              onClick={() => router.push("/assignments/new")}
              className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Assignment</span>
            </button>
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div className="border-t border-white/5" />

        {/* ── Filter & Search Toolbar ───────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Course Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedCourseId("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCourseId === "all"
                    ? "bg-cyan-500 text-black font-semibold"
                    : "bg-[#141414] border border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                }`}
              >
                All Courses ({assignments.length})
              </button>
              {courses.map((c) => {
                const count = assignments.filter((a) => a.courseId === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedCourseId === c.id
                        ? "bg-cyan-500 text-black font-semibold"
                        : "bg-[#141414] border border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                    }`}
                  >
                    {c.code} {count > 0 ? `(${count})` : ""}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assignments..."
                className="w-full bg-[#141414] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>
          </div>

          {/* ── Assignments Grid ────────────────────────────────────── */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[#141414] border border-white/5 rounded-2xl p-6 animate-pulse">
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-3 w-16 bg-white/10 rounded" />
                    <div className="h-3 w-20 bg-white/10 rounded" />
                  </div>
                  <div className="h-5 w-3/4 bg-white/10 rounded mb-3" />
                  <div className="h-3 w-full bg-white/10 rounded mb-2" />
                  <div className="h-3 w-2/3 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-3xl bg-[#141414] border border-white/5 flex items-center justify-center mb-5 text-slate-600">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No assignments found</h3>
              <p className="text-sm text-slate-400 max-w-sm mb-6">
                {search || selectedCourseId !== "all"
                  ? "No assignments match your filter. Try adjusting your search query."
                  : "Upload a document or question to solve your first assignment with AI."}
              </p>
              <button
                onClick={() => router.push("/assignments/new")}
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Assignment</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  onClick={() => router.push(`/assignments/${assignment.id}`)}
                  className="group bg-[#141414] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-4">
                      <span className="text-xs font-semibold tracking-widest text-cyan-400 uppercase">
                        {assignment.courses?.code || "GENERAL"}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/5">
                          {assignment.mode === "explain" ? "Explain" : "Answer"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareTarget(assignment);
                          }}
                          className="p-1 text-slate-500 hover:text-white transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-50 transition-colors line-clamp-1">
                      {assignment.title}
                    </h3>

                    {/* Description or Question Count */}
                    <p className="text-sm text-slate-400 line-clamp-2 mb-6">
                      {assignment.description ||
                        (assignment.extractedQuestions && assignment.extractedQuestions.length > 0
                          ? `${assignment.extractedQuestions.length} questions extracted`
                          : "No description provided.")}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      {assignment.status === "completed" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : assignment.status === "processing" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      ) : assignment.status === "failed" ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span className="capitalize">{assignment.status}</span>
                    </div>

                    <span>{formatRelativeTime(assignment.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Share Modal (Individual Assignment) ───────────────────── */}
      {shareTarget && (
        <ShareModal
          isOpen={Boolean(shareTarget)}
          onClose={() => setShareTarget(null)}
          assignmentId={shareTarget.id}
          assignmentTitle={shareTarget.title}
          initialIsPublic={shareTarget.isPublic}
          shareToken={shareTarget.shareToken}
          onVisibilityChange={(pub) => {
            setAssignments((prev) =>
              prev.map((a) => (a.id === shareTarget.id ? { ...a, isPublic: pub } : a))
            );
          }}
        />
      )}

      {/* ── Share Modal (Collection Portfolio) ────────────────────── */}
      {collectionModalOpen && (
        <ShareModal
          isOpen={collectionModalOpen}
          onClose={() => setCollectionModalOpen(false)}
          isCollection={true}
        />
      )}
    </div>
  );
}
