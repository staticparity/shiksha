"use client";

import { useEffect, useState } from "react";
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
 * Leaves are generated client-side only (useEffect, not render-time
 * Math.random()) to avoid an SSR/client hydration mismatch.
 */
export function AmbientLeaves() {
  const [leaves, setLeaves] = useState<Leaf[]>([]);

  useEffect(() => {
    setLeaves(
      Array.from({ length: LEAF_COUNT }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        size: 8 + Math.random() * 10,
        duration: `${14 + Math.random() * 12}s`,
        delay: `${-Math.random() * 20}s`,
        color: COLORS[i % COLORS.length],
      }))
    );
  }, []);

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
