// Live walkthrough of the AI-generated topic content feature — drives the
// real UI against the already-running dev server, including a real OpenAI
// call through /api/teacher/generate-concepts. Screenshots saved to the
// scratchpad, not the repo — this is a one-off demo run, not a fixture.
//
// Usage: node generate-concepts-demo.mjs

import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const RUN_ID = Date.now();
const DOMAIN = `demo-${RUN_ID}.com`;
const TEACHER_EMAIL = `teacher@${DOMAIN}`;
const PASSWORD = "Demo1234!";
const SHOT_DIR = "/private/tmp/claude-501/-Users-adityajagadeesan-Desktop-Antigravity/6b830e61-2272-4264-a7d0-e6bfc8932eec/scratchpad/generate-concepts-shots";

const PASTED_CONTENT = `Photosynthesis is the process plants use to convert light energy into chemical energy stored in glucose. It happens in the chloroplasts, specifically in structures called thylakoids, which contain the pigment chlorophyll.

Chlorophyll absorbs light energy, mostly in the red and blue wavelengths, and reflects green light — that's why leaves look green. The absorbed light energy is used to split water molecules in a process called photolysis, releasing oxygen as a byproduct and generating ATP and NADPH.

These energy carriers, ATP and NADPH, are then used in the Calvin cycle, which takes place in the stroma of the chloroplast. In the Calvin cycle, carbon dioxide from the air is fixed into organic molecules through a series of enzyme-driven reactions, eventually producing glucose. The key enzyme in this process is RuBisCO, which catalyzes the first major step of carbon fixation.`;

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
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1100 } })).newPage();

  console.log("1. Teacher signs up");
  await page.goto(`${BASE_URL}/signup`);
  await page.locator("#fullName").fill("Demo Tutor");
  await page.locator("#email").fill(TEACHER_EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "📊 Teacher" }).click();
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/teacher/dashboard", { timeout: 15000 });

  console.log("2. Create a class");
  await page.goto(`${BASE_URL}/teacher/setup`);
  await page.getByPlaceholder("e.g. 8-B Biology").fill("Demo Batch");
  await page.getByPlaceholder("e.g. Biology").fill("Biology");
  await page.getByPlaceholder("e.g. 8", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Create Class →" }).click();
  await page.getByRole("heading", { name: "Add a Topic" }).waitFor({ timeout: 10000 });

  console.log("3. Paste real prep content, before generating");
  await page.getByPlaceholder("e.g. Photosynthesis").fill("Photosynthesis");
  await page.getByPlaceholder(/Paste your notes/).fill(PASTED_CONTENT);
  await shot(page, "content-pasted");

  console.log("4. Click Generate from content — real OpenAI call");
  await page.getByRole("button", { name: /Generate from content/ }).click();
  await page.getByText(/review before adding the topic/).waitFor({ timeout: 30000 });
  await shot(page, "concepts-generated");

  console.log("5. Confirm generated rows show a source excerpt hint");
  const excerptHints = page.locator("text=/^from: /");
  const excerptCount = await excerptHints.count();
  console.log(`   ${excerptCount} row(s) show a "from:" source excerpt hint`);
  if (excerptCount === 0) throw new Error("Expected at least one generated row to show a sourceExcerpt hint");

  console.log("6. Paste content again with existing rows — confirm the replace-warning fires");
  await page.getByPlaceholder(/Paste your notes/).fill(PASTED_CONTENT + " ");
  await page.getByRole("button", { name: /Generate from content/ }).click();
  await page.getByText(/This replaces what you've typed below/).waitFor({ timeout: 5000 });
  await shot(page, "replace-confirmation");
  await page.getByRole("button", { name: "Cancel" }).click();

  console.log("7. Submit the topic with the AI-generated (reviewed) concepts");
  await page.getByRole("button", { name: "Add Topic", exact: true }).click();
  await page.getByText(/Topic "Photosynthesis" added/).waitFor({ timeout: 10000 });
  await shot(page, "topic-added");

  await browser.close();
  console.log(`\nDone. ${shotN} screenshots in ${SHOT_DIR}`);
}

main().catch((err) => {
  console.error("Demo script failed:", err);
  process.exit(1);
});
