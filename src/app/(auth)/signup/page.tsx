"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import styles from "../login/page.module.css";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(role === "teacher" ? "/teacher/dashboard" : "/dashboard");
    router.refresh();
  };

  return (
    <div className={styles.container}>
      <GlassCard padding="lg">
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.logo}>🎓</span>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>Start your learning journey</p>
          </div>

          <form onSubmit={handleSignup} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="fullName" className={styles.label}>Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={styles.input}
                placeholder="Priya Sharma"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
                placeholder="you@school.edu"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>I am a</label>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button
                  type="button"
                  onClick={() => setRole("student")}
                  style={{
                    flex: 1,
                    padding: "var(--space-2-5) var(--space-4)",
                    borderRadius: "var(--radius-lg)",
                    border: `1px solid ${role === "student" ? "var(--accent-primary)" : "var(--glass-border)"}`,
                    background: role === "student" ? "var(--accent-primary-dim)" : "var(--bg-secondary)",
                    color: role === "student" ? "var(--accent-primary)" : "var(--text-secondary)",
                    fontWeight: "var(--font-medium)" as any,
                    fontSize: "var(--text-sm)",
                    cursor: "pointer",
                    transition: "all 200ms ease",
                  }}
                >
                  📘 Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole("teacher")}
                  style={{
                    flex: 1,
                    padding: "var(--space-2-5) var(--space-4)",
                    borderRadius: "var(--radius-lg)",
                    border: `1px solid ${role === "teacher" ? "var(--accent-secondary)" : "var(--glass-border)"}`,
                    background: role === "teacher" ? "var(--accent-secondary-dim)" : "var(--bg-secondary)",
                    color: role === "teacher" ? "var(--accent-secondary)" : "var(--text-secondary)",
                    fontWeight: "var(--font-medium)" as any,
                    fontSize: "var(--text-sm)",
                    cursor: "pointer",
                    transition: "all 200ms ease",
                  }}
                >
                  📊 Teacher
                </button>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Create Account
            </Button>
          </form>

          <p className={styles.footer}>
            Already have an account?{" "}
            <Link href="/login" className={styles.link}>Sign in</Link>
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
