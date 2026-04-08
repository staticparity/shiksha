"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatContainer } from "@/components/chat/chat-container";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface TeachPageClientProps {
  topicId: string;
  topicTitle: string;
  topicSubject: string;
  topicChapter: string | null;
  classId: string;
  schoolId: string;
  userId: string;
}

export function TeachPageClient({
  topicId,
  topicTitle,
  topicSubject,
  topicChapter,
  classId,
  schoolId,
  userId,
}: TeachPageClientProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          class_id: classId,
          school_id: schoolId,
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
  }, [topicId, classId, schoolId, userId]);

  const handleFinish = useCallback(async () => {
    if (!sessionId) return;
    setIsScoring(true);
    setError(null);

    try {
      const chatMessages = getMessagesRef.current?.() ?? [];
      const clientTranscript = chatMessages
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => {
          const text = msg.content
            ?? msg.parts?.find((p: { type: string; text?: string }) => p.type === "text")?.text
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

  if (!sessionId) {
    return (
      <div className={styles.preSession}>
        <div className={styles.preSessionCard}>
          <div className={styles.emoji}>🎓</div>
          <h1 className={styles.preTitle}>Teach: {topicTitle}</h1>
          <p className={styles.preSubtitle}>
            {topicChapter ? `${topicChapter} · ` : ""}
            {topicSubject}
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

  return (
    <ChatContainer
      topicId={topicId}
      topicTitle={topicTitle}
      topicSubject={topicSubject}
      topicChapter={topicChapter ?? undefined}
      sessionId={sessionId}
      onFinish={handleFinish}
      getMessagesRef={getMessagesRef}
    />
  );
}
