// Loads .env.local into process.env for tests that need it (currently only
// wisdom.eval.test.ts, gated behind RUN_LIVE_EVALS). Harmless no-op for the
// rest of the suite, which doesn't read any env vars. Wrapped in try/catch
// because .env.local won't exist in CI, and that's fine — RUN_LIVE_EVALS
// tests are skipped there anyway.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (e.g. CI) — fine, live-eval tests are skipped without it.
}
