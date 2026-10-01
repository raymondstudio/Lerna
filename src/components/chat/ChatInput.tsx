"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpen, FileText, Loader2, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChatReference, ChatReferenceSelection } from "@/lib/chat/references";
import type { UploadedMaterialRecord } from "@/lib/uploads/types";
import { MentionPopover } from "./MentionPopover";

type ChatReferencesApiResponse = {
  success: boolean;
  data?: { references: ChatReference[] };
  error?: { message?: string };
};

type ChatInputProps = {
  onSend: (text: string) => void;
  onUpload?: (file: File) => void;
  disabled?: boolean;
  isUploading?: boolean;
  onReferenceChange?: (selection: ChatReferenceSelection | null) => void;
  materials?: UploadedMaterialRecord[];
  onDeleteMaterial?: (id: string) => void;
};

function referenceToken(reference: ChatReference) {
  if (reference.kind === "course") return `@${reference.code || reference.title}`;
  return `@“${reference.title}”`;
}

export function ChatInput({
  onSend,
  onUpload,
  disabled,
  isUploading,
  onReferenceChange,
  materials = [],
  onDeleteMaterial,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [references, setReferences] = useState<ChatReference[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [activeMention, setActiveMention] = useState<ChatReference | null>(null);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referencesError, setReferencesError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  const dismissMentionPopover = useCallback(() => {
    setShowMentionPopover(false);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    if (!showMentionPopover) return;

    const controller = new AbortController();
    setReferencesLoading(true);
    setReferencesError(null);
    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ query: mentionQuery });
        const response = await fetch(`/api/chat/references?${params}`, { signal: controller.signal });
        const payload = (await response.json()) as ChatReferencesApiResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error?.message || "Learning materials could not be loaded.");
        }
        setReferences(payload.data?.references ?? []);
        setActiveIndex(0);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[chat-input] Reference search failed", error);
          setReferences([]);
          setReferencesError("Learning materials could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setReferencesLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [mentionQuery, retryKey, showMentionPopover]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
  }, [text]);

  function detectMention(value: string, cursorPos: number) {
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex === -1) {
      dismissMentionPopover();
      return;
    }

    const charBeforeAt = atIndex > 0 ? textBeforeCursor[atIndex - 1] : " ";
    const query = textBeforeCursor.slice(atIndex + 1);
    const isAtWordStart = /\s/.test(charBeforeAt) || atIndex === 0;

    if (!isAtWordStart || query.includes("\n")) {
      dismissMentionPopover();
      return;
    }

    setMentionStart(atIndex);
    setMentionQuery(query);
    setActiveIndex(0);
    setShowMentionPopover(true);
  }

  function handleTextChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = event.target.value;
    setText(newValue);
    detectMention(newValue, event.target.selectionStart ?? newValue.length);
  }

  const handleMentionSelect = useCallback((reference: ChatReference) => {
    if (mentionStart === -1) return;

    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionStart + 1 + mentionQuery.length);
    const replacement = `${referenceToken(reference)} `;
    const newText = before + replacement + after;

    setText(newText);
    dismissMentionPopover();
    setMentionQuery("");
    setMentionStart(-1);
    setActiveMention(reference);
    onReferenceChange?.(
      reference.kind === "course" ? { courseId: reference.id } : { materialId: reference.id },
    );

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const newCursor = before.length + replacement.length;
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
    });
  }, [dismissMentionPopover, mentionQuery.length, mentionStart, onReferenceChange, text]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentionPopover) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismissMentionPopover();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => references.length > 0 ? (current + 1) % references.length : 0);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => references.length > 0 ? (current - 1 + references.length) % references.length : 0);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const selected = referencesLoading ? undefined : references[activeIndex];
        if (selected) handleMentionSelect(selected);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function handleBlur() {
    if (!showMentionPopover) return;
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      if (activeElement instanceof Element && activeElement.closest("#chat-reference-popover")) return;
      dismissMentionPopover();
    });
  }

  function removeMention() {
    if (activeMention) {
      const token = referenceToken(activeMention);
      setText((current) => current.replace(`${token} `, "").replace(token, ""));
    }
    setActiveMention(null);
    onReferenceChange?.(null);
    textareaRef.current?.focus();
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    setActiveMention(null);
    onReferenceChange?.(null);
    dismissMentionPopover();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file && onUpload) onUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const activeOption = references[activeIndex];
  const activeOptionId = activeOption
    ? `chat-reference-option-${activeOption.kind}-${activeOption.id}`
    : undefined;

  return (
    <div ref={composerRef} className="relative flex min-w-0 w-full flex-col" data-chat-composer>
      <MentionPopover
        references={references}
        onSelect={handleMentionSelect}
        onDismiss={dismissMentionPopover}
        onRetry={() => setRetryKey((current) => current + 1)}
        isOpen={showMentionPopover}
        query={mentionQuery}
        isLoading={referencesLoading}
        error={referencesError}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        anchorRef={composerRef}
      />

      {materials.length > 0 && (
        <div className="mb-2 flex max-h-[7.5rem] min-w-0 flex-wrap gap-2 overflow-y-auto overflow-x-hidden overscroll-contain px-1">
          {materials.map((material) => {
            const isProcessing = material.status === "processing" || material.status === "uploaded";
            const isFailed = material.status === "failed";

            return (
              <div
                key={material.id}
                className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 shadow-sm transition-colors hover:border-white/20"
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-400 motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden="true" />
                )}
                <span className="min-w-0 max-w-[min(15rem,60vw)] truncate font-medium" title={material.fileName}>
                  {material.fileName}
                </span>
                {isProcessing && <span className="shrink-0 text-[10px] text-cyan-300">Analyzing</span>}
                {isFailed && <span className="shrink-0 text-[10px] text-red-400">Failed</span>}
                {onDeleteMaterial && (
                  <button
                    type="button"
                    onClick={() => onDeleteMaterial(material.id)}
                    disabled={disabled}
                    aria-label={`Remove ${material.fileName}`}
                    className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/5 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex min-w-0 w-full items-end gap-1 rounded-[1.5rem] border border-white/10 bg-[#141414] p-1.5 shadow-lg transition-colors focus-within:border-cyan-500/40 focus-within:ring-1 focus-within:ring-cyan-500/20 sm:gap-2">
        <div className="flex items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="application/pdf"
            aria-label="Choose a PDF to upload"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload attachment"
            disabled={disabled || isUploading}
            className={`h-10 w-10 shrink-0 rounded-full sm:h-9 sm:w-9 ${
              isUploading ? "text-cyan-400" : "text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Paperclip className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>

        <textarea
          ref={textareaRef}
          name="chat-message"
          value={text}
          onChange={handleTextChange}
          placeholder="Message Lerna… (type @ for materials)"
          aria-label="Message Lerna"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="dialog"
          aria-expanded={showMentionPopover}
          aria-controls={showMentionPopover ? "chat-reference-popover" : undefined}
          aria-activedescendant={showMentionPopover ? activeOptionId : undefined}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          rows={1}
          className="my-auto min-h-5 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1.5 text-sm leading-5 text-slate-200 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:px-2"
        />

        <Button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          size="icon"
          aria-label="Send message"
          className={`h-10 w-10 shrink-0 rounded-full sm:h-9 sm:w-9 ${
            text.trim() ? "bg-white text-black hover:bg-slate-200" : "bg-white/10 text-white/30"
          }`}
        >
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      {activeMention && (
        <div className="mt-2 flex min-w-0 items-center px-1">
          <div className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 py-1 pl-3 pr-1 text-xs text-cyan-300">
            {activeMention.kind === "course" ? (
              <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 truncate font-semibold" title={activeMention.title}>
              {activeMention.kind === "course" ? activeMention.code || activeMention.title : activeMention.title}
            </span>
            <span className="shrink-0 text-cyan-500/70">Scoped</span>
            <button
              type="button"
              onClick={removeMention}
              aria-label="Remove material scope"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-cyan-400/70 transition-colors hover:bg-cyan-500/10 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
