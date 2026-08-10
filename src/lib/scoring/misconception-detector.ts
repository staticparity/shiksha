/**
 * Misconception Detector
 *
 * Utilities for displaying misconception status from the Wisdom Agent's
 * evaluation. Mirrors gap-detector.ts's shape deliberately — same kind of
 * pure color/label mapping — but is a separate module because misconception
 * status (a belief-state enum: active/corrected/accepted) is not shaped like
 * a Gap (concept + severity + explanation). Forcing them through one
 * component would conflate two different axes.
 */

import type { Misconception } from "@/lib/supabase/database.types";

type MisconceptionStatus = Misconception["status"];

/** Get CSS color for misconception status */
export function getMisconceptionColor(status: MisconceptionStatus): string {
  switch (status) {
    case "corrected": return "var(--mastery-proficient)";
    case "active": return "var(--mastery-developing)";
    // accepted: the system told the student something false and they agreed —
    // the one case the design philosophy requires the system to name
    // explicitly (the "one honesty rule"). Treat it with the same visual
    // weight as the most severe gap.
    case "accepted": return "var(--mastery-beginning)";
    default: return "var(--text-tertiary)";
  }
}

/** Get CSS background for misconception status */
export function getMisconceptionBgColor(status: MisconceptionStatus): string {
  switch (status) {
    case "corrected": return "var(--mastery-proficient-bg)";
    case "active": return "var(--mastery-developing-bg)";
    case "accepted": return "var(--mastery-beginning-bg)";
    default: return "transparent";
  }
}

/** Get human-readable label for misconception status */
export function getMisconceptionLabel(status: MisconceptionStatus): string {
  switch (status) {
    case "corrected": return "Corrected this session";
    case "active": return "Flagged — revisit";
    case "accepted": return "Correction needed";
    default: return "Unknown";
  }
}

/** Get the icon for misconception status */
export function getMisconceptionIcon(status: MisconceptionStatus): string {
  switch (status) {
    case "corrected": return "✓";
    case "active": return "⚠";
    case "accepted": return "⚠";
    default: return "•";
  }
}
