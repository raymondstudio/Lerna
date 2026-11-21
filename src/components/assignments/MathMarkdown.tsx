"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Copy, Check } from "lucide-react";

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#161719]">
      <div className="flex items-center justify-between border-b border-white/5 bg-[#121315] px-4 py-1.5 font-mono text-xs text-slate-400">
        <span className="uppercase text-[11px] font-semibold tracking-wider text-slate-400">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] hover:bg-white/5 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-cyan-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
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

export function MathMarkdown({ content }: { content: string }) {
  return (
    <div className="markdown-content text-sm sm:text-base leading-relaxed text-slate-200 space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          h1: ({ ...props }) => <h1 className="text-xl sm:text-2xl font-bold text-white mt-6 mb-3 border-b border-white/10 pb-2" {...props} />,
          h2: ({ ...props }) => <h2 className="text-lg sm:text-xl font-semibold text-white mt-5 mb-2" {...props} />,
          h3: ({ ...props }) => <h3 className="text-base sm:text-lg font-semibold text-cyan-300 mt-4 mb-2" {...props} />,
          h4: ({ ...props }) => <h4 className="text-sm sm:text-base font-semibold text-purple-300 mt-3 mb-1" {...props} />,
          p: ({ ...props }) => <p className="mb-3 leading-relaxed text-slate-200" {...props} />,
          ul: ({ ...props }) => <ul className="list-disc pl-5 my-2 space-y-1.5 text-slate-200" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1.5 text-slate-200" {...props} />,
          strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
          blockquote: ({ ...props }) => (
            <blockquote className="border-l-4 border-cyan-500/50 bg-cyan-500/5 rounded-r-xl pl-4 py-2 my-3 text-slate-300 italic" {...props} />
          ),
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-4 rounded-xl border border-white/10">
              <table className="w-full text-left text-xs border-collapse" {...props} />
            </div>
          ),
          th: ({ ...props }) => <th className="bg-[#161719] border-b border-white/10 p-3 font-semibold text-slate-300" {...props} />,
          td: ({ ...props }) => <td className="border-b border-white/5 p-3 text-slate-300" {...props} />,
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !String(children).includes("\n");
            if (isInline) {
              return (
                <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-cyan-300 font-semibold" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match?.[1] || ""} value={String(children).replace(/\n$/, "")} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
