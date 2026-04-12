import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4002/?level=2";

test.use({ viewport: { width: 1280, height: 800 } });

async function firstSoldierState(page: Parameters<typeof test>[0]["page"]) {
  return page.locator('[data-testid="level3-soldier"]').first().evaluate((node) => {
    const el = node as SVGGElement;
    const transform = el.getAttribute("transform") ?? "";
    const match = transform.match(/translate\(([-0-9.]+)\s+([-0-9.]+)\)/);
    return {
      transform,
      y: match ? Number(match[2]) : null,
      parachuting: el.getAttribute("data-parachuting"),
    };
  });
}

test("Level 2 first soldier drops in from above before landing", async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForSelector('[data-testid="level3-soldier"]', { timeout: 10000 });

  const initial = await firstSoldierState(page);
  expect(initial.parachuting).toBe("true");
  expect(initial.y).not.toBeNull();
  expect(initial.y!).toBeLessThan(0);

  await page.waitForTimeout(1200);
  const later = await firstSoldierState(page);
  expect(later.parachuting).toBe("true");
  expect(later.y).not.toBeNull();
  expect(later.y!).toBeGreaterThan(initial.y! + 10);
});
