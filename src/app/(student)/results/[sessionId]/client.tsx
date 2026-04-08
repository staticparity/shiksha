"use client";

import { MasteryRing } from "@/components/ui/mastery-ring";
import { GapChip } from "@/components/ui/gap-chip";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils/format";
import { sortGapsBySeverity } from "@/lib/scoring/gap-detector";
import type { Gap } from "@/lib/agents/wisdom";
import Link from "next/link";
import styles from "./page.module.css";

interface ResultsClientProps {
  session: {
    id: string;
    mastery_score: number;
    strengths: string[];
    gaps: Gap[];
    assessment: string;
    duration_seconds: number;
    recitation_detected: boolean;
    follow_up_quality: string;
    topic_id: string;
    topics: {
      title: string;
      subject: string;
    };
  };
  creditsEarned: number;
}

export function ResultsClient({ session, creditsEarned }: ResultsClientProps) {
  const sortedGaps = sortGapsBySeverity(session.gaps ?? []);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Mastery Ring */}
        <div className={styles.ringSection}>
          <MasteryRing score={session.mastery_score} size={200} animated />
        </div>

        {/* Topic Info */}
        <div className={styles.topicInfo}>
          <h2 className={styles.topicTitle}>{session.topics.title}</h2>
          <span className={styles.topicMeta}>
            {session.topics.subject} · {formatDuration(session.duration_seconds)}
          </span>
          {creditsEarned > 0 && (
            <div className={styles.creditsEarned}>
              +{creditsEarned} Mastery Credit{creditsEarned > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Assessment */}
        <p className={styles.assessment}>{session.assessment}</p>

        {/* Recitation Warning */}
        {session.recitation_detected && (
          <div className={styles.recitationWarning}>
            <span>📋</span>
            <div>
              <strong>Recitation detected</strong>
              <p>
                Your explanation sounded like it was copied from a textbook.
                Try explaining in your own words next time — genuine
                understanding scores higher!
              </p>
            </div>
          </div>
        )}

        {/* Strengths */}
        {session.strengths && session.strengths.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>What you explained well</h3>
            <ul className={`${styles.strengthsList} stagger-children`}>
              {session.strengths.map((strength, i) => (
                <li key={i} className={styles.strengthItem}>
                  <span className={styles.checkIcon}>✅</span>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gaps */}
        {sortedGaps.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              Where your explanation broke down
            </h3>
            <div className={styles.gapsList}>
              {sortedGaps.map((gap, i) => (
                <GapChip key={i} gap={gap} index={i} animated />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <Link href={`/teach/${session.topic_id}`}>
            <Button variant="primary" size="lg" fullWidth>
              Try Again
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary" size="lg" fullWidth>
              Back to Topics
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
