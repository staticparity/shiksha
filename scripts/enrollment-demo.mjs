// Live walkthrough of tonight's tutor-enrollment-friction feature — drives
// the real UI against the already-running dev server. No LLM calls (pure
// signup/enrollment flow), so this is cheap and fast. Screenshots saved to
// the scratchpad, not the repo — this is a one-off demo run, not a fixture.
//
// Usage: node enrollment-demo.mjs

import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const RUN_ID = Date.now();
const DOMAIN = `demo-${RUN_ID}.com`;
const TEACHER_EMAIL = `teacher@${DOMAIN}`;
const PASSWORD = "Demo1234!";
const SHOT_DIR = "/private/tmp/claude-501/-Users-adityajagadeesan-Desktop-Antigravity/6b830e61-2272-4264-a7d0-e6bfc8932eec/scratchpad/demo-shots";

const NEW_STUDENT_EMAIL = `priya-${RUN_ID}@example.com`;
const NEW_STUDENT_PASSWORD = "sunshine42";

let shotN = 0;
async function shot(page, label) {
  shotN += 1;
  const path = `${SHOT_DIR}/${String(shotN).padStart(2, "0")}-${label}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${path}`);
}

async function main() {
  const fs = await import("fs");
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

  console.log("1. Teacher signs up");
  await page.goto(`${BASE_URL}/signup`);
  await page.locator("#fullName").fill("Demo Tutor");
  await page.locator("#email").fill(TEACHER_EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "📊 Teacher" }).click();
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/teacher/dashboard", { timeout: 15000 });

  console.log("2. Create a class + topic (needed before the student tab unlocks)");
  await page.goto(`${BASE_URL}/teacher/setup`);
  await page.getByPlaceholder("e.g. 8-B Biology").fill("Demo Batch");
  await page.getByPlaceholder("e.g. Biology").fill("Biology");
  await page.getByPlaceholder("e.g. 8", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Create Class →" }).click();
  await page.getByRole("heading", { name: "Add a Topic" }).waitFor({ timeout: 10000 });
  await page.getByPlaceholder("e.g. Photosynthesis").fill("Photosynthesis");
  await page.getByPlaceholder(/Role of chlorophyll/).fill("Role of chlorophyll");
  await page.getByPlaceholder(/Chlorophyll absorbs light energy/).fill("Chlorophyll absorbs light energy");
  await page.getByRole("button", { name: "Add Topic", exact: true }).click();
  await page.getByText(/Topic "Photosynthesis" added/).waitFor({ timeout: 10000 });

  console.log("3. Open Invite a Student tab");
  await page.getByRole("button", { name: /Invite Students/ }).click();
  await page.getByText("Invite a Student").waitFor({ timeout: 10000 });
  await shot(page, "empty-form");

  console.log("4. Create a brand-new student account directly (Name -> Email -> Password order)");
  await page.getByPlaceholder("e.g. Priya Sharma").fill("Priya Sharma");
  await page.getByPlaceholder("student@gmail.com").fill(NEW_STUDENT_EMAIL);
  await page.getByPlaceholder("e.g. sunshine42").fill(NEW_STUDENT_PASSWORD);
  await shot(page, "filled-new-student");
  await page.getByRole("button", { name: "Enroll Student" }).click();
  await page.getByText(/account is ready/).waitFor({ timeout: 10000 });
  await shot(page, "success-card-shows-password");
  await page.getByRole("button", { name: "Got it" }).click();

  console.log("5. Try to enroll a DIFFERENT person under the SAME email (sibling-collision case)");
  await page.getByPlaceholder("e.g. Priya Sharma").fill("Raj Sharma");
  await page.getByPlaceholder("student@gmail.com").fill(NEW_STUDENT_EMAIL); // same email, different name
  await page.getByPlaceholder("e.g. sunshine42").fill("whatever123");
  await page.getByRole("button", { name: "Enroll Student" }).click();
  await page.getByText(/already belongs to/).waitFor({ timeout: 10000 });
  await shot(page, "name-mismatch-guardrail");

  console.log("6. Cancel — don't merge two different people");
  await page.getByRole("button", { name: /No, use a different email/ }).click();
  await shot(page, "cancelled-back-to-form");

  console.log("7. New student logs in with the tutor-set password, sees the assigned topic");
  const studentPage = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await studentPage.goto(`${BASE_URL}/login`);
  await studentPage.locator("#email").fill(NEW_STUDENT_EMAIL);
  await studentPage.locator("#password").fill(NEW_STUDENT_PASSWORD);
  await studentPage.getByRole("button", { name: "Sign In" }).click();
  await studentPage.waitForURL("**/dashboard", { timeout: 15000 });
  await studentPage.getByText("Photosynthesis", { exact: true }).waitFor({ timeout: 10000 });
  await shot(studentPage, "student-sees-assigned-topic");

  await browser.close();
  console.log(`\nDone. ${shotN} screenshots in ${SHOT_DIR}`);
}

main().catch((err) => {
  console.error("Demo script failed:", err);
  process.exit(1);
});
