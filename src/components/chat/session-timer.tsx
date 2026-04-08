"use client";

import { useEffect, useState } from "react";
import styles from "./session-timer.module.css";
import { formatDuration } from "@/lib/utils/format";

interface SessionTimerProps {
  startTime: Date;
}

export function SessionTimer({ startTime }: SessionTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className={styles.timer}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span className={styles.time}>{formatDuration(elapsed)}</span>
    </div>
  );
}
