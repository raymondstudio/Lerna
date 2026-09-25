"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BookOpen, FileText, Loader2, RefreshCw, Search } from "lucide-react";

import type { ChatReference } from "@/lib/chat/references";

type FloatingLayout = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  side: "top" | "bottom";
  ready: boolean;
};

type MentionPopoverProps = {
  references: ChatReference[];
  onSelect: (reference: ChatReference) => void;
  onDismiss: () => void;
  onRetry: () => void;
  isOpen: boolean;
  query: string;
  isLoading?: boolean;
  error?: string | null;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  anchorRef: RefObject<HTMLDivElement | null>;
};

const VIEWPORT_GAP = 8;
const DESKTOP_MAX_HEIGHT = 384;
const DESKTOP_MAX_WIDTH = 440;

function formatFileType(fileType?: string) {
  if (!fileType) return "File";
  if (fileType === "application/pdf") return "PDF";
  if (fileType.includes("wordprocessingml")) return "DOCX";
  if (fileType.includes("presentationml")) return "PPTX";
  if (fileType.startsWith("image/")) return fileType.slice(6).toUpperCase();
  return fileType.split("/").pop()?.toUpperCase() ?? "File";
}

export function MentionPopover({
  references,
  onSelect,
  onDismiss,
  onRetry,
  isOpen,
  query,
  isLoading = false,
  error = null,
  activeIndex,
  onActiveIndexChange,
  anchorRef,
}: MentionPopoverProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [layout, setLayout] = useState<FloatingLayout>({
    top: 0,
    left: 0,
    width: 320,
    maxHeight: 240,
    side: "top",
    ready: false,
  });

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
    const viewportRight = viewportLeft + viewportWidth;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const mobileHeader = document.querySelector<HTMLElement>("[data-chat-mobile-header]");
    const safeTop = Math.max(
      viewportTop + VIEWPORT_GAP,
      isMobile && mobileHeader ? mobileHeader.getBoundingClientRect().bottom + VIEWPORT_GAP : viewportTop + VIEWPORT_GAP,
    );
    const availableAbove = Math.max(0, anchorRect.top - safeTop - VIEWPORT_GAP);
    const availableBelow = Math.max(0, viewportBottom - anchorRect.bottom - VIEWPORT_GAP);
    const side = isMobile
      ? "top"
      : availableBelow >= 220 || availableBelow >= availableAbove
        ? "bottom"
        : "top";
    const availableHeight = side === "bottom" ? availableBelow : availableAbove;
    const maxHeight = Math.max(0, Math.min(DESKTOP_MAX_HEIGHT, availableHeight));
    const width = Math.min(
      isMobile ? anchorRect.width : Math.max(320, Math.min(anchorRect.width, DESKTOP_MAX_WIDTH)),
      viewportWidth - VIEWPORT_GAP * 2,
    );
    const left = Math.min(
      Math.max(anchorRect.left, viewportLeft + VIEWPORT_GAP),
      viewportRight - width - VIEWPORT_GAP,
    );
    const measuredHeight = Math.min(panelRef.current?.scrollHeight ?? maxHeight, maxHeight);
    const top = side === "bottom"
      ? anchorRect.bottom + VIEWPORT_GAP
      : Math.max(safeTop, anchorRect.top - VIEWPORT_GAP - measuredHeight);

    setLayout({ top, left, width, maxHeight, side, ready: true });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!isOpen || !mounted) return;
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, error, isLoading, isOpen, mounted, query, references.length, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const viewport = window.visualViewport;
    const anchorObserver = new ResizeObserver(updatePosition);
    if (anchorRef.current) anchorObserver.observe(anchorRef.current);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);

    return () => {
      anchorObserver.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
    };
  }, [anchorRef, isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [anchorRef, isOpen, onDismiss]);

  useEffect(() => {
    const activeOption = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    activeOption?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          id="chat-reference-popover"
          key="mention-popover"
          role="dialog"
          aria-label="Choose a course or uploaded material"
          aria-busy={isLoading}
          data-side={layout.side}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: layout.side === "top" ? 4 : -4, scale: 0.98 }}
          animate={{ opacity: layout.ready ? 1 : 0, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: layout.side === "top" ? 4 : -4, scale: 0.98 }}
          transition={{ duration: reduceMotion ? 0 : 0.12, ease: "easeOut" }}
          className="fixed z-[45] flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl shadow-black/40"
          style={{
            top: layout.top,
            left: layout.left,
            width: layout.width,
            maxHeight: layout.maxHeight,
            visibility: layout.ready ? "visible" : "hidden",
          }}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200">Courses & materials</p>
              <p className="truncate text-[11px] text-slate-500">
                {query ? `Results for “${query}”` : "Type after @ to filter"}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-24 items-center justify-center gap-2 px-4 py-6 text-sm text-slate-400" role="status">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400 motion-reduce:animate-none" aria-hidden="true" />
              Loading materials…
            </div>
          ) : error ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-3 px-4 py-5 text-center" role="alert">
              <p className="text-sm text-amber-200">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm text-slate-200 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : references.length === 0 ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-5 text-center" role="status">
              <p className="text-sm text-slate-300">
                {query ? `No materials match “${query}”.` : "No ready materials or courses yet."}
              </p>
              {!query && (
                <Link
                  href="/upload"
                  onClick={onDismiss}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-cyan-400 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  Upload a material
                </Link>
              )}
            </div>
          ) : (
            <div
              id="chat-reference-listbox"
              ref={listRef}
              role="listbox"
              aria-label="Available courses and materials"
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-1"
            >
              {references.map((reference, index) => {
                const isCourse = reference.kind === "course";
                const metadata = isCourse
                  ? reference.code || "Course"
                  : [reference.courseCode, formatFileType(reference.fileType)].filter(Boolean).join(" · ");

                return (
                  <button
                    id={`chat-reference-option-${reference.kind}-${reference.id}`}
                    key={`${reference.kind}-${reference.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    data-index={index}
                    title={reference.title}
                    onMouseEnter={() => onActiveIndexChange(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(reference)}
                    className={`flex min-h-12 w-full min-w-0 items-center gap-3 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 ${
                      index === activeIndex ? "bg-[#242424]" : "hover:bg-[#1c1c1c]"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-400">
                      {isCourse ? <BookOpen className="h-4 w-4" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-200">{reference.title}</span>
                      <span className="block truncate text-[11px] text-slate-500">{metadata}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="hidden shrink-0 items-center gap-2 border-t border-white/5 px-3 py-2 text-[10px] text-slate-500 sm:flex">
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">↑↓</kbd>
            <span>Navigate</span>
            <kbd className="ml-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5">Enter</kbd>
            <span>Select</span>
            <kbd className="ml-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5">Esc</kbd>
            <span>Close</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
