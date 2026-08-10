"use client";

import { MasteryRing } from "@/components/ui/mastery-ring";
import { GapChip } from "@/components/ui/gap-chip";
import { MisconceptionChipList } from "@/components/ui/misconception-chip";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils/format";
import { sortGapsBySeverity } from "@/lib/scoring/gap-detector";
import { getAxisBandGradient, getAxisBandLabel, getAxisBandSegments } from "@/lib/scoring/mastery-calculator";
import type { Gap, AxisBand } from "@/lib/agents/wisdom";
import type { Misconception } from "@/lib/supabase/database.types";
import Link from "next/link";
import styles from "./page.module.css";

interface ResultsClientProps {
  session: {
    id: string;
    mastery_score: number;
    understanding_band: AxisBand | null;
    explanation_band: AxisBand | null;
    misconceptions: Misconception[];
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
      knowledge_base: { common_misconceptions?: string[] } | null;
    };
  };
  creditsEarned: number;
}

export function ResultsClient({ session, creditsEarned }: ResultsClientProps) {
  const sortedGaps = sortGapsBySeverity(session.gaps ?? []);
  const knownMisconceptions = session.topics.knowledge_base?.common_misconceptions;

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

        {/* Two-Axis Bands — segmented fill bars, rust=Understanding / bamboo=Explanation.
            Never merged into one number. Visual language: DESIGN.md (Pip direction). */}
        {(session.understanding_band || session.explanation_band) && (
          <div className={styles.axisRow}>
            <div className={styles.axisBand}>
              <div className={styles.axisLabel}>
                <span>Understanding</span>
                <b>{getAxisBandLabel(session.understanding_band)}</b>
              </div>
              <div className={styles.axisDots}>
                {Array.from({ length: 4 }, (_, i) => (
                  <span
                    key={i}
                    className={styles.axisDot}
                    style={
                      i < getAxisBandSegments(session.understanding_band)
                        ? { background: getAxisBandGradient("understanding") }
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
            <div className={styles.axisBand}>
              <div className={styles.axisLabel}>
                <span>Explanation</span>
                <b>{getAxisBandLabel(session.explanation_band)}</b>
              </div>
              <div className={styles.axisDots}>
                {Array.from({ length: 4 }, (_, i) => (
                  <span
                    key={i}
                    className={styles.axisDot}
                    style={
                      i < getAxisBandSegments(session.explanation_band)
                        ? { background: getAxisBandGradient("explanation") }
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Misconceptions */}
        {session.misconceptions && session.misconceptions.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Worth a second look</h3>
            <div className={styles.gapsList}>
              <MisconceptionChipList
                misconceptions={session.misconceptions}
                knownConcepts={knownMisconceptions}
              />
            </div>
          </div>
        )}

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
