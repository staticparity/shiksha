"use client";

import styles from "./ambient-leaves.module.css";

const COLORS = ["var(--accent-primary)", "var(--accent-secondary)", "var(--accent-gold)"];
const LEAF_COUNT = 7;

interface Leaf {
  id: number;
  left: string;
  size: number;
  duration: string;
  delay: string;
  color: string;
}

/**
 * Ambient drifting-leaf background, adapted from the source prototype
 * (Shiksha V2/Shiksha Session from WhatsApp.html). Pure CSS animation,
 * decorative only — respects prefers-reduced-motion.
 *
 * Deterministic positions keep the server and client render identical.
 */
export function AmbientLeaves() {
  const leaves: Leaf[] = Array.from({ length: LEAF_COUNT }, (_, i) => ({
    id: i, left: `${(i * 37 + 11) % 100}%`, size: 8 + (i * 7) % 10,
    duration: `${14 + (i * 5) % 12}s`, delay: `${-(i * 3)}s`, color: COLORS[i % COLORS.length],
  }));

  return (
    <div className={styles.field} aria-hidden="true">
      {leaves.map((leaf) => (
        <svg
          key={leaf.id}
          className={styles.leaf}
          width={leaf.size}
          height={leaf.size}
          viewBox="0 0 24 24"
          style={{
            left: leaf.left,
            animationDuration: leaf.duration,
            animationDelay: leaf.delay,
          }}
        >
          <path d="M12 2C7 7 4 12 12 22C20 12 17 7 12 2Z" fill={leaf.color} />
        </svg>
      ))}
    </div>
  );
}
