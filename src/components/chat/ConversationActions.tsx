"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoreHorizontal, Trash2 } from "lucide-react";

type ConversationActionsProps = {
  conversationId: string;
  conversationTitle: string;
  onRequestDelete: (conversationId: string, conversationTitle: string) => void;
};

export function ConversationActions({ conversationId, conversationTitle, onRequestDelete }: ConversationActionsProps) {
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const menuWidth = 208;
    const menuHeight = menuRef.current?.offsetHeight ?? 48;
    const gap = 6;
    const roomBelow = viewportTop + viewportHeight - rect.bottom;
    const top = roomBelow >= menuHeight + gap
      ? rect.bottom + gap
      : Math.max(viewportTop + 8, rect.top - menuHeight - gap);
    const left = Math.min(
      Math.max(viewportLeft + 8, rect.right - menuWidth),
      viewportLeft + viewportWidth - menuWidth - 8,
    );
    setPosition({ top, left, ready: true });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    updatePosition();
    const positionFrame = window.requestAnimationFrame(updatePosition);
    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(positionFrame);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [menuOpen, updatePosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const viewport = window.visualViewport;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    viewport?.addEventListener("resize", updatePosition);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      viewport?.removeEventListener("resize", updatePosition);
    };
  }, [menuOpen, updatePosition]);

  const portal = mounted
    ? createPortal(
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label={`Actions for ${conversationTitle}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -2 }}
              animate={{ opacity: position.ready ? 1 : 0, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -2 }}
              transition={{ duration: reduceMotion ? 0 : 0.1, ease: "easeOut" }}
              className="fixed z-[45] w-52 rounded-xl border border-white/10 bg-[#181818] p-1.5 shadow-2xl shadow-black/40"
              style={{ top: position.top, left: position.left, visibility: position.ready ? "visible" : "hidden" }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  triggerRef.current?.focus();
                  onRequestDelete(conversationId, conversationTitle);
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete conversation
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Conversation actions for ${conversationTitle}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          setPosition((current) => ({ ...current, ready: false }));
          setMenuOpen((current) => !current);
        }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 md:h-8 md:w-8 md:opacity-0 md:group-hover/conversation:opacity-100 md:group-focus-within/conversation:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {portal}

    </>
  );
}
