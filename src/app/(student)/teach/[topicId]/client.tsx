"use client";

import type { SavedSession } from "@/lib/learning/session";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChatContainer } from "@/components/chat/chat-container";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface TeachPageClientProps {
  initialSession: SavedSession | null;
  topicId: string;
  topicTitle: string;
  topicSubject: string;
  topicChapter: string | null;
  classId: string;
  schoolId: string;
  userId: string;
}

export function TeachPageClient({
  initialSession,
  topicId,
  topicTitle,
  topicSubject,
  topicChapter,
  classId,
  schoolId,
  userId,
}: TeachPageClientProps) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.id ?? null);
  const [isCreating, setIsCreating] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);


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
      const response = await fetch("/api/mastery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        // A response can be lost after the transaction commits. Recover that
        // completed score instead of leaving the student in a retry loop.
        if (response.status === 409) {
          const saved = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
          if (saved.ok && (await saved.json()).status === "completed") {
            router.push(`/results/${sessionId}`);
            return;
          }
        }
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


  return (
    <>
    {isScoring && <div className={styles.scoringOverlay} role="status"><div className={styles.scoringContent}><div className={styles.scoringSpinner} /><h2>Evaluating your explanation…</h2><p>Looking at your understanding, reasoning, and examples.</p></div></div>}
    <div inert={isScoring}>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <ChatContainer
      topicId={topicId}
      topicTitle={topicTitle}
      topicSubject={topicSubject}
      topicChapter={topicChapter ?? undefined}
      key={sessionId}
      initialSession={initialSession}
      sessionId={sessionId}
      onFinish={handleFinish}
    />
    </div>
    </>
  );
}
