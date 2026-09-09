"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Paperclip, ArrowUp, Globe, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MentionPopover } from "./MentionPopover";
import type { UploadedMaterialRecord } from "@/lib/uploads/types";

type Course = {
  id: string;
  code: string;
  title: string;
};

type ChatInputProps = {
  onSend: (text: string) => void;
  onUpload?: (file: File) => void;
  disabled?: boolean;
  isUploading?: boolean;
  courseId?: string;
  onCourseId?: (id: string | null) => void;
  materials?: UploadedMaterialRecord[];
  onDeleteMaterial?: (id: string) => void;
};

export function ChatInput({
  onSend,
  onUpload,
  disabled,
  isUploading,
  courseId,
  onCourseId,
  materials = [],
  onDeleteMaterial,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);



  // ── Mention state ──────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [activeMention, setActiveMention] = useState<Course | null>(null);

  // Fetch courses once on mount (best-effort; ignore errors silently)
  useEffect(() => {
    fetch("/api/courses")
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.courses && Array.isArray(payload.courses)) {
          setCourses(
            payload.courses.map((c: any) => ({
              id: c.id as string,
              code: (c.code ?? "") as string,
              title: (c.title ?? "") as string,
            }))
          );
        }
      })
      .catch(() => {/* silently ignore */});
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [text]);

  // ── Mention detection ──────────────────────────────────────────────────────
  function detectMention(value: string, cursorPos: number) {
    // Look for the last '@' before the cursor that isn't followed by a space
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex === -1) {
      setShowMentionPopover(false);
      return;
    }

    const textAfterAt = textBeforeCursor.slice(atIndex + 1);

    // If there's a space after @ or @ was not preceded by start-of-string / whitespace, close
    const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : " ";
    const isAtWordStart = /\s/.test(charBeforeAt) || atIndex === 0;

    if (!isAtWordStart || textAfterAt.includes(" ")) {
      setShowMentionPopover(false);
      return;
    }

    setMentionStart(atIndex);
    setMentionQuery(textAfterAt);
    setShowMentionPopover(true);
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    setText(newValue);
    detectMention(newValue, e.target.selectionStart ?? newValue.length);
  }

  // ── Mention selection ──────────────────────────────────────────────────────
  const handleMentionSelect = useCallback(
    (course: Course) => {
      if (mentionStart === -1) return;

      // Replace "@<query>" with "@CODE "
      const before = text.slice(0, mentionStart);
      const after = text.slice(mentionStart + 1 + mentionQuery.length);
      const replacement = `@${course.code} `;
      const newText = before + replacement + after;

      setText(newText);
      setShowMentionPopover(false);
      setMentionQuery("");
      setMentionStart(-1);
      setActiveMention(course);
      onCourseId?.(course.id);

      // Restore focus and move cursor to end of inserted text
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursor = before.length + replacement.length;
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      });
    },
    [text, mentionStart, mentionQuery, onCourseId]
  );

  // Close popover on Escape
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentionPopover && e.key === "Escape") {
      e.preventDefault();
      setShowMentionPopover(false);
      return;
    }
    // Block Enter from submitting while popover is open (popover handles it)
    if (showMentionPopover && e.key === "Enter") {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  // ── Remove scope chip ──────────────────────────────────────────────────────
  function removeMention() {
    setActiveMention(null);
    onCourseId?.(null);
    // Also strip the @CODE token from the textarea if it's still there
    if (activeMention) {
      setText((prev) => prev.replace(`@${activeMention.code} `, "").replace(`@${activeMention.code}`, ""));
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    setActiveMention(null);
    onCourseId?.(null);
    setShowMentionPopover(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  // ── File upload ────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="relative flex w-full flex-col">
      {/* @mention popover — positioned above the input */}
      <MentionPopover
        courses={courses}
        onSelect={handleMentionSelect}
        isOpen={showMentionPopover}
        query={mentionQuery}
      />

      {/* Attached materials chips */}
      {materials.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 px-1 max-h-[120px] overflow-y-auto scrollbar-hide">
          {materials.map((mat) => {
            const isProcessing = mat.status === "processing" || mat.status === "uploaded";
            const isFailed = mat.status === "failed";
            
            return (
              <div
                key={mat.id}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md shadow-sm transition-all hover:border-white/20"
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-cyan-400" />
                )}
                
                <span className="font-medium max-w-[150px] truncate" title={mat.fileName}>
                  {mat.fileName}
                </span>

                {isProcessing && (
                  <span className="text-[10px] text-cyan-400/80 animate-pulse">(analyzing)</span>
                )}
                {isFailed && (
                  <span className="text-[10px] text-red-400" title={mat.errorMessage || "Failed"}>
                    (failed)
                  </span>
                )}
                
                {onDeleteMaterial && (
                  <button
                    type="button"
                    onClick={() => onDeleteMaterial(mat.id)}
                    disabled={disabled}
                    aria-label={`Remove ${mat.fileName}`}
                    className="ml-1 rounded-full p-0.5 text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex w-full items-end gap-2 rounded-[1.5rem] bg-[#141414] border border-white/10 p-2 focus-within:border-cyan-500/30 transition-colors shadow-lg">
        <div className="flex items-center gap-1 mb-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="application/pdf"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload attachment"
            disabled={disabled || isUploading}
            className={`h-9 w-9 rounded-full transition-colors ${
              isUploading
                ? "text-cyan-400 animate-pulse"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder="Message Lerna… (type @ to scope a course)"
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="my-auto min-h-[24px] max-h-[200px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-[10px] text-base text-slate-200 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 scrollbar-hide"
        />

        <Button
          onClick={submit}
          disabled={disabled || !text.trim()}
          size="icon"
          aria-label="Send message"
          className={`h-9 w-9 shrink-0 rounded-full mb-1 transition-colors ${
            text.trim()
              ? "bg-white text-black hover:bg-slate-200"
              : "bg-white/10 text-white/30"
          }`}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </div>

      {/* Scoped course chip */}
      {activeMention && (
        <div className="mt-2 flex items-center gap-2 px-1">
          <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-400">
            <span>🎓</span>
            <span className="font-semibold">{activeMention.code}</span>
            <span className="text-cyan-500/60">(scoped)</span>
            <button
              onClick={removeMention}
              aria-label="Remove course scope"
              className="ml-1 rounded-full p-0.5 text-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
