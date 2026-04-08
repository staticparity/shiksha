"use client";

import { getGapColor, getGapBgColor, getGapSeverityLabel } from "@/lib/scoring/gap-detector";
import type { Gap } from "@/lib/agents/wisdom";
import styles from "./gap-chip.module.css";

interface GapChipProps {
  gap: Gap;
  index?: number;
  animated?: boolean;
}

export function GapChip({ gap, index = 0, animated = true }: GapChipProps) {
  const color = getGapColor(gap.severity);
  const bgColor = getGapBgColor(gap.severity);
  const label = getGapSeverityLabel(gap.severity);

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
        <span className={styles.icon}>⚠</span>
        <span className={styles.concept}>{gap.concept}</span>
        <span className={styles.severity} style={{ color }}>
          {label}
        </span>
      </div>
      <p className={styles.explanation}>{gap.explanation}</p>
    </div>
  );
}
