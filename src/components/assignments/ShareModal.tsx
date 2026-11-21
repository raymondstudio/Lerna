"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Copy, Check, Globe, Lock, RotateCw, ExternalLink, Sparkles, Loader2 } from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId?: string;
  assignmentTitle?: string;
  initialIsPublic?: boolean;
  shareToken?: string;
  onVisibilityChange?: (isPublic: boolean) => void;
  isCollection?: boolean;
  collectionTitle?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  assignmentId,
  assignmentTitle,
  initialIsPublic = false,
  shareToken,
  onVisibilityChange,
  isCollection = false,
}: ShareModalProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [token, setToken] = useState(shareToken || "");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    async function fetchLatest() {
      try {
        setFetchingStatus(true);
        const endpoint = isCollection
          ? "/api/assignments/collection/share"
          : `/api/assignments/${assignmentId}/share`;

        const res = await fetch(endpoint);
        const data = await res.json();
        if (active && res.ok && data.success) {
          if (data.isPublic !== undefined) setIsPublic(data.isPublic);
          if (data.collection?.isPublic !== undefined) setIsPublic(data.collection.isPublic);
          if (data.shareToken) setToken(data.shareToken);
          if (data.collection?.shareToken) setToken(data.collection.shareToken);
        }
      } catch {
        // Non-fatal, use props
      } finally {
        if (active) setFetchingStatus(false);
      }
    }

    if (isCollection || assignmentId) {
      fetchLatest();
    }

    return () => {
      active = false;
    };
  }, [isOpen, assignmentId, isCollection]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const sharePath = isCollection
    ? `/share/collection/${token}`
    : `/share/assignments/${token}`;
  const shareUrl = token ? `${origin}${sharePath}` : "";

  const handleTogglePublic = async () => {
    try {
      setLoading(true);
      setError(null);
      const newStatus = !isPublic;
      const endpoint = isCollection
        ? "/api/assignments/collection/share"
        : `/api/assignments/${assignmentId}/share`;

      const res = await fetch(endpoint, {
        method: newStatus ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: newStatus ? JSON.stringify({ isPublic: true }) : undefined,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update share settings.");
      }

      setIsPublic(newStatus);
      if (data.shareToken) setToken(data.shareToken);
      if (data.collection?.shareToken) setToken(data.collection.shareToken);
      onVisibilityChange?.(newStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating link.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = isCollection
        ? "/api/assignments/collection/share"
        : `/api/assignments/${assignmentId}/share`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true, isPublic: true }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to regenerate share link.");
      }

      setIsPublic(true);
      if (data.shareToken) setToken(data.shareToken);
      if (data.collection?.shareToken) setToken(data.collection.shareToken);
      onVisibilityChange?.(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate new link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy link to clipboard.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">
              {isCollection ? "Share Assignments Portfolio" : "Share Assignment"}
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isCollection
              ? "Publish your solved assignments as a shareable academic portfolio for classmates and tutors."
              : `Share "${assignmentTitle || "this assignment"}" with read-only access and interactive math rendering.`}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-[#141414] p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Globe className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {isPublic ? "Publicly Accessible" : "Private (Only You)"}
                </p>
                <p className="text-xs text-slate-400">
                  {isPublic
                    ? "Anyone with the link can view this solution."
                    : "Only you can view or modify this content."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTogglePublic}
              disabled={loading || fetchingStatus}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 disabled:opacity-50 ${
                isPublic
                  ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                  : "bg-cyan-500 hover:bg-cyan-400 text-black"
              }`}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isPublic ? (
                "Make Private"
              ) : (
                "Make Public"
              )}
            </button>
          </div>

          {isPublic && token && (
            <div className="space-y-2.5 pt-3 border-t border-white/5">
              <label className="text-xs font-medium text-slate-400">Shareable Public Link</label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 font-mono text-xs text-slate-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors shrink-0"
                  title="Copy link"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors shrink-0"
                  title="Open preview"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Regenerate link (revokes previous URL)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
