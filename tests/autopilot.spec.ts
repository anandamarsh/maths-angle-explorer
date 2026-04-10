// tests/autopilot.spec.ts — Autopilot feature verification
// Run: npx playwright test tests/autopilot.spec.ts
// Prerequisite: dev server running on http://localhost:4002

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:4002";
const ROBOT_ARIA = "Autopilot active — click to cancel";

// Use portrait viewport so the portrait toolbar (and its AutopilotIcon) is visible
const PORTRAIT_VIEWPORT = { width: 430, height: 932 };

// The icon lives in the portrait toolbar — always use the first visible one
function robotIcon(page: Page) {
  return page.getByLabel(ROBOT_ARIA).first();
}

async function dismissVideoPrompt(page: Page) {
  const dismissButton = page.locator(".social-video-bubble-dismiss").first();
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

async function typeCheatOnKeypad(page: Page) {
  for (const digit of "198081") {
    await page.locator(`[data-autopilot-key="${digit}"]`).first().click({ force: true });
    await page.waitForTimeout(60);
  }
}

test.describe("Autopilot feature", () => {
  test.use({ viewport: PORTRAIT_VIEWPORT });

  test("activates on cheat code 198081 and shows robot icon", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector("#root > *", { timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.keyboard.type("198081");

    await expect(robotIcon(page)).toBeVisible({ timeout: 3000 });
  });

  test.skip("activates on mobile keypad taps for cheat code 198081", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector("#root > *", { timeout: 10000 });
    await page.waitForTimeout(1500);
    await dismissVideoPrompt(page);

    await typeCheatOnKeypad(page);

    await expect(robotIcon(page)).toBeVisible({ timeout: 3000 });
  });

  test("deactivates when cheat code typed again", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector("#root > *", { timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.keyboard.type("198081");
    await expect(robotIcon(page)).toBeVisible({ timeout: 3000 });

    await page.keyboard.type("198081");
    await expect(robotIcon(page)).not.toBeVisible({ timeout: 3000 });
  });

  test("deactivates when robot icon is clicked", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector("#root > *", { timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.keyboard.type("198081");
    await expect(robotIcon(page)).toBeVisible({ timeout: 3000 });

    await robotIcon(page).click();
    await expect(robotIcon(page)).not.toBeVisible({ timeout: 3000 });
  });

  test("autopilot plays a question: phantom hand appears and answer is typed", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector("#root > *", { timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.keyboard.type("198081");
    await expect(robotIcon(page)).toBeVisible({ timeout: 3000 });

    // Phantom hand should appear as autopilot starts aiming
    const phantomHand = page.locator('[aria-hidden="true"].fixed.z-\\[200\\]');
    await expect(phantomHand).toBeVisible({ timeout: 5000 });

    // Keypad display should show a non-zero value once autopilot types digits
    await page.waitForFunction(() => {
      const displays = document.querySelectorAll('[style*="DSEG7Classic"]');
      for (const d of displays) {
        const text = (d.textContent ?? "").trim();
        if (text !== "0°" && text !== "") return true;
      }
      return false;
    }, { timeout: 12000 });
  });

  test("phantom hand disappears when autopilot is cancelled", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector("#root > *", { timeout: 10000 });
    await page.waitForTimeout(1500);

    await page.keyboard.type("198081");
    await expect(robotIcon(page)).toBeVisible({ timeout: 3000 });

    const phantomHand = page.locator('[aria-hidden="true"].fixed.z-\\[200\\]');
    await expect(phantomHand).toBeVisible({ timeout: 5000 });

    await page.keyboard.type("198081");

    await expect(robotIcon(page)).not.toBeVisible({ timeout: 3000 });
    await expect(phantomHand).not.toBeVisible({ timeout: 1000 });
  });
});
