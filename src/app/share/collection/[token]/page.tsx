"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  BookOpen,
  GraduationCap,
  Sparkles,
  Lock,
  Loader2,
  ExternalLink,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicSignUpModal } from "@/components/assignments/PublicSignUpModal";
import type { AssignmentCollectionRecord } from "@/lib/repositories/assignments";

interface CourseGroup {
  code: string;
  title: string;
  assignments: Array<{
    id: string;
    title: string;
    mode: "answer" | "explain";
    shareToken: string;
    updatedAt: string;
  }>;
}

export default function PublicCollectionPage() {
  const params = useParams();
  const token = params?.token as string;

  const [collection, setCollection] = useState<AssignmentCollectionRecord | null>(null);
  const [courses, setCourses] = useState<CourseGroup[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/assignments/public/collection/${token}`);
        const data = await res.json();
        if (active && res.ok && data.success) {
          setCollection(data.collection);
          setCourses(data.courses || []);
        } else if (active) {
          setError(data.error?.message || "This assignments collection is not public.");
        }
      } catch {
        if (active) setError("Could not load shared collection.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (token) load();
    return () => {
      active = false;
    };
  }, [token]);

  const totalPublishedAssignments = courses.reduce((acc, c) => acc + c.assignments.length, 0);

  const displayedCourses = selectedCourse === "all"
    ? courses
    : courses.filter((c) => c.code === selectedCourse);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <p className="text-sm">Loading academic portfolio...</p>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center space-y-4 text-slate-200">
        <div className="w-14 h-14 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-center text-slate-500">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Portfolio Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-md">
          {error || "This collection is private or the link has been revoked."}
        </p>
        <Button asChild className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold">
          <Link href="/">Visit Lerna AI</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-100 flex flex-col">
      {/* ── Public Top Bar ────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-heading text-lg font-bold text-white tracking-tight">
              Lerna<span className="text-cyan-400"> AI</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Academic Portfolio
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="border-white/10 bg-[#141414] text-slate-300 hover:text-white text-xs">
            <Link href="/?auth=login">Sign In</Link>
          </Button>
          <Button asChild size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs">
            <Link href="/?auth=signup">Sign Up Free</Link>
          </Button>
        </div>
      </header>

      {/* ── Main Content Area ──────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Collection Header Banner */}
        <div className="rounded-2xl border border-white/5 bg-[#141414] p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-cyan-400" />
            <span className="text-xs uppercase font-semibold tracking-wider text-cyan-400">
              Student Collection
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            {collection.title || "Academic Assignments Collection"}
          </h1>

          {collection.description && (
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              {collection.description}
            </p>
          )}

          <div className="flex items-center gap-4 pt-3 text-xs text-slate-400 border-t border-white/5">
            <span>{courses.length} {courses.length === 1 ? "Course" : "Courses"}</span>
            <span>·</span>
            <span>{totalPublishedAssignments} Published {totalPublishedAssignments === 1 ? "Assignment" : "Assignments"}</span>
          </div>
        </div>

        {/* Course Filter Tabs */}
        {courses.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCourse("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCourse === "all"
                  ? "bg-cyan-500 text-black font-semibold"
                  : "bg-[#141414] border border-white/5 text-slate-400 hover:text-white hover:border-white/10"
              }`}
            >
              All Courses ({totalPublishedAssignments})
            </button>
            {courses.map((c) => (
              <button
                key={c.code}
                onClick={() => setSelectedCourse(c.code)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCourse === c.code
                    ? "bg-cyan-500 text-black font-semibold"
                    : "bg-[#141414] border border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                }`}
              >
                {c.code} ({c.assignments.length})
              </button>
            ))}
          </div>
        )}

        {/* Grouped Courses & Assignments */}
        {displayedCourses.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#141414] p-12 text-center text-slate-400">
            <Layers className="w-10 h-10 mx-auto mb-3 text-slate-500" />
            <p className="text-sm font-medium">No published assignments in this collection yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {displayedCourses.map((course) => (
              <section key={course.code} className="space-y-4">
                <div className="flex items-center gap-2.5 border-b border-white/5 pb-2">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-base font-bold text-white tracking-tight">
                    {course.code} <span className="font-normal text-slate-400">· {course.title}</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {course.assignments.map((assignment) => (
                    <Link
                      key={assignment.id}
                      href={`/share/assignments/${assignment.shareToken}`}
                      className="group rounded-2xl border border-white/5 bg-[#141414] hover:border-white/10 transition-colors p-5 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/5">
                            {assignment.mode === "explain" ? "Explain" : "Answer"}
                          </span>

                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                        </div>

                        <h3 className="font-semibold text-white text-base group-hover:text-cyan-50 transition-colors line-clamp-2">
                          {assignment.title}
                        </h3>
                      </div>

                      <div className="pt-2 border-t border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Read complete solution</span>
                        <span>{new Date(assignment.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Dismissible Public Sign-Up Modal */}
      <PublicSignUpModal />
    </div>
  );
}
