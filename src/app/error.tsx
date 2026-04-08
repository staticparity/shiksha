"use client";

import { useEffect } from "react";
import styles from "./error.module.css";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Shiksha Error]", error);
  }, [error]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>⚠️</div>
        <h2 className={styles.title}>Something went wrong</h2>
        <p className={styles.message}>
          {error.message.includes("fetch")
            ? "Could not connect to the server. Please check your connection."
            : "An unexpected error occurred. Our team has been notified."}
        </p>
        {error.digest && (
          <p className={styles.digest}>Error ID: {error.digest}</p>
        )}
        <button className={styles.retryButton} onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
