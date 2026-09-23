"use client";

import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { SavedSessionSchema, sessionMessages, sessionSignals, type SavedSession } from "@/lib/learning/session";
import { TextStreamChatTransport, type UIMessage } from "ai";
import { useRef, useEffect, useState, useMemo } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { SessionTimer } from "./session-timer";
import { Button } from "@/components/ui/button";
import { PipAvatar } from "@/components/pip/pip-avatar";
import { AmbientLeaves } from "@/components/pip/ambient-leaves";
import { TeachingSignalsSchema, mergeSignals, type TeachingSignals } from "@/lib/agents/signals";
import styles from "./chat-container.module.css";

interface ChatContainerProps {
  initialSession: SavedSession | null;
  topicId: string;
  topicTitle: string;
  topicSubject: string;
  topicChapter?: string;
  sessionId: string;
  onFinish: () => void;
}

export function ChatContainer({
  initialSession,
  topicId,
  topicTitle,
  topicSubject,
  topicChapter,
  sessionId,
  onFinish,
}: ChatContainerProps) {
  const router = useRouter();
  const pendingSignals = useRef<TeachingSignals | null>(null);
  const pendingText = useRef("");
  const [savedCount, setSavedCount] = useState(initialSession?.transcript.length ?? 0);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [notice, setNotice] = useState(initialSession ? "Your saved conversation has been restored." : "");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [startTime] = useState(() => new Date(initialSession?.started_at ?? Date.now()));
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [input, setInput] = useState("");
  const [pipSignals, setPipSignals] = useState<TeachingSignals>(() => sessionSignals(initialSession));

  const greeting: UIMessage = { id: "greeting", role: "assistant", parts: [{ type: "text", text: `Can you teach me about ${topicTitle}? Start with the main idea, in your own words.` }] };
  const initialMessages = initialSession?.transcript.length ? sessionMessages(initialSession) : [greeting];

  // /api/chat sends the Evaluator's per-turn signal read in a response
  // header (there's no data-part channel on the plain text-stream protocol
  // this transport uses) — a custom fetch lets us read it without touching
  // the streamed body the SDK consumes.
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/chat",
        body: { topicId, sessionId },
        prepareSendMessagesRequest: ({ messages, body }) => ({ body: { ...body, messages: messages.slice(-1) } }),
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          if (!res.ok) throw new Error((await res.text()).slice(0, 300) || "Could not send your explanation.");
          const raw = res.headers.get("x-pip-signals");
          if (raw) {
            try {
              const parsed = TeachingSignalsSchema.safeParse(JSON.parse(raw));
              pendingSignals.current = parsed.success ? parsed.data : null;
            } catch {
              // Malformed header — not worth failing the turn over.
            }
          }
          return res;
        },
      }),
    [topicId, sessionId]
  );

  const { messages, sendMessage, status, error, setMessages, clearError } = useChat({
    id: sessionId,
    transport,
    messages: initialMessages,
    onFinish: ({ isAbort, isDisconnect, isError }) => {
      if (isAbort || isDisconnect || isError) return;
      // The stream closes only after the server has saved the turn.
      const signals = pendingSignals.current;
      if (signals) setPipSignals(prev => mergeSignals(prev, signals));
      pendingSignals.current = null;
      pendingText.current = "";
      setSavedCount(count => count + 2);
    },
    onError: () => { pendingSignals.current = null; },
  });

  async function restoreSavedConversation() {
    setRecovering(true);
    setRecoveryError("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not restore your conversation. Please try again.");
      const saved = SavedSessionSchema.parse(await response.json());
      if (saved.status === "completed") { router.push(`/results/${sessionId}`); return; }
      if (saved.status === "abandoned") throw new Error("This session has ended. Return to your topics to start again.");
      setMessages(saved.transcript.length ? sessionMessages(saved) : [greeting]);
      // A lost HTTP response may still have committed. Never blindly resend it.
      setInput(saved.transcript.length > savedCount ? "" : pendingText.current);
      setSavedCount(saved.transcript.length);
      setPipSignals(sessionSignals(saved));
      clearError();
      setNotice(saved.status === "scoring" ? "Your score may still be processing. Wait a moment before finishing again." : "Saved conversation restored. Review your explanation before sending again.");
    } catch (error) { setRecoveryError(error instanceof Error ? error.message : "Could not restore your conversation."); }
    finally { setRecovering(false); }
  }

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
    if (!input.trim() || isLoading || error || recovering) return;
    pendingText.current = input;
    pendingSignals.current = null;
    setNotice("");
    sendMessage({ text: input });
    setInput("");
  };

  const handleFinish = () => {
    if (savedCount < 2 || isLoading || error || recovering) return;
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
            disabled={savedCount < 2 || isLoading || !!error || recovering}
          >
            Finish & Score
          </Button>
        </div>
      </div>

      {notice && <p className={styles.notice} role="status">{notice}</p>}
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
        <div className={styles.error} role="alert">
          <p>{recoveryError || "Your last reply could not be confirmed. Restore the saved conversation before continuing."}</p>
          <Button variant="secondary" size="sm" onClick={restoreSavedConversation} loading={recovering}>Restore saved conversation</Button>
        </div>
      )}

      {/* Input area */}
      <div className={styles.inputArea}>
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          disabled={isLoading || !!error || recovering}
          placeholder="Explain it to Pip in your own words…"
        />
      </div>

      {/* Transcript panel */}
      {showTranscript && (
        <Dialog labelledBy="transcript-title" className={styles.transcriptPanel} onClose={() => setShowTranscript(false)}>
            <div className={styles.transcriptHead}>
              <h2 id="transcript-title" className={styles.modalTitle}>Your lesson with Pip</h2>
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
        </Dialog>
      )}

      {/* Finish confirmation modal */}
      {showFinishConfirm && (
        <Dialog labelledBy="finish-title" className={styles.modal} onClose={() => setShowFinishConfirm(false)}>
            <h3 id="finish-title" className={styles.modalTitle}>Ready to get your score?</h3>
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
        </Dialog>
      )}
    </div>
  );
}
