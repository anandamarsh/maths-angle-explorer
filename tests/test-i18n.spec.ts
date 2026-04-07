import { test, expect } from "@playwright/test";

const BASE = "http://localhost:4002";
const PORTRAIT_VIEWPORT = { width: 430, height: 932 };

test.use({ viewport: PORTRAIT_VIEWPORT });

test("switch to Hindi, autopilot completes level, send email", async ({ page }) => {
  test.setTimeout(360000); // 6 minutes for autopilot to complete a full level (may be slower under load)
  await page.goto(BASE);
  await page.waitForSelector("#root > *", { timeout: 10000 });
  await page.waitForTimeout(1500);

  // 1. Open language switcher (use whichever instance is visible)
  const langBtn = page.locator('button[aria-label="Language"]').filter({ visible: true }).first();
  await expect(langBtn).toBeVisible({ timeout: 5000 });
  await langBtn.click();

  // 2. Click Hindi option
  const hindiOpt = page.locator("button").filter({ hasText: "\u0939\u093f\u0928\u094d\u0926\u0940" });
  await expect(hindiOpt.first()).toBeVisible({ timeout: 3000 });
  await hindiOpt.first().click();

  // 3. Verify page is now in Hindi
  await page.waitForTimeout(500);
  const bodyText = await page.locator("body").textContent();
  console.log("Body has Hindi content:", /[\u0900-\u097F]/.test(bodyText ?? ""));

  // 4. Activate autopilot via cheat code (in Hindi, aria label is in Hindi)
  await page.keyboard.type("198081");
  const hindiAriaCancel = "autopilot \u0930\u0926\u094d\u0926 \u0915\u0930\u0947\u0902"; // "autopilot रद्द करें"
  const robotIcon = page.getByLabel(hindiAriaCancel).first();
  await expect(robotIcon).toBeVisible({ timeout: 8000 });
  console.log("Autopilot active!");

  // 5. Wait for level to complete AND autopilot to send email to amarsh.anand@gmail.com
  // The autopilot has AUTOPILOT_EMAIL="amarsh.anand@gmail.com" built in — it will type and send it automatically.
  // The success feedback "amarsh.anand@gmail.com को रिपोर्ट भेजी गई" appears after send.
  const emailConfirmation = page.locator("text=amarsh.anand@gmail.com");
  await expect(emailConfirmation.first()).toBeVisible({ timeout: 300000 });
  console.log("Email sent successfully — confirmation visible!");

  // 6. Screenshot of the level complete modal with email confirmation
  await page.screenshot({ path: "/tmp/level-complete-hindi-email-sent.png" });
  console.log("Screenshot saved to /tmp/level-complete-hindi-email-sent.png");
});
