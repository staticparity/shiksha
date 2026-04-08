"use client";

import styles from "./progress-bar.module.css";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  size = "md",
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      {(label || showPercentage) && (
        <div className={styles.meta}>
          {label && <span className={styles.label}>{label}</span>}
          {showPercentage && (
            <span className={styles.percentage}>{percentage}%</span>
          )}
        </div>
      )}
      <div className={`${styles.track} ${styles[size]}`}>
        <div
          className={styles.fill}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
