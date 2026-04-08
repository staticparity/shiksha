/**
 * Gap Detector
 * 
 * Utilities for processing and displaying knowledge gaps
 * from the Wisdom Agent's evaluation.
 */

import type { Gap } from "@/lib/agents/wisdom";

const severityOrder: Record<string, number> = {
  critical: 0,
  moderate: 1,
  minor: 2,
};

/** Sort gaps by severity (critical first) */
export function sortGapsBySeverity(gaps: Gap[]): Gap[] {
  return [...gaps].sort(
    (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
  );
}

/** Get CSS color for gap severity */
export function getGapColor(severity: string): string {
  switch (severity) {
    case "critical": return "var(--mastery-beginning)";
    case "moderate": return "var(--mastery-developing)";
    case "minor": return "var(--text-secondary)";
    default: return "var(--text-tertiary)";
  }
}

/** Get CSS background for gap severity */
export function getGapBgColor(severity: string): string {
  switch (severity) {
    case "critical": return "var(--mastery-beginning-bg)";
    case "moderate": return "var(--mastery-developing-bg)";
    case "minor": return "rgba(148, 163, 184, 0.08)";
    default: return "transparent";
  }
}

/** Get severity label */
export function getGapSeverityLabel(severity: string): string {
  switch (severity) {
    case "critical": return "Critical Gap";
    case "moderate": return "Needs Work";
    case "minor": return "Minor Gap";
    default: return "Unknown";
  }
}

/** Find recurring gaps across multiple sessions */
export function findRecurringGaps(
  sessions: Array<{ gaps: Gap[] }>
): Array<{ concept: string; count: number; latestSeverity: string }> {
  const conceptCount: Record<string, { count: number; severity: string }> = {};

  for (const session of sessions) {
    if (!session.gaps) continue;
    for (const gap of session.gaps) {
      if (conceptCount[gap.concept]) {
        conceptCount[gap.concept].count++;
        conceptCount[gap.concept].severity = gap.severity;
      } else {
        conceptCount[gap.concept] = { count: 1, severity: gap.severity };
      }
    }
  }

  return Object.entries(conceptCount)
    .filter(([, data]) => data.count >= 2)
    .map(([concept, data]) => ({
      concept,
      count: data.count,
      latestSeverity: data.severity,
    }))
    .sort((a, b) => b.count - a.count);
}
