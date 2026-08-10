"use client";

import { useEffect, useState } from "react";
import type { TeachingSignals } from "@/lib/agents/evaluator";
import styles from "./pip-avatar.module.css";

export type PipMood = "curious" | "think" | "happy" | "neutral";

const MOOD_EMOJI: Record<PipMood, string> = {
  curious: "🐾",
  think: "🤔",
  happy: "😄",
  neutral: "🐾",
};

const SIGNAL_LABELS: Record<keyof TeachingSignals, string> = {
  definition: "Definition",
  example: "Example",
  mechanism: "How",
  cause: "Why",
  connection: "Connection",
};

const SIGNAL_KEYS = Object.keys(SIGNAL_LABELS) as (keyof TeachingSignals)[];

interface PipAvatarProps {
  /** Pip's current line — the latest assistant message, plain text. */
  message: string;
  mood?: PipMood;
  /** True while the Learner Agent is streaming a response. */
  isTyping?: boolean;
  size?: number;
  /**
   * Cumulative per-session read from the Evaluator Agent — which teaching
   * components the student has touched on so far. Omit to hide the row
   * entirely (e.g. before the student has said anything).
   */
  signals?: TeachingSignals;
}

/**
 * Pip — the illustrated companion character students teach.
 *
 * Real art doesn't exist yet (tracked in TODOS.md — "Implement the Pip
 * character"); this ships the same placeholder silhouette as the source
 * prototype (Shiksha V2/Shiksha Session from WhatsApp.html) so the
 * interaction design is real even though the final illustration isn't.
 */
export function PipAvatar({ message, mood = "curious", isTyping = false, size = 200, signals }: PipAvatarProps) {
  const [bubbleKey, setBubbleKey] = useState(0);

  // Re-trigger the entrance animation whenever the message actually changes.
  useEffect(() => {
    setBubbleKey((k) => k + 1);
  }, [message]);

  const effectiveMood = isTyping ? "think" : mood;

  return (
    <div className={styles.stack}>
      <div className={styles.wrap} style={{ width: size, height: size }}>
        <div className={styles.aura} data-mood={effectiveMood} />

        <div key={bubbleKey} className={styles.bubble}>
          {isTyping ? (
            <span className={styles.typing} aria-label="Pip is thinking">
              <i /><i /><i />
            </span>
          ) : (
            message
          )}
        </div>

        <div className={styles.pipArt}>
          <div className={styles.disc} />
          <svg className={styles.silhouette} viewBox="0 0 120 120" aria-hidden="true">
            <ellipse cx="94" cy="80" rx="12" ry="18" fill="var(--bg-tertiary)" transform="rotate(18 94 80)" />
            <ellipse cx="60" cy="86" rx="30" ry="26" fill="var(--bg-tertiary)" />
            <circle cx="38" cy="24" r="12" fill="var(--bg-tertiary)" />
            <circle cx="82" cy="24" r="12" fill="var(--bg-tertiary)" />
            <circle cx="60" cy="46" r="30" fill="var(--bg-tertiary)" />
            <circle cx="50" cy="44" r="5" fill="var(--bg-secondary)" />
            <circle cx="70" cy="44" r="5" fill="var(--bg-secondary)" />
            <circle cx="60" cy="56" r="4" fill="var(--bg-secondary)" />
          </svg>
          <div className={styles.pipLabel}>PIP · ART COMING</div>
          <div className={styles.mood} key={effectiveMood}>{MOOD_EMOJI[effectiveMood]}</div>
        </div>
      </div>

      {signals && (
        <div className={styles.signals} role="status" aria-label="What Pip has picked up so far">
          {SIGNAL_KEYS.map((key) => (
            <span key={key} className={styles.sig} data-on={signals[key]}>
              {SIGNAL_LABELS[key]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
