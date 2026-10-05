"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeReturnPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import Link from "next/link";
import styles from "./page.module.css";

export default function LoginPage() {
  return <Suspense fallback={<p role="status" className={styles.container}>Loading sign in…</p>}><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push(safeReturnPath(params.get("next"), window.location.origin));
      router.refresh();
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.container}>
      <GlassCard padding="lg">
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.logo}>✳</span>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>Sign in to continue teaching AI</p>
          </div>

          {params.get("error") === "auth_failed" && <p role="alert" className={styles.error}>This sign-in link could not be verified. It may have expired or been opened in another browser. Try signing in with your email and password.</p>}
          <form onSubmit={handleLogin}><fieldset disabled={loading} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && <p role="alert" className={styles.error}>{error}</p>}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Sign In
            </Button>
          </fieldset></form>

          <p className={styles.footer}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className={styles.link}>Sign up</Link>
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
