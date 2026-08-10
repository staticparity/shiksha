// Seeds a real, memorable demo dataset by driving the actual UI — real
// OpenAI calls, real Supabase writes, real Wisdom Agent grading. Not fake
// pre-baked scores like supabase/seed.sql; this is meant to show how well
// the two-axis diagnostic actually differentiates answer quality.
//
// Usage: node scripts/seed-demo-dataset.mjs
// Requires the dev server running at BASE_URL (default localhost:3000).

import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const RUN_ID = Date.now();
const DOMAIN = `demo-shiksha-${RUN_ID}.com`;
const TEACHER_EMAIL = `teacher@${DOMAIN}`;
const STUDENT_EMAIL = `student@${DOMAIN}`;
const PASSWORD = "Demo1234!";

const CONCEPTS = [
  {
    concept: "Role of chlorophyll",
    description: "Chlorophyll absorbs light energy to power the light-dependent reactions",
  },
  {
    concept: "Inputs and outputs",
    description: "Takes in CO2 and water, produces glucose and oxygen",
  },
  {
    concept: "Where it happens",
    description: "Occurs in the chloroplasts — thylakoid membranes (light reactions) and stroma (Calvin cycle)",
  },
  {
    concept: "Light vs dark reactions",
    description:
      "Light-dependent reactions produce ATP/NADPH; the Calvin cycle uses these to fix CO2 into glucose",
  },
];

const PERSONAS = [
  {
    name: "Strong",
    turn1:
      "Photosynthesis is the process plants use to convert light energy into chemical energy stored in glucose. It happens in the chloroplasts, using chlorophyll in the thylakoid membranes to absorb sunlight. The light-dependent reactions split water molecules, releasing oxygen as a byproduct and producing ATP and NADPH. Those energy carriers then power the Calvin cycle in the stroma, where CO2 is fixed into glucose. Overall: 6CO2 + 6H2O + light energy makes C6H12O6 + 6O2.",
    turn2:
      "Right — the reason it's two stages is that the light reactions can't directly build sugar, they just generate ATP and NADPH. The Calvin cycle then spends that energy to actually fix carbon from CO2 into glucose, which is why it's sometimes called the dark reactions even though it doesn't require darkness, just no direct light dependency.",
  },
  {
    name: "Weak",
    turn1: "Plants use sunlight to make food. They take in stuff from the air and soil and turn it into energy somehow.",
    turn2: "I think it happens in the leaves? I'm not totally sure about the details, sorry.",
  },
  {
    name: "Confidently wrong (misconception)",
    turn1:
      "Photosynthesis is how plants eat — they absorb nutrients and minerals from the soil through their roots and combine them with water to grow. The green chlorophyll helps them digest the soil nutrients. Sunlight just helps them grow faster, kind of like how sunlight gives humans vitamin D, but the actual mass and food comes from the soil.",
    turn2:
      "Yeah, that's basically it — the soil provides the nutrients and light is just an energy boost, similar to how we eat food for energy. Most of the plant's weight comes from the minerals it absorbs from the ground, not from the air.",
  },
  {
    name: "Short/evasive",
    turn1: "idk plants just use sunlight I guess",
    turn2: "not really sure, can we just finish",
  },
];

async function signup(page, name, email, role) {
  await page.goto(`${BASE_URL}/signup`);
  await page.locator("#fullName").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: role === "teacher" ? "📊 Teacher" : "📘 Student" }).click();
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL(role === "teacher" ? "**/teacher/dashboard" : "**/dashboard", { timeout: 15000 });
}

async function runSession(studentPage, topicHref, persona) {
  await studentPage.goto(`${BASE_URL}/dashboard`);
  await studentPage.locator(`a[href="${topicHref}"]`).first().click();
  await studentPage.waitForURL("**/teach/**", { timeout: 30000 });
  await studentPage.waitForLoadState("networkidle");
  await studentPage.getByRole("button", { name: "Start Teaching" }).click();

  const input = studentPage.getByLabel("Type your explanation");
  await input.waitFor({ state: "visible", timeout: 20000 });

  for (const turn of [persona.turn1, persona.turn2]) {
    await input.fill(turn);
    await input.press("Enter");
    await studentPage.waitForTimeout(500);
    await studentPage.getByLabel("Pip is thinking").waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
    // Also just wait for the count to hit 0 in case waitFor state races the mount.
    await studentPage
      .locator('[aria-label="Pip is thinking"]')
      .first()
      .waitFor({ state: "detached", timeout: 30000 })
      .catch(() => {});
  }

  const finishBtn = studentPage.getByRole("button", { name: "Finish & Score" });
  await finishBtn.waitFor({ state: "visible", timeout: 10000 });
  await finishBtn.click();
  await studentPage.getByRole("button", { name: "Get my score" }).click();
  await studentPage.waitForURL("**/results/**", { timeout: 90000 });
  await studentPage.waitForLoadState("networkidle");
  // MasteryRing count-up animation is 1200ms plus a fade-in gate; wait it
  // out or the score reads as 0% (its initial animated state).
  await studentPage.waitForTimeout(3000);

  const summary = await extractSummary(studentPage);
  return { url: studentPage.url(), ...summary };
}

async function labelValue(page, label) {
  try {
    return await page
      .getByText(label, { exact: true })
      .locator("xpath=..")
      .locator("b")
      .innerText({ timeout: 3000 });
  } catch {
    return "?";
  }
}

async function extractSummary(page) {
  const score = await page
    .locator('[class*="__score"]')
    .first()
    .innerText({ timeout: 3000 })
    .catch(() => "?");
  const understanding = await labelValue(page, "Understanding");
  const explanation = await labelValue(page, "Explanation");
  const assessment = await page
    .locator('[class*="assessment"]')
    .first()
    .innerText({ timeout: 3000 })
    .catch(() => "");
  return { score, understanding, explanation, assessment };
}

async function main() {
  const browser = await chromium.launch();
  const teacherPage = await (await browser.newContext()).newPage();
  const studentPage = await (await browser.newContext()).newPage();

  console.log(`Domain: ${DOMAIN}`);
  console.log(`Teacher: ${TEACHER_EMAIL} / ${PASSWORD}`);
  console.log(`Student: ${STUDENT_EMAIL} / ${PASSWORD}`);
  console.log("");

  console.log("Signing up teacher...");
  await signup(teacherPage, "Demo Teacher", TEACHER_EMAIL, "teacher");

  console.log("Creating class + topic...");
  await teacherPage.goto(`${BASE_URL}/teacher/setup`);
  await teacherPage.getByPlaceholder("e.g. 8-B Biology").fill("Demo Class");
  await teacherPage.getByPlaceholder("e.g. Biology").fill("Biology");
  await teacherPage.getByPlaceholder("e.g. 8", { exact: true }).fill("8");
  await teacherPage.getByRole("button", { name: "Create Class →" }).click();
  await teacherPage.getByRole("heading", { name: "Add a Topic" }).waitFor({ timeout: 10000 });
  await teacherPage.getByPlaceholder("e.g. Photosynthesis").fill("Photosynthesis");

  for (let i = 0; i < CONCEPTS.length; i++) {
    if (i > 0) await teacherPage.getByRole("button", { name: "+ Add another" }).click();
    const rows = teacherPage.locator('[class*="conceptRow"]');
    await rows.nth(i).locator('[class*="conceptInput"]').fill(CONCEPTS[i].concept);
    await rows.nth(i).locator('[class*="conceptDesc"]').fill(CONCEPTS[i].description);
  }

  await teacherPage.getByRole("button", { name: "Add Topic", exact: true }).click();
  await teacherPage.getByText(/Topic "Photosynthesis" added/).waitFor({ timeout: 10000 });

  console.log("Signing up student...");
  await signup(studentPage, "Demo Student", STUDENT_EMAIL, "student");

  console.log("Enrolling student...");
  await teacherPage.getByRole("button", { name: /Invite Students/ }).click();
  await teacherPage.getByText("Invite a Student").waitFor({ timeout: 10000 });
  await teacherPage.getByPlaceholder("student@gmail.com").fill(STUDENT_EMAIL);
  await teacherPage.getByRole("button", { name: "Enroll Student" }).click();
  await teacherPage.getByText(/enrolled!/).waitFor({ timeout: 10000 });

  await studentPage.goto(`${BASE_URL}/dashboard`);
  const topicHref = await studentPage.locator('a[href*="/teach/"]').first().getAttribute("href");

  const results = [];
  for (const persona of PERSONAS) {
    console.log(`\nRunning session: ${persona.name}...`);
    const { url, score, understanding, explanation } = await runSession(studentPage, topicHref, persona);
    console.log(`  -> ${score} | Understanding: ${understanding} | Explanation: ${explanation}`);
    console.log(`  -> ${url}`);
    results.push({ persona: persona.name, score, understanding, explanation, url });
  }

  console.log("\n=== SUMMARY ===");
  console.table(results);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
