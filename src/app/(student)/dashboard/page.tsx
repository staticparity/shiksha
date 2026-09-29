import { loadStudentProgress } from "@/lib/learning/progress";
import { loadStudentCredits, loadStudentStreak } from "@/lib/learning/rewards";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatRelativeTime, formatMasteryScore } from "@/lib/utils/format";
import {
  getMasteryColor,
  getMasteryEmoji,
  calculateOverallProgress,
} from "@/lib/scoring/mastery-calculator";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Get topics with best scores
  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, title, subject, chapter, class_id");

  if (topicsError) throw new Error("Could not load your topics. Please try again.");
  const progressByTopic = await loadStudentProgress(supabase, user.id);
  const topicScores = (topics ?? []).map(topic => ({ ...topic,
    ...(progressByTopic.get(topic.id) ?? { bestScore: null, latestScore: null, lastAttempt: null }),
  }));

  const [streak, credits] = await Promise.all([
    loadStudentStreak(supabase, user.id),
    loadStudentCredits(supabase, user.id),
  ]);

  const allScores = topicScores.map((t) => t.latestScore);
  const progress = calculateOverallProgress(allScores);
  const masteredCount = allScores.filter((s) => s !== null && s >= 70).length;

  const firstName = profile?.full_name?.split(" ")[0] ?? "Student";

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Welcome back, {firstName}</h1>
            <p className={styles.subtitle}>
              You&apos;ve mastered {masteredCount} of {topicScores.length} concepts
            </p>
          </div>
          {streak > 0 && (
            <div className={styles.streakBadge}>
              <span>🔥</span>
              <span>{streak} day streak</span>
            </div>
          )}
        </div>

        {/* Progress */}
        <GlassCard>
          <ProgressBar value={progress} label="Mastery · latest completed attempts" />
        </GlassCard>

        {/* Topics */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Assigned Topics</h2>

          {topicScores.length === 0 ? (
            <GlassCard>
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📚</span>
                <p className={styles.emptyText}>
                  No topics assigned yet. Your teacher will add them soon.
                </p>
              </div>
            </GlassCard>
          ) : (
            <div className={`${styles.topicList} stagger-children`}>
              {topicScores.map((topic) => (
                <Link key={topic.id} href={`/teach/${topic.id}`}>
                  <GlassCard interactive>
                    <div className={styles.topicCard}>
                      <div className={styles.topicLeft}>
                        <span className={styles.topicEmoji}>📘</span>
                        <div>
                          <h3 className={styles.topicName}>{topic.title}</h3>
                          <span className={styles.topicMeta}>
                            {topic.subject}
                            {topic.chapter ? ` · ${topic.chapter}` : ""}
                          </span>
                          {topic.lastAttempt && (
                            <span className={styles.topicLastAttempt}>
                              Last attempt: {formatRelativeTime(topic.lastAttempt)}
                            </span>
                          )}
                          {topic.bestScore !== null && topic.bestScore !== topic.latestScore && (
                            <span className={styles.topicLastAttempt}>Personal best: {topic.bestScore}%</span>
                          )}
                          {!topic.lastAttempt && (
                            <span className={styles.topicLastAttempt}>
                              Not attempted yet
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.topicRight}>
                        <span
                          className={styles.topicScore}
                          style={{ color: getMasteryColor(topic.latestScore) }}
                        >
                          {formatMasteryScore(topic.latestScore)}
                        </span>
                        <span>{getMasteryEmoji(topic.latestScore)}</span>
                        <span className={styles.teachCta}>Teach →</span>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Credits */}
        <GlassCard>
          <div className={styles.creditsRow}>
            <div className={styles.creditStat}>
              <span className={styles.creditIcon}>🎯</span>
              <span className={styles.creditValue}>{credits.total}</span>
              <span className={styles.creditLabel}>earned</span>
            </div>
            <div className={styles.creditDivider} />
            <div className={styles.creditStat}>
              <span className={styles.creditIcon}>📈</span>
              <span className={styles.creditValue}>+{credits.lastSevenDays}</span>
              <span className={styles.creditLabel}>last 7 days</span>
            </div>
            {streak > 0 && (
              <>
                <div className={styles.creditDivider} />
                <div className={styles.creditStat}>
                  <span className={styles.creditIcon}>🔥</span>
                  <span className={styles.creditValue}>
                    {streak}
                  </span>
                  <span className={styles.creditLabel}>day streak</span>
                </div>
              </>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
