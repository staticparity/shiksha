import { test, expect, type Browser, type Page } from "@playwright/test";

/**
 * Full Pipeline E2E
 *
 * The only test in this repo that exercises the real dual-agent pipeline
 * end to end — signup, class/topic setup, enrollment, a real teach-back
 * conversation (Learner + Evaluator + live signals checklist), Finish &
 * Score (Wisdom Agent), and the two-axis results screen. Everything else
 * in e2e/ tests static pages or relies on seed data; this one makes real
 * OpenAI calls and writes real rows.
 *
 * Uses a fresh, timestamped school domain each run so it's safe to re-run
 * against the same Supabase project without colliding with prior runs.
 *
 * Gated behind RUN_LIVE_E2E — like wisdom.eval.test.ts, this costs real
 * OpenAI spend and writes real rows, so it shouldn't fire on every
 * `pnpm test:e2e`. Run explicitly: RUN_LIVE_E2E=1 pnpm test:e2e -- full-pipeline
 */

test.skip(!process.env.RUN_LIVE_E2E, "Set RUN_LIVE_E2E=1 to run the real-pipeline e2e test");

const RUN_ID = Date.now();
// Not .test/.example/.invalid — Supabase's GoTrue email validator rejects
// IANA reserved-for-testing TLDs (RFC 2606) outright.
const DOMAIN = `e2e-${RUN_ID}-shiksha.com`;
const TEACHER_EMAIL = `teacher@${DOMAIN}`;
const STUDENT_EMAIL = `student@${DOMAIN}`;
const PASSWORD = "password123!";

async function signup(page: Page, name: string, email: string, role: "student" | "teacher") {
  await page.goto("/signup");
  await page.locator("#fullName").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: role === "teacher" ? "📊 Teacher" : "📘 Student" }).click();
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL(role === "teacher" ? "**/teacher/dashboard" : "**/dashboard", {
    timeout: 15000,
  });
}

test.describe.serial("Full pipeline: signup -> teach-back -> two-axis score", () => {
  let teacherPage: Page;
  let studentPage: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    teacherPage = await (await browser.newContext()).newPage();
    studentPage = await (await browser.newContext()).newPage();
  });

  test("teacher signs up, creates a class and a topic", async () => {
    await signup(teacherPage, "E2E Teacher", TEACHER_EMAIL, "teacher");

    await teacherPage.goto("/teacher/setup");
    await teacherPage.getByPlaceholder("e.g. 8-B Biology").fill("E2E Class");
    await teacherPage.getByPlaceholder("e.g. Biology").fill("Biology");
    await teacherPage.getByPlaceholder("e.g. 8", { exact: true }).fill("8");
    await teacherPage.getByRole("button", { name: "Create Class →" }).click();

    // Auto-advances to the topic tab.
    await expect(teacherPage.getByRole("heading", { name: "Add a Topic" })).toBeVisible({
      timeout: 10000,
    });
    await teacherPage.getByPlaceholder("e.g. Photosynthesis").fill("Photosynthesis");
    await teacherPage
      .getByPlaceholder(/Role of chlorophyll/)
      .fill("Role of chlorophyll");
    await teacherPage
      .getByPlaceholder(/Chlorophyll absorbs light energy/)
      .fill("Chlorophyll absorbs light energy to power the light-dependent reactions");
    await teacherPage.getByRole("button", { name: "Add Topic", exact: true }).click();
    await expect(teacherPage.getByText(/Topic "Photosynthesis" added/)).toBeVisible({
      timeout: 10000,
    });
  });

  test("student signs up (auto-joins teacher's school via matching domain)", async () => {
    await signup(studentPage, "E2E Student", STUDENT_EMAIL, "student");
  });

  test("teacher enrolls the student in the class", async () => {
    await teacherPage.getByRole("button", { name: /Invite Students/ }).click();
    await expect(teacherPage.getByText("Invite a Student")).toBeVisible({ timeout: 10000 });
    await teacherPage.getByPlaceholder("student@gmail.com").fill(STUDENT_EMAIL);
    await teacherPage.getByRole("button", { name: "Enroll Student" }).click();
    await expect(teacherPage.getByText(/enrolled!/)).toBeVisible({ timeout: 10000 });
  });

  test("student sees the assigned topic and starts teaching Pip", async () => {
    await studentPage.goto("/dashboard");
    await expect(studentPage.getByText("Assigned Topics")).toBeVisible({ timeout: 10000 });
    await expect(studentPage.getByText("Photosynthesis", { exact: true })).toBeVisible({
      timeout: 10000,
    });

    await studentPage.locator('a[href*="/teach/"]').first().click();
    // Generous timeout: first hit to this route in a fresh dev server
    // triggers a cold Turbopack compile, which can take well over 10s.
    await studentPage.waitForURL("**/teach/**", { timeout: 30000 });
    await studentPage.waitForLoadState("networkidle");

    // Intro/instructions screen gates the actual chat interface.
    await studentPage.getByRole("button", { name: "Start Teaching" }).click();

    // Pip's stage should render (avatar + greeting bubble).
    await expect(studentPage.getByLabel("Type your explanation")).toBeVisible({ timeout: 20000 });

    const input = studentPage.getByLabel("Type your explanation");
    await input.fill(
      "Photosynthesis is when plants make food from sunlight. For example, leaves use chlorophyll to absorb light energy, and that powers reactions that turn CO2 and water into glucose."
    );
    await input.press("Enter");

    // Wait for the Learner Agent's streamed reply to land as Pip's new line.
    await studentPage.waitForTimeout(1000);
    await expect(studentPage.getByLabel("Pip is thinking")).toHaveCount(0, { timeout: 20000 });

    // Live signals checklist should have appeared and picked up at least
    // "Definition" and "Example" from that message (Evaluator Agent, real
    // per-turn judgment, not the source prototype's regex).
    await expect(studentPage.getByText("Definition", { exact: true })).toBeVisible({
      timeout: 5000,
    });
    await expect(studentPage.getByText("Example", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("student finishes and gets a real two-axis score from the Wisdom Agent", async () => {
    // gpt-5 is a reasoning model; grading a full transcript measured ~28s in
    // live testing (well under the route's own 60s maxDuration, but over
    // Playwright's 30s per-test default).
    test.setTimeout(120_000);

    const finishBtn = studentPage.getByRole("button", { name: "Finish & Score" });
    await expect(finishBtn).toBeEnabled({ timeout: 5000 });
    await finishBtn.click();

    await expect(studentPage.getByText("Ready to get your score?")).toBeVisible({ timeout: 5000 });
    await studentPage.getByRole("button", { name: "Get my score" }).click();

    // Wisdom Agent (gpt-5) grading a full transcript can take a while.
    await studentPage.waitForURL("**/results/**", { timeout: 60000 });

    await expect(studentPage.getByText("Understanding", { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(studentPage.getByText("Explanation", { exact: true })).toBeVisible({
      timeout: 10000,
    });

    await studentPage.screenshot({ path: "e2e/.artifacts/full-pipeline-results.png", fullPage: true });
  });

  test.afterAll(async () => {
    await teacherPage?.context().close();
    await studentPage?.context().close();
  });
});
