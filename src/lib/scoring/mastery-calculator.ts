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

// ── Two-Axis Band Presentation (V2 T3, re-themed per DESIGN.md's Pip pass) ──
// AxisBand (understandingBand/explanationBand, from lib/agents/wisdom.ts) is a
// 4-level scale. Color is now axis-identity (rust=Understanding,
// bamboo=Explanation), matching the prototype's per-axis fill bars, not a
// severity tier shared across both axes — see DESIGN.md "Color".

import type { AxisBand } from "@/lib/agents/wisdom";

export type Axis = "understanding" | "explanation";

const AXIS_BAND_LABEL: Record<AxisBand, string> = {
  secure: "Secure",
  partial: "Partial",
  prompt_dependent: "Prompt-dependent",
  unresolved: "Unresolved",
};

/** How many of 4 segments fill, adapted from the prototype's native 1-5 dot scale. */
const AXIS_BAND_SEGMENTS: Record<AxisBand, number> = {
  unresolved: 1,
  prompt_dependent: 2,
  partial: 3,
  secure: 4,
};

/** CSS color for an axis band — rust for Understanding, bamboo for Explanation. */
export function getAxisBandColor(band: AxisBand | null, axis: Axis): string {
  if (band === null) return "var(--text-tertiary)";
  return axis === "understanding" ? "var(--accent-primary)" : "var(--accent-secondary)";
}

/** CSS background tint for an axis band. */
export function getAxisBandBgColor(band: AxisBand | null, axis: Axis): string {
  if (band === null) return "transparent";
  return axis === "understanding" ? "var(--accent-primary-dim)" : "var(--accent-secondary-dim)";
}

/** The gradient fill for the axis's segmented bar (see .axisFill in page.module.css). */
export function getAxisBandGradient(axis: Axis): string {
  return axis === "understanding" ? "var(--axis-understanding)" : "var(--axis-explanation)";
}

/** How many of 4 segments should render filled. */
export function getAxisBandSegments(band: AxisBand | null): number {
  if (band === null) return 0;
  return AXIS_BAND_SEGMENTS[band];
}

/** Human-readable label, or "Not yet scored" for a pre-migration session. */
export function getAxisBandLabel(band: AxisBand | null): string {
  if (band === null) return "Not yet scored";
  return AXIS_BAND_LABEL[band];
}
