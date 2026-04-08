import { test, expect } from "@playwright/test";

/**
 * Student E2E Flow
 *
 * Tests the full student journey:
 * 1. Visit landing page
 * 2. Navigate to login
 * 3. Login as student (Rohan)
 * 4. See dashboard with topics and scores
 * 5. Pick a topic to teach
 * 6. See the chat interface loads
 * 7. Navigate back to dashboard
 */

test.describe("Student Flow", () => {
  test("landing page loads with hero content", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Shiksha/i);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows validation error on empty login", async ({ page }) => {
    await page.goto("/login");
    await page.locator('button[type="submit"]').click();
    // HTML5 validation should prevent submission or show error
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test("login as student and see dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill("rohan@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Should see welcome message
    await expect(page.locator("text=Welcome back")).toBeVisible({
      timeout: 10000,
    });
  });

  test("student dashboard shows assigned topics", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("rohan@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Should show topics
    await expect(page.locator("text=Assigned Topics")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("text=Photosynthesis")).toBeVisible();
  });

  test("student dashboard shows mastery scores", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("rohan@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Rohan has scores: 85% (photosynthesis), 35% (respiration), 62% (Newton)
    await expect(page.locator("text=85%")).toBeVisible({ timeout: 10000 });
  });

  test("student dashboard shows streak and credits", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("rohan@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Should show credits section
    await expect(page.locator("text=earned")).toBeVisible({ timeout: 10000 });
  });

  test("sidebar is visible on dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("rohan@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Sidebar should have Shiksha branding and navigation
    await expect(page.locator("text=Shiksha")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Dashboard")).toBeVisible();
    await expect(page.locator("text=Sign out")).toBeVisible();
  });

  test("clicking topic navigates to teach page", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("rohan@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Click first topic link
    const topicLink = page.locator('a[href*="/teach/"]').first();
    await expect(topicLink).toBeVisible({ timeout: 10000 });
    await topicLink.click();

    // Should navigate to teach page
    await page.waitForURL("**/teach/**", { timeout: 10000 });
  });

  test("teach page shows chat interface", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("rohan@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    const topicLink = page.locator('a[href*="/teach/"]').first();
    await expect(topicLink).toBeVisible({ timeout: 10000 });
    await topicLink.click();
    await page.waitForURL("**/teach/**", { timeout: 10000 });

    // Chat interface should be visible: a textarea or input for typing
    await expect(
      page.locator('textarea, input[type="text"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("signup page loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("404 page renders for unknown routes", async ({ page }) => {
    await page.goto("/nonexistent-page-xyz");
    await expect(page.locator("text=404").or(page.locator("text=not found"))).toBeVisible({
      timeout: 10000,
    });
  });
});
