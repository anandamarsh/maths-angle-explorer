# Canvas & SVG Scene

**File:** `src/screens/ArcadeAngleScreen.tsx` (sub-components and SVG rendering)
**Supporting:** `src/geometry.ts`

The game scene is rendered as an inline SVG. There is no HTML canvas element — all
graphics are SVG paths, circles, lines, and text nodes.

---

## SVG viewport

```ts
const W = 480;    // viewBox width
const H = 340;    // viewBox height
const CX = 240;   // cannon pivot x (centre)
const CY = 170;   // cannon pivot y (centre)
```

The SVG uses `viewBox="0 0 480 340"` and fills its container via CSS
(`width: 100%; height: 100%`). The container is `position: absolute; inset: 0`.

---

## Coordinate system

Maths angle convention (0=right, 90=up, CCW increasing) is used throughout.
The SVG y-axis is flipped (y increases downward), so all conversions negate `dy`.

Key utility:
```ts
function polarToXY(cx, cy, angleDeg, length): { x, y }
// angleDeg in maths convention → SVG coordinates
```

Example: `polarToXY(240, 170, 90, 150)` → a point 150px directly above centre.

---

## Pointer interaction

### Drag to aim

The SVG listens for pointer events on the **cannon barrel and endpoint handle**.
Dragging begins only if the pointer touches `isPointOnCannon()` or
`isPointOnAimEndpoint()`.

```ts
function isPointOnCannon(svgX, svgY, aimAngle): boolean
// Hit-tests the cannon base (rect + two circles) and barrel (two rects)

function isPointOnAimEndpoint(svgX, svgY, aimAngle): boolean
// Hit-tests a 16px circle at the beam endpoint

function isPointOnAimRay(svgX, svgY, aimAngle): boolean
// Hit-tests within 18px of the ray line segment
```

All pointer coordinates are converted from client pixels to SVG units via:
```ts
function toSVGPoint(svg, clientX, clientY): { x, y }
// Uses svg.getScreenCTM().inverse() for accurate scaling
```

During a drag:
- `gazeAngle` updates every pointer-move via `pointerToAngle(CX, CY, svgX, svgY)`
- Angle snaps at landmark values (0°, 30°, 45°, 60°, 90°, 120°, 135°, 150°, 180°,
  210°, 225°, 240°, 270°, 300°, 315°, 330°, 360°) within `ANGLE_HIT_TOL = 7.5°`
- `playSnap()` fires on each snap transition
- `playAngleTick()` fires every 10ms tick while dragging

### Dev screenshot snip overlay

In localhost dev mode only, the scene also supports a square screenshot snip
overlay:

- a second toolbar icon toggles the snip UI beside the full-scene camera button
- the selector is positioned in client-pixel space over the rendered SVG, not in
  SVG units, so it tracks the visible viewport size
- dragging moves the whole selector
- dragging the resize handle changes width and height together so the crop always
  remains square
- capture uses the same cloned-SVG render path as the full-scene exporter, then
  crops the PNG to the selected square bounds before download/share

### Type to aim

The numeric keypad updates `answer` (string). The angle is parsed as a float when
the player presses Fire. The keypad always aims by typed value in Platinum mode.

---

## Beam endpoint clamping

```ts
const BEAM_LEN = 150;
const TARGET_SPRITE_RADIUS = 20;
const TARGET_EDGE_MARGIN = 4;
const inset = TARGET_SPRITE_RADIUS + TARGET_EDGE_MARGIN;  // 24px

function clampedBeamEndpoint(aimAngle): { x, y }
// Computes raw endpoint at BEAM_LEN, then clamps x to [inset, W-inset]
// and y to [inset, H-inset] so the target never clips the SVG edge.
```

---

## Sub-components (SVG)

### `CannonSprite({ aimAngle, dragging, variant })`

A retro green arcade cannon drawn entirely in SVG. Positioned at origin (0,0); the
parent `<g>` translates it to `(CX, CY)`.

Parts:
- Shadow ellipse (beneath)
- Two wheels with hub and cross-spoke lines
- Body rectangle (green fill, stroke)
- Barrel `<g>` that rotates: `transform={`rotate(${-aimAngle})`}` (negate: maths CCW → SVG CW)
  - Main barrel rect
  - Muzzle ring rect
- Pivot hub (two concentric circles)

Variants:
- `"normal"` — standard green
- `"ghost"` — cyan glow, used as tutorial hint overlay

When `dragging=true`, the barrel gets a `drop-shadow` filter.

### `TargetSprite({ pulse })`

A crosshair target marker rendered at the `hiddenAngleDeg` position.
- Outer ring (circle r=14)
- Middle ring (r=8)
- Centre dot (r=2.5)
- Four hairlines (horizontal + vertical, extending to r=20)
- `pulse=true` → orange colour + pulsing filter

### `GazeBeamDrag({ gazeAngle, level, baseAngle, arcRadiusOverride, dottedRay })`

The live aiming ray:
- A line from `(CX, CY)` to `clampedBeamEndpoint(gazeAngle)`
- A filled sector arc from `baseAngle` to `gazeAngle` (CCW)
- `dottedRay=true` renders a dashed line instead of solid (used in Platinum mode)

### `CoordAxes()`

Two dashed lines through the cannon centre:
- X axis: blue (`#38bdf8`), labelled `+x` (right) and `-x` (left)
- Y axis: green (`#22c55e`), labelled `+y` (top) and `-y` (bottom)

Always visible in background.

### `LiveAngleLabel({ gazeAngle, revealed, answerDeg, baseAngle })`

Live degree readout positioned at the mid-angle of the current arc:
- During drag: shows `${Math.round(gazeAngle - baseAngle)}°` in yellow (`#fde047`)
- After reveal: shows `${Math.round(answerDeg - baseAngle)}°` in green (`#86efac`)
- Hides when arc is < 1°

Label radius varies: `88px` for arcs > 45°, `104px` for arcs ≤ 45°.

### `AngleTypeLabel({ gazeAngle, isDesktop })`

Pill badge in the top-right corner of the canvas. Shows the current angle type
(ACUTE / OBTUSE / STRAIGHT / REFLEX / RIGHT ANGLE / ZERO) with a colour-coded border
and glow matching `getAngleType()`.

Font size: `30px` on desktop, `15px` on mobile.

### `SetTypeLabel({ label, isDesktop })`

Level 2 only. Replaces `AngleTypeLabel`. Shows the set kind:
- `COMPLEMENTARY` (green, `#22c55e`)
- `SUPPLEMENTARY` (orange, `#f97316`)
- `COMPLETE` (blue, `#38bdf8`)

Two lines: type label (large) + sublabel (e.g. `SUM = 180°`, smaller).

---

## Level 2 sector rendering

When `currentQ.sectorArcs` is present, the canvas draws:

**Sector fills** — one `<path>` per sector using `arcPath()`:
- Known sectors: light fill (matching set kind colour at ~12% opacity)
- Missing sector: animated dashed stroke, no fill

**Divider lines** — thin radial lines at each sector boundary:
```ts
dividerAngles.forEach(angle => {
  const p = polarToXY(CX, CY, angle, sectorRadius);
  return <line x1={CX} y1={CY} x2={p.x} y2={p.y} ... />
});
```

**Sector labels** — each known sector label (`"45°"`) positioned at the arc midpoint:
```ts
const mid = midAngleCCW(sector.fromAngle, sector.toAngle);
const p = polarToXY(CX, CY, mid, labelRadius);
```

The missing sector shows a `"?"` label in yellow with a pulsing animation.

**Missing sector radius:**
```ts
function getMissingSectorRadius(question: AngleQuestion): number | null {
  const idx = question.sectorArcs?.findIndex(s => s.missing) ?? -1;
  return idx < 0 ? null : 52 + idx * 12;  // varies by position in set
}
```

---

## Firing animation

When `isFiring` is non-null, `ProjectileTracer` renders:
- A line from `(CX, CY)` toward the target (growing over `SHOT_TRAVEL_MS`)
- A glowing circle at the projectile head

Progress `t` runs from 0 → 1 over `SHOT_TRAVEL_MS`. Driven by `requestAnimationFrame`
via a `useEffect` interval:
```ts
const TICK_INTERVAL = 10; // ms per frame
useEffect(() => {
  if (!isFiring) return;
  const id = setInterval(() => {
    setShotT(prev => Math.min(1, prev + TICK_INTERVAL / SHOT_TRAVEL_MS));
  }, TICK_INTERVAL);
  return () => clearInterval(id);
}, [isFiring]);
```

### `ExplosionAt({ x, y })`

Renders at the hit point after a successful shot:
- Expanding outer ring (CSS `explode-ring` animation)
- Shrinking core circle (CSS `explode-core`)
- 8 spoke lines radiating outward (staggered delays)

---

## Tutorial overlays (SVG)

### `CannonDragHint({ startAngle, hintAngle, isTouchInput, isMobile })`

Ghost cannon at `hintAngle` + finger cursor at the aim endpoint + hint text box.
Shown on the first question until the player first drags.

### `FireRayHint({ aimAngle })`

Pulsing ring + dot at the aim endpoint. Shown after the player has aimed but before
they've pressed Fire for the first time.

### `FingerHintSprite({ x, y, scale })`

Cyan finger cursor SVG. Used within `CannonDragHint`.

---

## HUD elements (HTML, not SVG)

### `ProgressIcon({ collected, gamePhase, preview })`

Inline SVG star shape in the top toolbar. Three colours by phase:
- Normal: blue (`#e0f2fe` fill, `#7dd3fc` stroke)
- Monster: yellow (`#fde047` fill, `#f59e0b` stroke)
- Platinum: silver (`#e2e8f0` fill, `#94a3b8` stroke)

`preview=true` → grey (not yet awarded).

### Fire button

```html
<button class="arcade-button" style="border-color: #fde047; ...">
  <svg><!-- flame / fire icon --></svg>
</button>
```

Positioned `absolute bottom-3 right-3 z-[70]` within the canvas container.
On first appearance: `tutorial-fire-grow` animation. Then: `tutorial-fire-pulse`
(1.05s loop). Pressing applies `scale(0.86)` transform for tactile feel.
