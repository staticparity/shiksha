"use client";

import { useRef, useEffect, useState } from "react";
import styles from "./chat-input.module.css";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

const MAX_CHARS = 2000;

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type your explanation...",
  maxLength = MAX_CHARS,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 4 * 24; // 4 lines * ~24px line height
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  const charsRemaining = maxLength - value.length;
  const showCharCount = charsRemaining < 200;

  return (
    <div className={`${styles.container} ${isFocused ? styles.focused : ""}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          if (e.target.value.length <= maxLength) {
            onChange(e.target.value);
          }
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        className={styles.textarea}
        rows={1}
        aria-label="Type your explanation"
      />
      <div className={styles.actions}>
        {showCharCount && (
          <span
            className={`${styles.charCount} ${charsRemaining < 50 ? styles.charCountWarn : ""}`}
          >
            {charsRemaining}
          </span>
        )}
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className={styles.sendButton}
          aria-label="Send message"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
