"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { 
  RotateCw, 
  Pencil, 
  Copy, 
  Check, 
  ThumbsUp,
  Clipboard, 
  ClipboardCheck,
  FileText
} from "lucide-react";

import Link from "next/link";
import type { ChatMessage as MsgType } from "@/lib/chat/types";

function safeMessageContent(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeTimestamp(value: unknown) {
  const timestamp = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 86400000);
  return `${days}d ago`;
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#161719] group/code">
      <div className="flex items-center justify-between border-b border-white/5 bg-[#121315] px-4 py-1.5 font-mono text-xs text-slate-400">
        <span className="uppercase text-[11px] font-semibold tracking-wider text-slate-400">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] hover:bg-white/5 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <ClipboardCheck className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-cyan-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Clipboard className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-200 scrollbar-thin">
        <code className={language ? `language-${language}` : ""}>{value}</code>
      </div>
    </div>
  );
}

export function ChatMessage({
  message,
  onRetry,
  onEdit,
}: {
  message?: MsgType | null;
  onRetry?: (text: string) => void;
  onEdit?: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);

  const safeMessage = {
    id: typeof message?.id === "string" ? message.id : "unknown-message",
    role: message?.role === "assistant" ? "assistant" : "user",
    content: safeMessageContent(message?.content),
    timestamp: safeTimestamp(message?.timestamp),
    sources: Array.isArray(message?.sources) ? message.sources : [],
  } satisfies MsgType;

  const isUser = safeMessage.role === "user";

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(safeMessage.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  // USER MESSAGE: Aligned to the RIGHT with dark pill bubble and 3 action icons on hover
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="group flex w-full flex-col items-end my-2"
      >
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl md:rounded-[1.35rem] bg-[#262628] px-4 py-3 text-slate-100 shadow-sm border border-white/5">
          <div className="whitespace-pre-wrap break-words text-sm md:text-[15px] leading-relaxed">
            {safeMessage.content || "(empty message)"}
          </div>
        </div>

        {/* Action Row on Hover: Timestamp + Retry + Edit + Copy */}
        <div className="mt-1.5 flex items-center gap-2.5 px-1 text-slate-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <span className="text-[11px] select-none text-slate-500 mr-0.5">
            {formatRelativeTime(safeMessage.timestamp)}
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={() => onRetry(safeMessage.content)}
              title="Retry from here"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(safeMessage.content)}
              title="Edit message"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleCopyMessage}
            title={copied ? "Copied" : "Copy text"}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </motion.div>
    );
  }

  // AI MESSAGE: Aligned to the LEFT with NO logos or images, clean typography, and 3 action icons on hover
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="group flex w-full flex-col items-start my-3"
    >
      <div className="w-full max-w-none text-slate-200 text-sm md:text-[15px] leading-relaxed">
        {safeMessage.content ? (
          <div className="markdown-content break-words text-slate-200 text-sm md:text-[15px] leading-relaxed prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
              components={{
                p: ({ children }) => <p className="mb-3.5 last:mb-0 leading-relaxed text-slate-200">{children}</p>,
                h1: ({ children }) => <h1 className="mb-3 mt-5 font-heading text-xl font-semibold text-white first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2.5 mt-4 font-heading text-lg font-semibold text-white first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-2 mt-3.5 font-heading text-base font-semibold text-white first:mt-0">{children}</h3>,
                ul: ({ children }) => <ul className="mb-3.5 ml-5 list-disc space-y-1.5 text-slate-200">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3.5 ml-5 list-decimal space-y-1.5 text-slate-200">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="my-3 border-l-2 border-cyan-500/50 pl-3.5 italic text-slate-300">{children}</blockquote>
                ),
                a: ({ children, href }) => (
                  <a href={href ?? "#"} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline decoration-cyan-400/40 underline-offset-4 hover:text-cyan-300">
                    {children}
                  </a>
                ),
                code: ({ node, inline, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const lang = match ? match[1] : "";
                  const content = String(children).replace(/\n$/, "");
                  const isInline = !match;
                  
                  if (isInline) {
                    return (
                      <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-cyan-200" {...props}>
                        {children}
                      </code>
                    );
                  }

                  return <CodeBlock language={lang} value={content} />;
                },
                pre: ({ children }) => <>{children}</>,
              }}
            >
              {safeMessage.content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-slate-500 italic">Thinking…</div>
        )}

        {/* Source Badges if RAG was used */}
        {safeMessage.sources && safeMessage.sources.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
            {safeMessage.sources.map((source, idx) => (
              <Link
                key={idx}
                href={source.documentId ? `/materials/${source.documentId}` : "/materials"}
                className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/40 hover:text-cyan-200 transition-colors cursor-pointer"
              >
                <FileText className="h-3 w-3 text-cyan-400 shrink-0" />
                {source.documentName || "Material source"}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Action Row on Hover: Copy + Retry + ThumbsUp */}
      <div className="mt-2.5 flex items-center gap-2 text-slate-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          type="button"
          onClick={handleCopyMessage}
          title={copied ? "Copied" : "Copy response"}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-cyan-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {onRetry && (
          <button
            type="button"
            onClick={() => onRetry(safeMessage.content)}
            title="Retry response"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setLiked(!liked)}
          title={liked ? "Helpful" : "Good response"}
          className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
            liked ? "text-cyan-400 bg-cyan-500/10" : "text-slate-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
