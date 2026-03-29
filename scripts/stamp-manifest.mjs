import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("public/manifest.json");
const placeholder = "__BUILD_STAMP__";

function getSydneyStamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const byType = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${byType.day}:${byType.month}:${byType.year} ${byType.hour}:${byType.minute}`;
}

function getCommitShortSha() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

function replaceBuildStamp(content, stamp) {
  return content.replace(/Build: (?:__BUILD_STAMP__|[^\\]+)\\n\\n/, `Build: ${stamp}\\n\\n`);
}

const mode = process.argv[2];
const manifest = readFileSync(manifestPath, "utf8");

if (mode === "stamp") {
  const stamp = `${getSydneyStamp()} | ${getCommitShortSha()}`;
  writeFileSync(manifestPath, replaceBuildStamp(manifest, stamp));
} else if (mode === "restore") {
  writeFileSync(manifestPath, replaceBuildStamp(manifest, placeholder));
} else {
  console.error("Usage: node scripts/stamp-manifest.mjs <stamp|restore>");
  process.exit(1);
}
