"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { SessionTimer } from "./session-timer";
import { Button } from "@/components/ui/button";
import { PipAvatar } from "@/components/pip/pip-avatar";
import { AmbientLeaves } from "@/components/pip/ambient-leaves";
import { getLearnerGreeting } from "@/lib/agents/learner";
import { ZERO_SIGNALS, type TeachingSignals } from "@/lib/agents/evaluator";
import styles from "./chat-container.module.css";

/** OR-merge: a signal once true stays true for the rest of the session. */
function mergeSignals(prev: TeachingSignals, next: Partial<TeachingSignals>): TeachingSignals {
  return {
    definition: prev.definition || !!next.definition,
    example: prev.example || !!next.example,
    mechanism: prev.mechanism || !!next.mechanism,
    cause: prev.cause || !!next.cause,
    connection: prev.connection || !!next.connection,
  };
}

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
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [startTime] = useState(() => new Date());
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [input, setInput] = useState("");
  const [pipSignals, setPipSignals] = useState<TeachingSignals>(ZERO_SIGNALS);

  const greeting = useRef(getLearnerGreeting(topicTitle));

  // /api/chat sends the Evaluator's per-turn signal read in a response
  // header (there's no data-part channel on the plain text-stream protocol
  // this transport uses) — a custom fetch lets us read it without touching
  // the streamed body the SDK consumes.
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        body: { topicId, sessionId },
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          const raw = res.headers.get("x-pip-signals");
          if (raw) {
            try {
              setPipSignals((prev) => mergeSignals(prev, JSON.parse(raw)));
            } catch {
              // Malformed header — not worth failing the turn over.
            }
          }
          return res;
        },
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

  // Extract text content from message parts
  const getMessageText = (msg: (typeof messages)[number]): string => {
    return msg.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  };

  // Pip's current line is the latest assistant message — this is the whole
  // interaction model: one bubble at a time, full history behind Transcript.
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const pipMessage = lastAssistantMessage ? getMessageText(lastAssistantMessage) : "";
  const pipIsTyping = isLoading && messages[messages.length - 1]?.role !== "assistant";

  useEffect(() => {
    if (showTranscript) transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showTranscript]);

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
          <Button variant="secondary" size="sm" onClick={() => setShowTranscript(true)}>
            ☰ Transcript
          </Button>
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

      {/* Pip stage */}
      <div className={styles.stage}>
        <AmbientLeaves />
        <div className={styles.pipStageInner}>
          <PipAvatar
            message={pipMessage}
            isTyping={pipIsTyping}
            signals={messages.length > 1 ? pipSignals : undefined}
          />
        </div>
      </div>

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
          placeholder="Explain it to Pip in your own words…"
        />
      </div>

      {/* Transcript panel */}
      {showTranscript && (
        <div className={styles.overlay} onClick={() => setShowTranscript(false)}>
          <div className={styles.transcriptPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.transcriptHead}>
              <h2 className={styles.modalTitle}>Your lesson with Pip</h2>
              <button
                className={styles.closeBtn}
                onClick={() => setShowTranscript(false)}
                aria-label="Close transcript"
              >
                ✕
              </button>
            </div>
            <div className={styles.transcriptBody}>
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  role={message.role as "assistant" | "user"}
                  content={getMessageText(message)}
                  index={index}
                />
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      )}

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
