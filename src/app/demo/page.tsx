import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./page.module.css";

export const metadata = {
  title: "Demo — Shiksha",
  description: "A ready-made test ground to walk through Shiksha as a student or teacher.",
};

export default function DemoPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon} aria-hidden>
            🎓
          </span>
          Shiksha
        </Link>
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Log in
          </Button>
        </Link>
      </nav>

      <main className={styles.main}>
        <p className={styles.kicker}>Product test ground</p>
        <h1 className={styles.title}>Show how understanding gets measured</h1>
        <p className={styles.lede}>
          Two seeded roles, one class, three topics. Pick a path and walk the
          product — no signup required.
        </p>

        <div className={styles.paths}>
          <section className={styles.path} aria-labelledby="student-path">
            <h2 id="student-path" className={styles.pathTitle}>
              Student path
            </h2>
            <p className={styles.pathCopy}>
              Log in as Rohan, open Photosynthesis, and teach Pip. You&apos;ll
              see mastery scores and a live teach-back session.
            </p>
            <dl className={styles.creds}>
              <div>
                <dt>Email</dt>
                <dd>
                  <code>rohan@greenfield.edu</code>
                </dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>
                  <code>password123</code>
                </dd>
              </div>
            </dl>
            <Link href="/login?demo=student">
              <Button variant="primary" size="lg" fullWidth>
                Enter as student
              </Button>
            </Link>
          </section>

          <section className={styles.path} aria-labelledby="teacher-path">
            <h2 id="teacher-path" className={styles.pathTitle}>
              Teacher path
            </h2>
            <p className={styles.pathCopy}>
              Log in as Ananya to see class heatmaps, alerts, and how student
              explanations surface as diagnostic signal.
            </p>
            <dl className={styles.creds}>
              <div>
                <dt>Email</dt>
                <dd>
                  <code>ananya@greenfield.edu</code>
                </dd>
              </div>
              <div>
                <dt>Password</dt>
                <dd>
                  <code>password123</code>
                </dd>
              </div>
            </dl>
            <Link href="/login?demo=teacher">
              <Button variant="secondary" size="lg" fullWidth>
                Enter as teacher
              </Button>
            </Link>
          </section>
        </div>

        <p className={styles.note}>
          Live chat scoring needs an <code>OPENAI_API_KEY</code>. Dashboards and
          seeded results work without it.
        </p>
      </main>
    </div>
  );
}
