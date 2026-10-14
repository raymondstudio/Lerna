"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat/types";
import { ChatMessage as ChatMessageComponent } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";

interface ApiChatResponse {
  success: boolean;
  requestId: string;
  data?: {
    message: ChatMessage;
  };
  error?: {
    code: string;
    message: string;
  };
}

const INITIAL_WELCOME: ChatMessage = {
  id: "welcome-msg",
  role: "assistant",
  content:
    "Hi, I'm Lerna, your AI tutor. Ask me anything you'd like to learn, and I'll explain it step-by-step with clear examples.",
  timestamp: 0,
};

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Main handler for sending messages
  const handleSend = async (text: string) => {
    if (!text.trim() || loading) {
      console.warn("[chat] Ignoring send: empty text or already loading");
      return;
    }

    setError(null);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);

    console.info("[chat] Sending message", {
      userId: userMessage.id,
      preview: text.slice(0, 100),
      totalMessages: updatedMessages.length,
    });

    try {
      // Call backend API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      // Parse response
      let data: ApiChatResponse;
      try {
        data = (await response.json()) as ApiChatResponse;
      } catch (parseErr) {
        console.error("[chat] Failed to parse API response", {
          status: response.status,
          error: parseErr,
        });
        throw new Error("Invalid response from server");
      }

      console.debug("[chat] API response received", {
        requestId: data.requestId,
        success: data.success,
        status: response.status,
      });

      // Handle error response
      if (!data.success || !response.ok) {
        const errorMsg = data.error?.message || "Failed to get a response from the tutor";
        setError(errorMsg);
        console.error("[chat] API error response", {
          code: data.error?.code,
          message: errorMsg,
          requestId: data.requestId,
        });

        // Add error message to chat
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Sorry, I encountered an issue: ${errorMsg}`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // Success: add assistant message
      const assistantMessage = data.data?.message;
      if (assistantMessage && assistantMessage.content) {
        setMessages((prev) => [...prev, assistantMessage]);
        console.info("[chat] Assistant message added", {
          id: assistantMessage.id,
          length: assistantMessage.content.length,
          requestId: data.requestId,
        });
      } else {
        throw new Error("Malformed response: missing message data");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Network error. Please try again.";
      console.error("[chat] Request failed", { error: err, message: errorMsg });
      setError(errorMsg);

      // Add error message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `I couldn't process your request: ${errorMsg}. Please try again.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const starterPrompts = [
    "Explain photosynthesis like I'm 12.",
    "Compare mitosis and meiosis with a simple table.",
    "Make me a 7-day study plan for algebra.",
  ];

  return (
    <div className="flex h-full min-h-[calc(100dvh-20rem)] w-full flex-col gap-4">
      <div className="scrollbar-hide flex-1 overflow-y-auto rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-4 shadow-glow sm:p-6">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <ChatMessageComponent key={msg.id} message={msg} />
          ))}

          {/* Typing Indicator */}
          {loading ? (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          ) : null}

          {/* Error Alert */}
          {error ? (
            <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
              <span className="font-semibold">Error:</span> {error}
            </div>
          ) : null}

          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="w-full flex flex-col pb-1">
        {messages.length === 1 && !loading && (
          <div className="mb-3 flex w-full snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 md:mb-4 md:flex-wrap md:justify-center md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="min-h-11 shrink-0 snap-start whitespace-nowrap rounded-full border border-white/10 bg-[#141414] px-4 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:bg-[#202020] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:pointer-events-none disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
}