"use client";

import { cn } from "@/lib/utils/cn";
import styles from "./glass-card.module.css";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  glow?: "teal" | "violet" | "none";
  padding?: "sm" | "md" | "lg" | "none";
  as?: "div" | "section" | "article";
  onClick?: () => void;
}

export function GlassCard({
  children,
  className,
  interactive = false,
  glow = "none",
  padding = "md",
  as: Component = "div",
  onClick,
}: GlassCardProps) {
  return (
    <Component
      className={cn(
        styles.card,
        interactive && styles.interactive,
        glow === "teal" && styles.glowTeal,
        glow === "violet" && styles.glowViolet,
        padding === "sm" && styles.paddingSm,
        padding === "md" && styles.paddingMd,
        padding === "lg" && styles.paddingLg,
        padding === "none" && styles.paddingNone,
        className
      )}
      onClick={onClick}
    >
      {children}
    </Component>
  );
}
