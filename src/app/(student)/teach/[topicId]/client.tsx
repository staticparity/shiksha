"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatContainer } from "@/components/chat/chat-container";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface TeachPageClientProps {
  topicId: string;
  topic: {
    title: string;
    subject: string;
    chapter: string | null;
    class_id: string;
    classes: {
      school_id: string;
    };
  };
  userId: string;
}

export function TeachPageClient({ topicId, topic, userId }: TeachPageClientProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to get current messages from ChatContainer
  const getMessagesRef = useRef<(() => any[]) | null>(null);

  const createSession = useCallback(async () => {
    setIsCreating(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("sessions")
        .insert({
          student_id: userId,
          topic_id: topicId,
          class_id: topic.class_id,
          school_id: (topic as any).classes?.school_id,
          status: "active",
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      setSessionId(data.id);
    } catch (err) {
      setError("Failed to start session. Please try again.");
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  }, [topicId, topic, userId]);

  const handleFinish = useCallback(async () => {
    if (!sessionId) return;
    setIsScoring(true);
    setError(null);

    try {
      // Get messages from the chat container and format them as transcript
      const chatMessages = getMessagesRef.current?.() ?? [];
      const clientTranscript = chatMessages
        .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
        .map((msg: any) => {
          const text = msg.content
            ?? msg.parts?.find((p: any) => p.type === "text")?.text
            ?? "";
          return {
            role: msg.role === "user" ? "student" : "learner",
            content: text,
            timestamp: msg.createdAt?.toISOString?.() ?? new Date().toISOString(),
          };
        });

      const response = await fetch("/api/mastery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, clientTranscript }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Scoring failed");
      }

      router.push(`/results/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
      setIsScoring(false);
    }
  }, [sessionId, router]);

  // Pre-session: start button
  if (!sessionId) {
    return (
      <div className={styles.preSession}>
        <div className={styles.preSessionCard}>
          <div className={styles.emoji}>🎓</div>
          <h1 className={styles.preTitle}>Teach: {topic.title}</h1>
          <p className={styles.preSubtitle}>
            {topic.chapter ? `${topic.chapter} · ` : ""}
            {topic.subject}
          </p>
          <p className={styles.preDescription}>
            You&apos;ll be explaining this topic to a curious AI learner who
            knows nothing about it. The AI will ask questions as you explain.
            When you&apos;re done, you&apos;ll get a mastery score based on how
            well you explained.
          </p>
          <div className={styles.preTips}>
            <h3>💡 Tips for a high score:</h3>
            <ul>
              <li>Explain in your own words, not textbook language</li>
              <li>Cover the key concepts thoroughly</li>
              <li>Answer follow-up questions with depth</li>
              <li>Use analogies and examples when you can</li>
            </ul>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <Button
            variant="primary"
            size="lg"
            onClick={createSession}
            loading={isCreating}
            fullWidth
          >
            Start Teaching
          </Button>
        </div>
      </div>
    );
  }

  // Scoring state
  if (isScoring) {
    return (
      <div className={styles.scoring}>
        <div className={styles.scoringContent}>
          <div className={styles.scoringSpinner} />
          <h2 className={styles.scoringTitle}>Evaluating your explanation...</h2>
          <p className={styles.scoringText}>
            Our expert is analyzing your conversation for mastery, accuracy,
            depth, and clarity.
          </p>
        </div>
      </div>
    );
  }

  // Active session: chat
  return (
    <ChatContainer
      topicId={topicId}
      topicTitle={topic.title}
      topicSubject={topic.subject}
      topicChapter={topic.chapter ?? undefined}
      sessionId={sessionId}
      onFinish={handleFinish}
      getMessagesRef={getMessagesRef}
    />
  );
}
