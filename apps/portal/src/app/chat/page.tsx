"use client";

import { useState, useRef, useEffect } from "react";
import Navbar from "@/components/navbar";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const suggestions = [
  "社内規定について",
  "プロジェクト情報",
  "システムの使い方",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const messageText = text ?? input.trim();
    if (!messageText || loading) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: messageText,
      timestamp: formatTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: unknown;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "chat request failed");
      }

      const reply =
        typeof data.reply === "string" && data.reply.trim()
          ? data.reply
          : "応答を生成できませんでした。もう一度お試しください。";

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: reply,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "エラーが発生しました。しばらくしてから再度お試しください。",
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />

      <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto overflow-hidden">
        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {!hasMessages ? (
            /* Welcome state */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-1">
                TechVault AI Assistant
              </h2>
              <p className="text-sm text-text-secondary mb-6">
                社内の質問にお答えします。何でもお聞きください。
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="bg-white border border-border rounded-card px-4 py-2.5 text-sm text-text-primary hover:bg-surface hover:shadow-card transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages list */
            <div className="space-y-6">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="w-4 h-4 text-primary"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2L3 7V12C3 16.97 7.02 21.63 12 22.63C16.98 21.63 21 16.97 21 12V7L12 2Z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] ${
                      msg.role === "user" ? "order-first" : ""
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <p className="text-xs text-text-secondary mb-1 font-medium">
                        TechVault AI
                      </p>
                    )}
                    <div
                      className={`rounded-card px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-white"
                          : "bg-white shadow-card text-text-primary"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p
                      className={`text-xs text-text-secondary mt-1 ${
                        msg.role === "user" ? "text-right" : "text-left"
                      }`}
                    >
                      {msg.timestamp}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-4 h-4 text-primary"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2L3 7V12C3 16.97 7.02 21.63 12 22.63C16.98 21.63 21 16.97 21 12V7L12 2Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 font-medium">
                      TechVault AI
                    </p>
                    <div className="bg-white shadow-card rounded-card px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-white px-4 sm:px-6 py-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="メッセージを入力..."
                rows={1}
                className="input-field resize-none pr-12 min-h-[42px] max-h-[120px]"
              />
              <span className="absolute right-3 bottom-2.5 text-xs text-text-secondary">
                {input.length}
              </span>
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="btn-primary p-2.5 flex-shrink-0"
              aria-label="送信"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            Enterで送信、Shift+Enterで改行
          </p>
        </div>
      </div>
    </div>
  );
}
