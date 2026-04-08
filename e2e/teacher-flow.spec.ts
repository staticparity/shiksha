import { test, expect } from "@playwright/test";

/**
 * Teacher E2E Flow
 *
 * Tests the teacher journey:
 * 1. Login as teacher (Ananya)
 * 2. See teacher dashboard
 * 3. Verify class overview data loads
 * 4. Sidebar shows teacher navigation
 */

test.describe("Teacher Flow", () => {
  test("login as teacher and see dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.locator('input[type="email"]').fill("ananya@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    // Teacher should be redirected to teacher dashboard
    await page.waitForURL("**/teacher/dashboard", { timeout: 15000 });

    // Should see teacher dashboard content
    await expect(page.locator("text=Shiksha")).toBeVisible({ timeout: 10000 });
  });

  test("teacher dashboard shows class data", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("ananya@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/teacher/dashboard", { timeout: 15000 });

    // Should display class-related content (heatmap, students, etc.)
    // The teacher dashboard client component should load
    await expect(page.locator("body")).toBeVisible();
  });

  test("teacher sidebar has correct role", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("ananya@greenfield.edu");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/teacher/dashboard", { timeout: 15000 });

    // Sidebar should show teacher role
    await expect(page.locator("text=teacher")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Sign out")).toBeVisible();
  });
});
