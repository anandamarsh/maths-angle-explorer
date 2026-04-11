import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4002/?level=3";

test.use({ viewport: { width: 1280, height: 800 } });

function barrelLocator(page: Parameters<typeof test>[0]["page"]) {
  return page.locator('svg g[transform="translate(240, 170)"] g[transform^="rotate("]').first();
}

function displayLocator(page: Parameters<typeof test>[0]["page"]) {
  return page.locator('[style*="DSEG7Classic"]').first();
}

async function displayText(page: Parameters<typeof test>[0]["page"]) {
  const displays = await page.locator('[style*="DSEG7Classic"]').evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const element = node as HTMLElement;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          text: (element.textContent ?? "").trim(),
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none",
        };
      })
      .filter((entry) => entry.visible)
      .map((entry) => entry.text),
  );
  return displays[0] ?? "";
}

async function visibleAnswerValue(page: Parameters<typeof test>[0]["page"]) {
  const texts = await page.locator("text=/Answer:\\s*-?\\d+°/").evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const element = node as HTMLElement;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          text: (element.textContent ?? "").trim(),
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none",
        };
      })
      .filter((entry) => entry.visible)
      .map((entry) => entry.text),
  );
  const match = texts[0]?.match(/Answer:\s*(-?\d+)°/);
  if (!match) throw new Error(`Visible demo answer not found: ${texts.join(" | ")}`);
  return Number(match[1]);
}

async function submitVisibleAnswer(page: Parameters<typeof test>[0]["page"]) {
  await expect
    .poll(() => page.locator('[data-testid="level3-bug"]').count(), { timeout: 8000 })
    .toBeGreaterThan(0);
  await page.waitForTimeout(150);
  const answer = await visibleAnswerValue(page);
  const submit = page.locator('[data-autopilot-key="submit"]').first();
  let remaining = answer;
  const stepKeys = answer < 0 ? ["-90", "-60", "-45", "-30"] : ["90", "60", "45", "30"];
  for (const key of stepKeys) {
    const step = Number(key);
    while ((remaining > 0 && remaining >= step) || (remaining < 0 && remaining <= step)) {
      await page.locator(`[data-autopilot-key="${key}"]`).first().click();
      remaining -= step;
    }
  }
  await submit.click();
}

async function dragCannon(page: Parameters<typeof test>[0]["page"], angleDeg: number) {
  const svg = page.locator("svg.touch-none").first();
  const box = await svg.boundingBox();
  if (!box) throw new Error("SVG bounds unavailable");

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const radius = Math.min(box.width, box.height) * 0.22;
  const rad = (angleDeg * Math.PI) / 180;
  const x = cx + Math.cos(rad) * radius;
  const y = cy - Math.sin(rad) * radius;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

test("Level 3 cannon can be grabbed, fired, and dragged again", async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForSelector("#root > *", { timeout: 10000 });
  await page.waitForTimeout(1200);

  const barrel = barrelLocator(page);
  await expect(barrel).toBeVisible();

  const initialTransform = await barrel.getAttribute("transform");

  await dragCannon(page, 60);
  await page.waitForTimeout(250);
  const afterFirstDrag = await barrel.getAttribute("transform");
  expect(afterFirstDrag).not.toBe(initialTransform);

  await page.locator('[data-autopilot-key="submit"]').first().click();
  await page.waitForTimeout(1400);

  await dragCannon(page, 140);
  await page.waitForTimeout(250);
  const afterSecondDrag = await barrel.getAttribute("transform");
  expect(afterSecondDrag).not.toBe(afterFirstDrag);

  const axes = page.locator("svg text").filter({ hasText: "+x" });
  await expect(axes.first()).toBeVisible();
});

test("Level 3 drag can rotate below 0 degrees", async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForSelector("#root > *", { timeout: 10000 });
  await page.waitForTimeout(1200);

  await dragCannon(page, -60);
  await page.waitForTimeout(250);

  const barrel = barrelLocator(page);
  const transform = await barrel.getAttribute("transform");
  expect(transform).toContain("60");
});

test("Level 3 calculator step buttons stay progressive and reset after each fire", async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForSelector("#root > *", { timeout: 10000 });
  await page.waitForTimeout(1200);

  await page.locator('[data-autopilot-key="60"]').first().click();
  await expect.poll(() => displayText(page)).toContain("60");

  await page.locator('[data-autopilot-key="submit"]').first().click();
  await expect.poll(() => displayText(page), { timeout: 2500 }).toContain("0");
  await page.waitForTimeout(1400);

  await page.locator('[data-autopilot-key="30"]').first().click();
  await expect.poll(() => displayText(page)).toContain("30");
});

test("Level 3 never shows more than 3 bugs at once", async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForSelector("#root > *", { timeout: 10000 });
  await page.waitForTimeout(1200);

  let maxSeen = 0;
  for (let i = 0; i < 9; i++) {
    const count = await page.locator('[data-testid="level3-bug"]').count();
    maxSeen = Math.max(maxSeen, count);
    expect(count).toBeLessThanOrEqual(3);
    await page.waitForTimeout(1200);
  }

  expect(maxSeen).toBe(3);
});

test("Level 3 demo mode only drops up to 2 bugs", async ({ page }) => {
  await page.goto("http://localhost:4002/?level=3&demo=1");
  await page.waitForSelector("#root > *", { timeout: 10000 });
  await page.waitForTimeout(1200);

  let maxSeen = 0;
  for (let i = 0; i < 8; i++) {
    const count = await page.locator('[data-testid="level3-bug"]').count();
    maxSeen = Math.max(maxSeen, count);
    expect(count).toBeLessThanOrEqual(2);
    await page.waitForTimeout(1200);
  }

  expect(maxSeen).toBe(2);
});

test("Level 3 demo mode clears normal, monster, and platinum rounds", async ({ page }) => {
  await page.goto("http://localhost:4002/?level=3&demo=1");
  await page.waitForSelector("#root > *", { timeout: 10000 });
  await page.waitForTimeout(1500);

  await submitVisibleAnswer(page);
  await page.waitForTimeout(1800);
  await submitVisibleAnswer(page);

  await page.waitForTimeout(5200);
  await submitVisibleAnswer(page);
  await page.waitForTimeout(1800);
  await submitVisibleAnswer(page);

  await page.waitForTimeout(5200);
  await submitVisibleAnswer(page);
  await page.waitForTimeout(2400);
  await submitVisibleAnswer(page);

  await expect(page.getByText("Play Again").first()).toBeVisible({ timeout: 6000 });
});
