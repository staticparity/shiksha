'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './dialog.module.css';

/** Native modal semantics provide focus containment, Escape and focus restoration. */
export function Dialog({ children, labelledBy, className = '', onClose }: {
  children: ReactNode; labelledBy: string; className?: string; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    // Close before React removes the element so the browser can restore focus.
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return <dialog ref={ref} className={`${styles.dialog} ${className}`} aria-labelledby={labelledBy}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>{children}</dialog>;
}
