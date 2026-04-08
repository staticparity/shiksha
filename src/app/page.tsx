import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import styles from "./page.module.css";

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.logo}>
            <span className={styles.logoIcon}>🎓</span>
            Shiksha
          </span>
          <div className={styles.navActions}>
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>✨ The future of assessment</div>
          <h1 className={styles.heroTitle}>
            The AI that{" "}
            <span className="gradient-text">refuses to teach</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Students explain concepts to a curious AI. The AI asks questions.
            Understanding gets measured — not memorization. The Feynman Method,
            powered by dual-agent AI.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/signup">
              <Button variant="primary" size="lg">
                Start Teaching AI
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="secondary" size="lg">
                How it works
              </Button>
            </Link>
          </div>
        </div>

        {/* Floating chat preview */}
        <div className={styles.heroVisual}>
          <GlassCard glow="teal">
            <div className={styles.chatPreview}>
              <div className={styles.previewMsg}>
                <span className={styles.previewRole}>🤔 Learner AI</span>
                <p>I don&apos;t know anything about photosynthesis. Can you teach me?</p>
              </div>
              <div className={`${styles.previewMsg} ${styles.previewStudent}`}>
                <span className={styles.previewRole}>👤 Student</span>
                <p>So basically, plants take in CO2 and water, then use sunlight to convert them into glucose and oxygen...</p>
              </div>
              <div className={styles.previewMsg}>
                <span className={styles.previewRole}>🤔 Learner AI</span>
                <p>Interesting! But what&apos;s actually happening inside the cell? What converts the light into energy?</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={styles.howSection}>
        <h2 className={styles.sectionHeading}>How Shiksha works</h2>
        <div className={styles.steps}>
          <GlassCard>
            <div className={styles.step}>
              <span className={styles.stepNumber}>01</span>
              <h3 className={styles.stepTitle}>Explain</h3>
              <p className={styles.stepDesc}>
                Teach a concept to our Learner AI — an AI that genuinely knows nothing about the topic. Use your own words.
              </p>
            </div>
          </GlassCard>
          <GlassCard>
            <div className={styles.step}>
              <span className={styles.stepNumber}>02</span>
              <h3 className={styles.stepTitle}>Get Questioned</h3>
              <p className={styles.stepDesc}>
                The AI asks follow-up questions when your explanation is vague, uses jargon, or skips steps. It probes for depth.
              </p>
            </div>
          </GlassCard>
          <GlassCard>
            <div className={styles.step}>
              <span className={styles.stepNumber}>03</span>
              <h3 className={styles.stepTitle}>See Your Mastery</h3>
              <p className={styles.stepDesc}>
                A separate Wisdom AI scores your explanation for coverage, accuracy, depth, and clarity. See exactly where understanding breaks down.
              </p>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* For Students / Teachers */}
      <section className={styles.audienceSection}>
        <div className={styles.audienceGrid}>
          <GlassCard glow="teal" padding="lg">
            <h3 className={styles.audienceTitle}>
              <span>📘</span> For Students
            </h3>
            <ul className={styles.audienceList}>
              <li>🎯 Earn Mastery Credits for every explain session</li>
              <li>📊 See exactly which concepts you understand vs. don&apos;t</li>
              <li>🔥 Build streaks and track your progress over time</li>
              <li>🧠 Actually learn — no more memorization treadmill</li>
            </ul>
          </GlassCard>
          <GlassCard glow="violet" padding="lg">
            <h3 className={styles.audienceTitle}>
              <span>📊</span> For Teachers
            </h3>
            <ul className={styles.audienceList}>
              <li>🗺️ Concept heatmap shows exactly where each student struggles</li>
              <li>🚨 Red flag alerts for students falling behind</li>
              <li>💡 AI-generated lesson plan suggestions based on class gaps</li>
              <li>📋 Full transcript access — see how students think</li>
            </ul>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerLogo}>🎓 Shiksha</span>
          <p className={styles.footerTagline}>
            The AI that refuses to teach. Students explain. AI questions. Understanding gets measured.
          </p>
          <p className={styles.footerCopy}>© 2026 Shiksha. Built in India.</p>
        </div>
      </footer>
    </div>
  );
}
