"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { TypingIndicator } from "./typing-indicator";
import { SessionTimer } from "./session-timer";
import { Button } from "@/components/ui/button";
import { getLearnerGreeting } from "@/lib/agents/learner";
import styles from "./chat-container.module.css";

interface ChatContainerProps {
  topicId: string;
  topicTitle: string;
  topicSubject: string;
  topicChapter?: string;
  sessionId: string;
  onFinish: () => void;
  getMessagesRef?: React.MutableRefObject<(() => any[]) | null>;
}

export function ChatContainer({
  topicId,
  topicTitle,
  topicSubject,
  topicChapter,
  sessionId,
  onFinish,
  getMessagesRef,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [startTime] = useState(() => new Date());
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [input, setInput] = useState("");

  const greeting = useRef(getLearnerGreeting(topicTitle));

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        body: { topicId, sessionId },
      }),
    [topicId, sessionId]
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    messages: [
      {
        id: "greeting",
        role: "assistant",
        parts: [{ type: "text", text: greeting.current }],
        createdAt: new Date(),
      },
    ],
  });

  // Expose messages to parent for scoring
  useEffect(() => {
    if (getMessagesRef) {
      getMessagesRef.current = () => messages;
    }
  }, [messages, getMessagesRef]);

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-scroll to bottom unless user has scrolled up
  const scrollToBottom = useCallback(() => {
    if (!isUserScrolled && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [isUserScrolled]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Detect user scroll
  const handleScroll = useCallback(() => {
    const container = messageContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsUserScrolled(!isAtBottom);
  }, []);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleFinish = () => {
    if (messages.length < 3) return;
    setShowFinishConfirm(true);
  };

  const confirmFinish = () => {
    setShowFinishConfirm(false);
    onFinish();
  };

  // Extract text content from message parts
  const getMessageText = (msg: (typeof messages)[number]): string => {
    return msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.topicTitle}>{topicTitle}</h1>
          <span className={styles.topicMeta}>
            {topicChapter ? `${topicChapter} · ` : ""}
            {topicSubject}
          </span>
        </div>
        <div className={styles.headerRight}>
          <SessionTimer startTime={startTime} />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleFinish}
            disabled={messages.length < 3 || isLoading}
          >
            Finish & Score
          </Button>
        </div>
      </div>

      {/* Message list */}
      <div
        ref={messageContainerRef}
        className={styles.messages}
        onScroll={handleScroll}
      >
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            role={message.role as "assistant" | "user"}
            content={getMessageText(message)}
            index={index}
          />
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <TypingIndicator />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {isUserScrolled && (
        <button
          className={styles.scrollButton}
          onClick={() => {
            setIsUserScrolled(false);
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          ↓ New messages
        </button>
      )}

      {/* Error display */}
      {error && (
        <div className={styles.error}>
          <p>Something went wrong. Please try again.</p>
        </div>
      )}

      {/* Input area */}
      <div className={styles.inputArea}>
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          disabled={isLoading}
          placeholder="Explain the concept in your own words..."
        />
      </div>

      {/* Finish confirmation modal */}
      {showFinishConfirm && (
        <div className={styles.overlay} onClick={() => setShowFinishConfirm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Ready to get your score?</h3>
            <p className={styles.modalText}>
              Your explanation will be evaluated for mastery. You can always try
              again later to improve your score.
            </p>
            <div className={styles.modalActions}>
              <Button variant="ghost" onClick={() => setShowFinishConfirm(false)}>
                Keep explaining
              </Button>
              <Button variant="primary" onClick={confirmFinish}>
                Get my score
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
