import { defineConfig, devices } from '@playwright/test';
process.env.TEACHER_WORKSPACE_TEST = '1';
export default defineConfig({
  testDir: './e2e', testMatch: ['teacher-workspace.spec.ts', 'student-learning.spec.ts', 'auth-onboarding.spec.ts'], workers: 1, timeout: 60_000, expect: { timeout: 15_000 },
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node e2e/fixtures/teacher-server.mjs', url: 'http://127.0.0.1:54329/health', reuseExistingServer: false },
    { command: 'pnpm exec next dev --port 3100', url: 'http://127.0.0.1:3100', timeout: 120_000, reuseExistingServer: false,
      env: { TEACHER_WORKSPACE_TEST: "1", NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-only', SUPABASE_SERVICE_ROLE_KEY: 'test-only', OPENAI_API_KEY: 'test-only' } },
  ],
});
