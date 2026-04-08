"use client";

import { useEffect, useState, useRef } from "react";
import { getMasteryColor, getMasteryLevel } from "@/lib/scoring/mastery-calculator";
import styles from "./mastery-ring.module.css";

interface MasteryRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

export function MasteryRing({
  score,
  size = 160,
  strokeWidth = 8,
  animated = true,
  label,
  showLabel = true,
  className,
}: MasteryRingProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const [isVisible, setIsVisible] = useState(!animated);
  const ref = useRef<SVGSVGElement>(null);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = circumference - (score / 100) * circumference;
  const color = getMasteryColor(score);
  const level = getMasteryLevel(score);

  useEffect(() => {
    if (!animated) return;

    // Intersection Observer for scroll-triggered animation
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [animated]);

  useEffect(() => {
    if (!isVisible || !animated) return;

    // Animate counter from 0 to score
    const duration = 1200;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, animated, score]);

  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={styles.svg}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-glass-hover)"
          strokeWidth={strokeWidth}
        />

        {/* Animated progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isVisible ? target : circumference}
          className={styles.progressRing}
          style={{
            "--ring-circumference": `${circumference}`,
            "--ring-target": `${target}`,
            "--ring-color": color,
            transition: isVisible
              ? "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)"
              : "none",
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
            filter: `drop-shadow(0 0 6px ${color})`,
          } as React.CSSProperties}
        />
      </svg>

      {/* Center content */}
      <div className={styles.center}>
        <span
          className={styles.score}
          style={{ color, fontSize: size * 0.22 }}
        >
          {displayScore}%
        </span>
        {showLabel && (
          <span className={styles.label}>
            {label ?? "Mastery"}
          </span>
        )}
        {showLabel && (
          <span
            className={styles.level}
            style={{ color }}
          >
            {level === "unattempted" ? "" : level.charAt(0).toUpperCase() + level.slice(1)}
          </span>
        )}
      </div>
    </div>
  );
}
