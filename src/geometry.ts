/**
 * Angle convention used throughout this project:
 *   0°   = pointing right  (positive x)
 *   90°  = pointing UP     (negative y in SVG, since SVG y-axis is flipped)
 *   180° = pointing left
 *   270° = pointing down
 * Angles increase counter-clockwise (standard maths convention).
 *
 * SVG coordinate system has y increasing downward, so we negate dy when
 * converting between SVG pointer positions and maths angles.
 */

/** Convert a pointer position on the SVG (svgX, svgY) relative to a vertex (cx, cy)
 *  into a maths angle in degrees [0, 360). */
export function pointerToAngle(cx: number, cy: number, svgX: number, svgY: number): number {
  const dx = svgX - cx
  const dy = -(svgY - cy) // flip y so up = positive
  let deg = Math.atan2(dy, dx) * (180 / Math.PI)
  if (deg < 0) deg += 360
  return deg
}

/** Compute the angular span from fromAngle to toAngle going counter-clockwise.
 *  Result is in [0, 360). */
export function spanCCW(fromAngle: number, toAngle: number): number {
  let span = toAngle - fromAngle
  while (span < 0) span += 360
  while (span >= 360) span -= 360
  return span
}

/** Convert a maths angle (degrees, 0=right, CCW) and radius into an SVG {x, y} endpoint. */
export function polarToXY(
  cx: number,
  cy: number,
  angleDeg: number,
  length: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + Math.cos(rad) * length,
    y: cy - Math.sin(rad) * length, // negate: up = negative y in SVG
  }
}

/**
 * Build an SVG arc path string.
 * Draws the arc going counter-clockwise from startAngle to endAngle
 * (both in maths convention: 0=right, CCW increasing).
 * The arc covers the angular span going CCW from start → end.
 */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToXY(cx, cy, startAngle, r)
  const end = polarToXY(cx, cy, endAngle, r)

  const span = spanCCW(startAngle, endAngle)
  if (span === 0) return ''

  const largeArcFlag = span > 180 ? 1 : 0
  // In SVG, sweepFlag=0 draws counter-clockwise — which matches our CCW convention
  // when the y-axis is flipped (math ↑ = SVG ↓), CCW in math = CW on screen.
  // So we use sweepFlag=0 for the correct visual result with the flipped y axis.
  const sweepFlag = 0

  return (
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} ` +
    `A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
  )
}

/**
 * If `angle` is within `threshold` degrees of any value in `targets`,
 * return the nearest target. Otherwise return `angle` unchanged.
 */
export function snapAngle(angle: number, targets: number[], threshold: number): number {
  let best = angle
  let bestDist = threshold
  for (const t of targets) {
    const dist = Math.abs(angle - t)
    if (dist < bestDist) {
      bestDist = dist
      best = t
    }
  }
  return best
}

/** Round to one decimal place — used for display labels. */
export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Clamp a value between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Given two ray angles (maths convention), return the mid-angle between them
 *  going CCW — used to position arc labels. */
export function midAngleCCW(fromAngle: number, toAngle: number): number {
  const span = spanCCW(fromAngle, toAngle)
  return (fromAngle + span / 2 + 360) % 360
}
