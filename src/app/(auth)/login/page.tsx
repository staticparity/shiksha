"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import styles from "./page.module.css";

const DEMO_ACCOUNTS = {
  student: { email: "rohan@greenfield.edu", password: "password123" },
  teacher: { email: "ananya@greenfield.edu", password: "password123" },
} as const;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const demo = searchParams.get("demo");
    if (demo === "student" || demo === "teacher") {
      const account = DEMO_ACCOUNTS[demo];
      setEmail(account.email);
      setPassword(account.password);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.logo}>🎓</span>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to continue teaching AI</p>
      </div>

      <form onSubmit={handleLogin} className={styles.form}>
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

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          Sign In
        </Button>
      </form>

      <p className={styles.footer}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className={styles.link}>Sign up</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.container}>
      <GlassCard padding="lg">
        <Suspense fallback={<div className={styles.card}>Loading…</div>}>
          <LoginForm />
        </Suspense>
      </GlassCard>
    </div>
  );
}
