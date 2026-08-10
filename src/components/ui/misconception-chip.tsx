"use client";

import {
  getMisconceptionColor,
  getMisconceptionBgColor,
  getMisconceptionLabel,
  getMisconceptionIcon,
} from "@/lib/scoring/misconception-detector";
import type { Misconception } from "@/lib/supabase/database.types";
import styles from "./misconception-chip.module.css";

interface MisconceptionChipProps {
  misconception: Misconception;
  index?: number;
  animated?: boolean;
}

export function MisconceptionChip({ misconception, index = 0, animated = true }: MisconceptionChipProps) {
  const color = getMisconceptionColor(misconception.status);
  const bgColor = getMisconceptionBgColor(misconception.status);
  const label = getMisconceptionLabel(misconception.status);
  const icon = getMisconceptionIcon(misconception.status);

  return (
    <div
      className={styles.chip}
      style={{
        borderLeftColor: color,
        background: bgColor,
        animationDelay: animated ? `${index * 150}ms` : "0ms",
      }}
    >
      <div className={styles.header}>
        <span className={styles.icon}>{icon}</span>
        <span className={styles.concept}>{misconception.concept}</span>
        <span className={styles.status} style={{ color }}>
          {label}
        </span>
      </div>
    </div>
  );
}

/**
 * Renders a list of misconception chips, or nothing if the array is empty
 * or every entry is unrecognized (critical-gap fix from the eng review — an
 * unrecognized status OR a concept the topic doesn't actually list must
 * render nothing, not a broken or fabricated-looking chip).
 *
 * `knownConcepts` is the topic's own common_misconceptions list — pass it
 * when available (see results client.tsx) to catch a hallucinated concept
 * name; omitted, only the status enum is checked.
 */
export function MisconceptionChipList({
  misconceptions,
  knownConcepts,
}: {
  misconceptions: Misconception[];
  knownConcepts?: string[];
}) {
  const knownStatuses = new Set(["active", "corrected", "accepted"]);
  const valid = misconceptions.filter((m) => {
    if (!knownStatuses.has(m.status)) {
      console.warn(`[MisconceptionChipList] Unrecognized status "${m.status}" for concept "${m.concept}" — skipping render.`);
      return false;
    }
    if (knownConcepts && !knownConcepts.includes(m.concept)) {
      console.warn(`[MisconceptionChipList] Concept "${m.concept}" is not in this topic's common_misconceptions — skipping render (possible hallucination).`);
      return false;
    }
    return true;
  });

  if (valid.length === 0) return null;

  return (
    <>
      {valid.map((m, i) => (
        <MisconceptionChip key={`${m.concept}-${i}`} misconception={m} index={i} />
      ))}
    </>
  );
}
