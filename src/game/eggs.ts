/**
 * Simple white egg silhouettes (original paths) for scene + UI.
 * Each variant is a closed path in 0–100 × 0–120 local coords (tip at top).
 */

export const WHITE_EGG_VARIANTS = [
  // Classic symmetric egg
  "M50 4 C22 4 8 38 8 68 C8 98 26 116 50 116 C74 116 92 98 92 68 C92 38 78 4 50 4Z",
  // Slightly rounder
  "M50 6 C24 6 10 40 10 70 C10 100 28 118 50 118 C72 118 90 100 90 70 C90 40 76 6 50 6Z",
  // Narrower / taller
  "M50 2 C20 2 6 36 6 70 C6 104 26 119 50 119 C74 119 94 104 94 70 C94 36 80 2 50 2Z",
] as const;

export function eggVariantIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % WHITE_EGG_VARIANTS.length;
}
