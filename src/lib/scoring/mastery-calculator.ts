/**
 * Mastery Calculator
 * 
 * Converts raw mastery scores into levels, colors, and credits.
 * This is the gamification math that makes progress feel tangible.
 */

export type MasteryLevel = "expert" | "proficient" | "developing" | "beginning" | "unattempted";

/** Score-to-level mapping */
export function getMasteryLevel(score: number | null | undefined): MasteryLevel {
  if (score === null || score === undefined) return "unattempted";
  if (score >= 90) return "expert";
  if (score >= 70) return "proficient";
  if (score >= 40) return "developing";
  return "beginning";
}

/** Get the CSS custom property name for a mastery level */
export function getMasteryColor(score: number | null | undefined): string {
  const level = getMasteryLevel(score);
  switch (level) {
    case "expert": return "var(--mastery-expert)";
    case "proficient": return "var(--mastery-proficient)";
    case "developing": return "var(--mastery-developing)";
    case "beginning": return "var(--mastery-beginning)";
    case "unattempted": return "var(--text-tertiary)";
  }
}

/** Get the CSS background property for a mastery level */
export function getMasteryBgColor(score: number | null | undefined): string {
  const level = getMasteryLevel(score);
  switch (level) {
    case "expert": return "var(--mastery-expert-bg)";
    case "proficient": return "var(--mastery-proficient-bg)";
    case "developing": return "var(--mastery-developing-bg)";
    case "beginning": return "var(--mastery-beginning-bg)";
    case "unattempted": return "transparent";
  }
}

/** Get a human-readable label for the mastery level */
export function getMasteryLabel(score: number | null | undefined): string {
  const level = getMasteryLevel(score);
  switch (level) {
    case "expert": return "Expert";
    case "proficient": return "Proficient";
    case "developing": return "Developing";
    case "beginning": return "Beginning";
    case "unattempted": return "Not attempted";
  }
}

/** Get emoji indicator for mastery level */
export function getMasteryEmoji(score: number | null | undefined): string {
  const level = getMasteryLevel(score);
  switch (level) {
    case "expert": return "🟢";
    case "proficient": return "🟢";
    case "developing": return "🟡";
    case "beginning": return "🔴";
    case "unattempted": return "⚪";
  }
}

/**
 * Calculate credits earned from a mastery score.
 * 
 * Credit schedule:
 * - 90-100: 3 credits (expert)
 * - 70-89:  2 credits (proficient)
 * - 40-69:  1 credit  (developing)
 * - 0-39:   0 credits (beginning - try again)
 */
export function calculateCredits(masteryScore: number): number {
  if (masteryScore >= 90) return 3;
  if (masteryScore >= 70) return 2;
  if (masteryScore >= 40) return 1;
  return 0;
}

/**
 * Calculate overall mastery progress percentage.
 * Based on topics where student has achieved at least "developing" (40%+).
 */
export function calculateOverallProgress(
  scores: (number | null)[],
  masteryThreshold: number = 70
): number {
  if (scores.length === 0) return 0;
  const mastered = scores.filter((s) => s !== null && s >= masteryThreshold).length;
  return Math.round((mastered / scores.length) * 100);
}
