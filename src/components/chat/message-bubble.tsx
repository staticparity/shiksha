"use client";

import styles from "./message-bubble.module.css";

interface MessageBubbleProps {
  role: "assistant" | "user";
  content: string;
  index?: number;
}

export function MessageBubble({ role, content, index = 0 }: MessageBubbleProps) {
  const isAI = role === "assistant";

  return (
    <div
      className={`${styles.wrapper} ${isAI ? styles.ai : styles.student}`}
      style={{ animationDelay: `${Math.min(index * 50, 200)}ms` }}
    >
      <div className={styles.avatar}>
        {isAI ? "🤔" : "👤"}
      </div>
      <div className={`${styles.bubble} ${isAI ? styles.aiBubble : styles.studentBubble}`}>
        <span className={styles.role}>{isAI ? "Learner AI" : "You"}</span>
        <p className={styles.content}>{content}</p>
      </div>
    </div>
  );
}
