// tests/report.spec.ts — Visual PDF verification test
// Run: npx playwright test tests/report.spec.ts
// Prerequisite: dev server running on http://localhost:4002

import { test, expect } from "@playwright/test";
import path from "path";
import os from "os";

test("generates and downloads test PDF with all phases and levels", async ({ page }) => {
  // Navigate to the app
  await page.goto("http://localhost:4002/");

  // Wait for the app to load (wait for root to have content)
  await page.waitForSelector("#root > *", { timeout: 10000 });

  // Wait for the test helper to be registered on window
  await page.waitForFunction(() => typeof (window as unknown as Record<string, unknown>).__testGeneratePdf === "function", { timeout: 8000 });

  // Set up download listener BEFORE triggering the download
  const downloadDir = os.tmpdir();
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

  // Call the test function
  await page.evaluate(() => {
    const fn = (window as unknown as Record<string, unknown>).__testGeneratePdf as () => Promise<void>;
    return fn();
  });

  // Wait for download
  const download = await downloadPromise;
  const savePath = path.join(downloadDir, "angle-explorer-test-report.pdf");
  await download.saveAs(savePath);

  console.log(`\n✅ PDF saved to: ${savePath}\n`);
  console.log("Please open the PDF to visually verify:");
  console.log("  - Level 1 questions show clean angle diagram (two rays, arc, degree label)");
  console.log("  - Level 2 questions show sector diagram with ? for missing angle");
  console.log("  - NSW Curriculum section with green pill, stage, objective, round descriptions");
  console.log("  - Correct: purple rays; Wrong: gold correct + red user's answer");

  // Basic sanity: file should exist and be > 10KB (a real PDF)
  const fs = await import("fs");
  const stat = fs.statSync(savePath);
  expect(stat.size).toBeGreaterThan(10000);
  expect(savePath.endsWith(".pdf")).toBe(true);
});
