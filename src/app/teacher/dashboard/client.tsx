"use client";

import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getMasteryColor, getMasteryEmoji } from "@/lib/scoring/mastery-calculator";
import { formatMasteryScore } from "@/lib/utils/format";
import styles from "./page.module.css";

interface DashboardData {
  classInfo: { name: string; subject: string; grade: string };
  overview: {
    studentCount: number;
    avgMastery: number;
    activeToday: number;
    topicCount: number;
  };
  topics: Array<{ id: string; title: string }>;
  heatmap: Array<{
    studentId: string;
    studentName: string;
    topicScores: Record<string, number | null>;
    avgMastery: number | null;
    lastActive: string | null;
  }>;
  alerts: Array<{
    type: string;
    message: string;
    severity: "critical" | "warning" | "info";
  }>;
}

export function TeacherDashboardClient({
  classId,
}: {
  classId: string;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard?classId=${classId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [classId]);

  if (loading || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className="skeleton" style={{ height: 32, width: 240, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            📊 {data.classInfo.name}
          </h1>
          <span className={styles.subtitle}>
            {data.classInfo.subject} · Grade {data.classInfo.grade}
          </span>
        </div>

        {/* Overview */}
        <GlassCard>
          <div className={styles.overviewGrid}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{data.overview.studentCount}</span>
              <span className={styles.statLabel}>Students</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{data.overview.avgMastery}%</span>
              <span className={styles.statLabel}>Avg Mastery</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{data.overview.activeToday}</span>
              <span className={styles.statLabel}>Active Today</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{data.overview.topicCount}</span>
              <span className={styles.statLabel}>Topics</span>
            </div>
          </div>
          <div style={{ marginTop: "var(--space-4)" }}>
            <ProgressBar value={data.overview.avgMastery} label="Class Mastery" />
          </div>
        </GlassCard>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🔴 Alerts</h2>
            <GlassCard>
              <div className={styles.alertList}>
                {data.alerts.slice(0, 5).map((alert, i) => (
                  <div
                    key={i}
                    className={`${styles.alert} ${
                      alert.severity === "critical" ? styles.alertCritical : styles.alertWarning
                    }`}
                  >
                    {alert.message}
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* Heatmap */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Concept Heatmap</h2>
          <GlassCard padding="none">
            <div className={styles.heatmapWrapper}>
              <table className={styles.heatmap}>
                <thead>
                  <tr>
                    <th className={styles.heatmapHeader}>Student</th>
                    {data.topics.map((topic) => (
                      <th key={topic.id} className={styles.heatmapHeader}>
                        {topic.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.heatmap.map((student) => (
                    <tr key={student.studentId}>
                      <td className={styles.heatmapStudent}>
                        {student.studentName}
                      </td>
                      {data.topics.map((topic) => {
                        const score = student.topicScores[topic.id];
                        return (
                          <td
                            key={topic.id}
                            className={styles.heatmapCell}
                            style={{
                              color: getMasteryColor(score),
                              background:
                                score !== null
                                  ? `color-mix(in srgb, ${getMasteryColor(score)} 8%, transparent)`
                                  : "transparent",
                            }}
                          >
                            <span className={styles.cellScore}>
                              {formatMasteryScore(score)}
                            </span>
                            <span className={styles.cellEmoji}>
                              {getMasteryEmoji(score)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
