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
  const { data: topics } = await supabase
    .from("topics")
    .select("id, title, subject, chapter, class_id");

  // Get best session per topic
  const topicScores = await Promise.all(
    (topics ?? []).map(async (topic) => {
      const { data: session } = await supabase
        .from("sessions")
        .select("mastery_score, ended_at")
        .eq("topic_id", topic.id)
        .eq("student_id", user.id)
        .eq("status", "completed")
        .order("mastery_score", { ascending: false })
        .limit(1)
        .single();

      return {
        ...topic,
        bestScore: session?.mastery_score ?? null,
        lastAttempt: session?.ended_at ?? null,
      };
    })
  );

  // Get streak
  const { data: streak } = await supabase
    .from("streaks")
    .select("current_streak, longest_streak")
    .eq("student_id", user.id)
    .limit(1)
    .single();

  // Get credits
  const { data: credits } = await supabase
    .from("mastery_credits")
    .select("credits_earned, earned_at")
    .eq("student_id", user.id);

  const totalCredits = (credits ?? []).reduce((sum, c) => sum + c.credits_earned, 0);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyCredits = (credits ?? [])
    .filter((c) => new Date(c.earned_at) > oneWeekAgo)
    .reduce((sum, c) => sum + c.credits_earned, 0);

  const allScores = topicScores.map((t) => t.bestScore);
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
          {streak && streak.current_streak > 0 && (
            <div className={styles.streakBadge}>
              <span>🔥</span>
              <span>{streak.current_streak} day streak</span>
            </div>
          )}
        </div>

        {/* Progress */}
        <GlassCard>
          <ProgressBar value={progress} label="Overall Mastery" />
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
                          style={{ color: getMasteryColor(topic.bestScore) }}
                        >
                          {formatMasteryScore(topic.bestScore)}
                        </span>
                        <span>{getMasteryEmoji(topic.bestScore)}</span>
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
              <span className={styles.creditValue}>{totalCredits}</span>
              <span className={styles.creditLabel}>earned</span>
            </div>
            <div className={styles.creditDivider} />
            <div className={styles.creditStat}>
              <span className={styles.creditIcon}>📈</span>
              <span className={styles.creditValue}>+{weeklyCredits}</span>
              <span className={styles.creditLabel}>this week</span>
            </div>
            {streak && streak.current_streak > 0 && (
              <>
                <div className={styles.creditDivider} />
                <div className={styles.creditStat}>
                  <span className={styles.creditIcon}>🔥</span>
                  <span className={styles.creditValue}>
                    {streak.current_streak}
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
