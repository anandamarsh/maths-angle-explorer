import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { makeQuestion, type AngleQuestion } from "../game/angles";
import {
  startMusic,
  shuffleMusic,
  switchToMonsterMusic,
  toggleMute,
  isMuted,
  playButton,
  playFlashDrop,
  playCorrect,
  playWrong,
  playSnap,
  playAngleTick,
  playMonsterStart,
  playMonsterVictory,
  playGoldenEgg,
  playGameComplete,
  playTargetDeploy,
  playCannonFire,
  playExplosion,
  playTypewriterClick,
  playKeyClick,
  ensureAudioReady,
} from "../sound";
import { polarToXY, arcPath, pointerToAngle } from "../geometry";
import { formatText, texts } from "../texts";
import {
  SocialShare,
  SocialComments,
  openCommentsComposer,
} from "../components/Social";

// ─── Constants ────────────────────────────────────────────────────────────────

const IS_DEV = import.meta.env.DEV;
const IS_LOCALHOST_DEV =
  IS_DEV &&
  new Set(["localhost", "127.0.0.1", "::1"]).has(
    globalThis.location?.hostname ?? "",
  );

function readInitialLevel(): 1 | 2 {
  if (typeof window === "undefined") return 1;
  const raw = new URLSearchParams(window.location.search).get("level");
  return raw === "2" ? 2 : 1;
}

const MONSTER_ROUND_NAMES = texts.rounds.monster.names;
const PLATINUM_ROUND_NAMES = texts.rounds.platinum.names;

const LEVEL_BG: Record<string, { bg: string; glow: string; tint: string }> = {
  "1-normal": { bg: "#080e1c", glow: "#1e3a5f", tint: "transparent" },
  "1-monster": {
    bg: "#0f0520",
    glow: "#5b21b6",
    tint: "rgba(109,40,217,0.08)",
  },
  "1-platinum": {
    bg: "#080b14",
    glow: "#94a3b8",
    tint: "rgba(148,163,184,0.07)",
  },
  "2-normal": { bg: "#071510", glow: "#14532d", tint: "transparent" },
  "2-monster": { bg: "#180a00", glow: "#92400e", tint: "rgba(234,88,12,0.1)" },
  "2-platinum": {
    bg: "#0a0c14",
    glow: "#94a3b8",
    tint: "rgba(148,163,184,0.07)",
  },
  "3-normal": { bg: "#07161a", glow: "#134e4a", tint: "transparent" },
  "3-monster": { bg: "#1a0508", glow: "#7f1d1d", tint: "rgba(220,38,38,0.1)" },
  "3-platinum": {
    bg: "#090c16",
    glow: "#94a3b8",
    tint: "rgba(148,163,184,0.07)",
  },
};

const W = 480;
const H = 340;
const CX = 240;
const CY = 170;
const BEAM_LEN = 150;
const EGG_RADIUS = 130;
const DEPLOY_MS = 900;
const SHOT_MS = 380;
const SPIN_MS = 600;
const HIT_RESOLVE_MS = 1000;
const PLATINUM_REVEAL_MS = 500;
const ROUND_ANNOUNCE_MS = 4200;
const L1_TARGET_RADIUS = 100;
const TARGET_DISTANCE = BEAM_LEN;
const TARGET_EDGE_MARGIN = 4;
const TARGET_SPRITE_RADIUS = 20;
const SHOT_TRAVEL_MS = Math.round(
  (TARGET_DISTANCE / L1_TARGET_RADIUS) * SHOT_MS,
);
const SAFE_AREA_BOTTOM_PAD = "calc(env(safe-area-inset-bottom, 0px) + 8px)";
const MIN_AIM_RADIUS = 40;
const LEVEL_TARGET_COUNT = texts.rounds.targetCount;
const SHELL_SHARE_URL = texts.generic.shellShareUrl;
const ANGLE_HIT_TOL = 7.5; // drag/snap tolerance
const TYPED_TOL = 0.55; // typed answer must be exact (allows ±0.5 for decimal rounding)
const TICK_INTERVAL = 10;

type Level2SetKindKey = keyof (typeof texts.levels)["2"]["setKinds"];

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function shortestSignedAngleDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function closestEquivalentAngle(raw: number, reference: number): number {
  const candidates = [raw - 360, raw, raw + 360];
  let best = candidates[0];
  let bestDist = Math.abs(candidates[0] - reference);
  for (const candidate of candidates.slice(1)) {
    const dist = Math.abs(candidate - reference);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

function snapAngleValue(
  angle: number,
  targets: number[],
  threshold: number,
): number {
  for (const target of targets) {
    if (Math.abs(angle - target) < threshold) return target;
  }
  return angle;
}

function getInstructionPrompt(
  level: 1 | 2,
  gamePhase: "normal" | "monster" | "platinum",
) {
  return gamePhase === "normal"
    ? texts.levels[String(level) as "1" | "2"].prompts.normal
    : texts.levels[String(level) as "1" | "2"].prompts.platinum;
}

function getAngleType(deg: number): { label: string; color: string } {
  const a = ((deg % 360) + 360) % 360; // normalise to [0, 360) so -90 → 270 (REFLEX)
  if (a < 0.5 || a > 359.5)
    return { label: texts.levels["1"].angleTypes.ZERO, color: "#64748b" };
  if (Math.abs(a - 90) < 2)
    return {
      label: texts.levels["1"].angleTypes.RIGHT_ANGLE,
      color: "#22c55e",
    };
  if (Math.abs(a - 180) < 2)
    return { label: texts.levels["1"].angleTypes.STRAIGHT, color: "#a78bfa" };
  if (a > 180)
    return { label: texts.levels["1"].angleTypes.REFLEX, color: "#f97316" };
  if (a < 90)
    return { label: texts.levels["1"].angleTypes.ACUTE, color: "#38bdf8" };
  return { label: texts.levels["1"].angleTypes.OBTUSE, color: "#c084fc" };
}

function toSVGPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const r = pt.matrixTransform(ctm.inverse());
  return { x: r.x, y: r.y };
}

function pointInRect(
  x: number,
  y: number,
  left: number,
  top: number,
  width: number,
  height: number,
) {
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

function pointInCircle(
  x: number,
  y: number,
  cx: number,
  cy: number,
  r: number,
) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
}

function rotatePoint(x: number, y: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function isPointOnCannon(svgX: number, svgY: number, aimAngle: number) {
  const localX = svgX - CX;
  const localY = svgY - CY;

  const onBase =
    pointInRect(localX, localY, -22, -10, 44, 24) ||
    pointInCircle(localX, localY, 0, 0, 12) ||
    pointInCircle(localX, localY, -14, 13, 12) ||
    pointInCircle(localX, localY, 14, 13, 12);

  const barrelLocal = rotatePoint(localX, localY, aimAngle);
  const onBarrel =
    pointInRect(barrelLocal.x, barrelLocal.y, 0, -10, 60, 20) ||
    pointInRect(barrelLocal.x, barrelLocal.y, 42, -11, 16, 22);

  return onBase || onBarrel;
}

function isPointOnAimEndpoint(svgX: number, svgY: number, aimAngle: number) {
  const endpoint = polarToXY(CX, CY, aimAngle, BEAM_LEN);
  return pointInCircle(svgX, svgY, endpoint.x, endpoint.y, 16);
}

function isPointOnAimRay(svgX: number, svgY: number, aimAngle: number) {
  const rayEnd = polarToXY(CX, CY, aimAngle, BEAM_LEN);
  return pointToSegmentDistance(svgX, svgY, CX, CY, rayEnd.x, rayEnd.y) <= 18;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Retro arcade cannon centred at origin. Barrel rotates with aimAngle. */
function CannonSprite({
  aimAngle,
  dragging,
  variant = "normal",
}: {
  aimAngle: number;
  dragging: boolean;
  variant?: "normal" | "ghost";
}) {
  const barrelRot = -aimAngle; // math CCW → SVG CW
  const isGhost = variant === "ghost";
  const wheelFill = "#052e16";
  const wheelStroke = "#15803d";
  const wheelHub = "#14532d";
  const wheelLine = "#166534";
  const bodyFill = "#052e16";
  const bodyStroke = "#16a34a";
  const barrelStroke = isGhost ? "#67e8f9" : "#4ade80";
  const pivotFill = "#14532d";
  const pivotStroke = isGhost ? "#67e8f9" : "#22c55e";
  const pivotCore = isGhost ? "#67e8f9" : "#86efac";
  return (
    <g
      opacity={isGhost ? 0.82 : 1}
      style={
        isGhost
          ? { filter: "drop-shadow(0 0 10px rgba(103,232,249,0.42))" }
          : undefined
      }
    >
      {/* Shadow */}
      <ellipse cx={0} cy={17} rx={28} ry={7} fill="rgba(0,0,0,0.45)" />
      {/* Wheels */}
      {([-14, 14] as const).map((wx, i) => (
        <g key={i}>
          <circle
            cx={wx}
            cy={13}
            r={10}
            fill={wheelFill}
            stroke={wheelStroke}
            strokeWidth={2.5}
          />
          <circle cx={wx} cy={13} r={4} fill={wheelHub} />
          <line
            x1={wx}
            y1={3}
            x2={wx}
            y2={23}
            stroke={wheelLine}
            strokeWidth={1.5}
          />
          <line
            x1={wx - 10}
            y1={13}
            x2={wx + 10}
            y2={13}
            stroke={wheelLine}
            strokeWidth={1.5}
          />
        </g>
      ))}
      {/* Body */}
      <rect
        x={-20}
        y={-8}
        width={40}
        height={20}
        rx={5}
        fill={bodyFill}
        stroke={bodyStroke}
        strokeWidth={2}
      />
      {/* Barrel (rotates) */}
      <g transform={`rotate(${barrelRot})`}>
        <rect
          x={2}
          y={-7}
          width={48}
          height={14}
          rx={4}
          fill={bodyFill}
          stroke={barrelStroke}
          strokeWidth={2}
          style={
            dragging
              ? { filter: `drop-shadow(0 0 7px ${barrelStroke})` }
              : undefined
          }
        />
        {/* Muzzle ring */}
        <rect
          x={46}
          y={-8}
          width={10}
          height={16}
          rx={3}
          fill={bodyFill}
          stroke={barrelStroke}
          strokeWidth={2}
        />
      </g>
      {/* Pivot hub */}
      <circle
        cx={0}
        cy={0}
        r={7}
        fill={pivotFill}
        stroke={pivotStroke}
        strokeWidth={1.5}
      />
      <circle cx={0} cy={0} r={3} fill={pivotCore} />
    </g>
  );
}

function FingerHintSprite({
  x,
  y,
  scale = 0.6,
}: {
  x: number;
  y: number;
  scale?: number;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale}) translate(-30.53 -4.53)`}
      style={{
        pointerEvents: "none",
        filter: "drop-shadow(0 0 10px rgba(103,232,249,0.42))",
      }}
    >
      <path
        d="M24.76,22.64V12.4c0-3.18,2.59-5.77,5.77-5.77,1.44,0,2.82,.54,3.89,1.51,1.07,1,1.72,2.33,1.85,3.76l.87,10.08c2.12-1.88,3.39-4.59,3.39-7.48,0-5.51-4.49-10-10-10s-10,4.49-10,10c0,3.29,1.62,6.29,4.23,8.14Z"
        fill="#67e8f9"
      />
      <path
        d="M55.98,69.53c0-.14,.03-.28,.09-.41l4.48-9.92v-18.37c0-1.81-1.08-3.48-2.76-4.26-6.75-3.13-13.8-4.84-20.95-5.08-.51-.01-.92-.41-.97-.91l-1.6-18.5c-.08-.94-.51-1.82-1.2-2.46-.7-.63-1.6-.99-2.54-.99-2.08,0-3.77,1.69-3.77,3.77V48.48h-2v-13.32c-2.61,.46-4.69,2.65-4.91,5.36-.56,6.79-.53,14.06,.08,21.62,.28,3.44,2.42,6.52,5.58,8.05l4.49,2.18c.35,.17,.56,.52,.56,.9v2.23h25.42v-5.97Z"
        fill="#67e8f9"
      />
    </g>
  );
}

function CannonDragHint({
  startAngle,
  hintAngle,
  isTouchInput,
  isMobile,
}: {
  startAngle: number;
  hintAngle: number;
  isTouchInput: boolean;
  isMobile: boolean;
}) {
  void startAngle;
  const endpoint = polarToXY(CX, CY, hintAngle, BEAM_LEN);
  const hintLabel = isTouchInput ? "Touch and Rotate" : "Click and Rotate";
  const hintFontSize = isMobile ? 19.5 : 13;
  const hintBoxWidth = isMobile ? 248 : 174;
  return (
    <g style={{ pointerEvents: "none" }}>
      <g transform={`translate(${CX}, ${CY})`}>
        <CannonSprite aimAngle={hintAngle} dragging={false} variant="ghost" />
      </g>
      <FingerHintSprite x={endpoint.x} y={endpoint.y} />
      <g transform={`translate(${endpoint.x} ${endpoint.y + 52})`}>
        <rect
          x={-hintBoxWidth / 2}
          y={-10}
          width={hintBoxWidth}
          height={22}
          rx={8}
          fill="rgba(15,23,42,0.88)"
          stroke="rgba(56,189,248,0.35)"
          strokeWidth={1}
        />
        <text
          x={0}
          y={2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={hintFontSize}
          fontWeight="900"
          fill="#67e8f9"
          letterSpacing="0.02em"
        >
          {hintLabel}
        </text>
      </g>
    </g>
  );
}

function FireButtonHint({ onFire }: { onFire: () => void }) {
  const [settled, setSettled] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    setSettled(false);
    const timer = window.setTimeout(() => setSettled(true), 460);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="absolute bottom-3 right-3 z-[70]">
      <button
        type="button"
        onClick={onFire}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        className="arcade-button flex h-10 w-[calc(50%-1px)] min-w-[5.25rem] items-center justify-center"
        style={{
          transformOrigin: "bottom right",
          animation: settled
            ? "tutorial-fire-pulse 1.05s ease-in-out infinite"
            : "tutorial-fire-grow 460ms cubic-bezier(0.2,0.9,0.22,1) both",
          borderColor: "#fde047",
          boxShadow:
            "0 0 0 2px rgba(250,204,21,0.36), 0 0 28px rgba(250,204,21,0.72)",
          zIndex: 70,
        }}
      >
        <span
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: `scale(${pressed ? 0.86 : 1})`,
            transition: "transform 120ms ease-out",
          }}
        >
          <svg viewBox="0 0 24 24" fill="white" className="h-8 w-8">
            <path d="M12 2C12 2 7 6 7 13H9L7 22L12 19L17 22L15 13H17C17 6 12 2 12 2Z" />
            <path
              d="M9 13C9 13 7 14 6 16C7 16 8 15.5 9 15"
              fill="rgba(255,180,0,0.9)"
            />
            <path
              d="M15 13C15 13 17 14 18 16C17 16 16 15.5 15 15"
              fill="rgba(255,180,0,0.9)"
            />
          </svg>
        </span>
      </button>
    </div>
  );
}

function FireRayHint({ aimAngle }: { aimAngle: number }) {
  const endpoint = polarToXY(CX, CY, aimAngle, BEAM_LEN);

  return (
    <g style={{ pointerEvents: "none" }}>
      <circle
        cx={endpoint.x}
        cy={endpoint.y}
        r={13}
        fill="rgba(250,204,21,0.2)"
        stroke="#fde047"
        strokeWidth={2.5}
        style={{ animation: "pulse-ring 1.05s ease-in-out infinite" }}
      />
      <circle
        cx={endpoint.x}
        cy={endpoint.y}
        r={6}
        fill="#facc15"
        style={{ filter: "drop-shadow(0 0 10px rgba(250,204,21,0.95))" }}
      />
    </g>
  );
}

/** Target crosshair — replaces mystery egg. */
function TargetSprite({ pulse }: { pulse?: boolean }) {
  const col = pulse ? "#f97316" : "#ef4444";
  const glow = pulse
    ? `drop-shadow(0 0 7px ${col}) drop-shadow(0 0 18px rgba(239,68,68,0.5))`
    : `drop-shadow(0 0 3px ${col})`;
  return (
    <g style={{ filter: glow }}>
      <circle
        cx={0}
        cy={0}
        r={14}
        fill="rgba(239,68,68,0.08)"
        stroke={col}
        strokeWidth={2.5}
      />
      <circle cx={0} cy={0} r={8} fill="none" stroke={col} strokeWidth={1.5} />
      <circle cx={0} cy={0} r={2.5} fill={col} />
      <line
        x1={-20}
        y1={0}
        x2={-11}
        y2={0}
        stroke={col}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={11}
        y1={0}
        x2={20}
        y2={0}
        stroke={col}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={0}
        y1={-20}
        x2={0}
        y2={-11}
        stroke={col}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={0}
        y1={11}
        x2={0}
        y2={20}
        stroke={col}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Known angle marker (replaces scene egg). */
function KnownMarker({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.65))" }}>
      <circle
        cx={x}
        cy={y}
        r={7}
        fill="rgba(56,189,248,0.15)"
        stroke="#38bdf8"
        strokeWidth={1.5}
      />
      <line
        x1={x - 5}
        y1={y}
        x2={x + 5}
        y2={y}
        stroke="#38bdf8"
        strokeWidth={1.5}
      />
      <line
        x1={x}
        y1={y - 5}
        x2={x}
        y2={y + 5}
        stroke="#38bdf8"
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 17}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fontWeight="900"
        fontFamily="monospace"
        fill="#7dd3fc"
        stroke="rgba(0,0,0,0.8)"
        strokeWidth={2.5}
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  );
}

/** Glowing projectile tracer during a shot. */
function ProjectileTracer({
  aimAngle,
  t,
  hit,
  targetRadius,
}: {
  aimAngle: number;
  t: number;
  hit: boolean;
  targetRadius: number;
}) {
  const maxDist = hit ? targetRadius : targetRadius * 1.42;
  const projDist = t * maxDist;
  const proj = polarToXY(CX, CY, aimAngle, projDist);
  const trail = polarToXY(CX, CY, aimAngle, Math.max(0, projDist - 22));
  return (
    <g>
      <line
        x1={trail.x}
        y1={trail.y}
        x2={proj.x}
        y2={proj.y}
        stroke="#fbbf24"
        strokeWidth={3}
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 6px #f97316)" }}
      />
      <circle
        cx={proj.x}
        cy={proj.y}
        r={4.5}
        fill="#fde047"
        style={{ filter: "drop-shadow(0 0 10px #f97316)" }}
      />
    </g>
  );
}

/** Explosion SVG at a fixed point (CSS animated). */
function ExplosionAt({ x, y }: { x: number; y: number }) {
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={18}
        fill="rgba(249,115,22,0.45)"
        stroke="#f97316"
        strokeWidth={3}
        style={{
          animation: "explode-ring 0.52s ease-out forwards",
          transformOrigin: `${x}px ${y}px`,
        }}
      />
      <circle
        cx={x}
        cy={y}
        r={10}
        fill="#fbbf24"
        style={{
          animation: "explode-core 0.36s ease-out forwards",
          transformOrigin: `${x}px ${y}px`,
        }}
      />
      {spokes.map((a, i) => {
        const ep = polarToXY(x, y, a, 26);
        return (
          <line
            key={i}
            x1={x}
            y1={y}
            x2={ep.x}
            y2={ep.y}
            stroke="#fde047"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.85}
            style={{
              animation: `explode-ring 0.44s ${i * 0.018}s ease-out forwards`,
              transformOrigin: `${x}px ${y}px`,
            }}
          />
        );
      })}
    </g>
  );
}

/** HUD progress star icon — replaces egg for shooter theme. */
function ProgressIcon({
  collected,
  gamePhase,
  preview = false,
}: {
  collected: boolean;
  gamePhase: "normal" | "monster" | "platinum";
  preview?: boolean;
}) {
  const outerR = 10,
    innerR = 4.2,
    pts = 5,
    cx = 11,
    cy = 11;
  let d = "";
  for (let i = 0; i < pts * 2; i++) {
    const a = (i * Math.PI) / pts - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    d +=
      (i === 0 ? "M" : "L") +
      ` ${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)} `;
  }
  d += "Z";
  const fill = preview
    ? "#94a3b8"
    : !collected
      ? "transparent"
      : gamePhase === "platinum"
        ? "#e2e8f0"
        : gamePhase === "monster"
          ? "#fde047"
          : "#e0f2fe";
  const stroke = preview
    ? "#64748b"
    : !collected
      ? "rgba(255,255,255,0.25)"
      : gamePhase === "platinum"
        ? "#94a3b8"
        : gamePhase === "monster"
          ? "#f59e0b"
          : "#7dd3fc";
  const glow = preview
    ? "none"
    : !collected
      ? "none"
      : gamePhase === "platinum"
        ? "drop-shadow(0 0 5px rgba(226,232,240,0.9)) drop-shadow(0 0 10px rgba(148,163,184,0.5))"
        : gamePhase === "monster"
          ? "drop-shadow(0 0 6px rgba(251,191,36,0.95)) drop-shadow(0 0 12px rgba(250,204,21,0.55))"
          : "drop-shadow(0 0 5px rgba(125,211,252,0.85))";
  return (
    <svg
      viewBox="0 0 22 22"
      width="22"
      height="22"
      style={{
        filter: glow,
        transition: "all 0.3s",
        opacity: collected || preview ? 1 : 0.45,
      }}
    >
      <path
        d={d}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Live angle value near the gaze arc midpoint; turns green on reveal. */
function LiveAngleLabel({
  gazeAngle,
  revealed,
  answerDeg,
  baseAngle = 0,
}: {
  gazeAngle: number;
  revealed: boolean;
  answerDeg: number;
  baseAngle?: number;
}) {
  const displayAnswer = baseAngle === 0 ? answerDeg : answerDeg - baseAngle;
  const arcAngle = revealed ? displayAnswer : gazeAngle - baseAngle;
  if (Math.abs(arcAngle) < 1 && !revealed) return null;
  const text = revealed
    ? `${Math.round(displayAnswer)}°`
    : `${Math.round(gazeAngle - baseAngle)}°`;
  // Keep the live sweep label away from the beam in L2.
  const midAngle = baseAngle + arcAngle / 2;
  const labelRadius =
    baseAngle === 0 ? (Math.abs(arcAngle) <= 45 ? 104 : 88) : 116;
  const p = polarToXY(CX, CY, midAngle, labelRadius);
  return (
    <text
      x={p.x}
      y={p.y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={16}
      fontWeight="900"
      fontFamily="monospace"
      fill={revealed ? "#86efac" : "#fde047"}
      stroke="rgba(0,0,0,0.88)"
      strokeWidth={4}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}

/** Angle-type banner (ACUTE / OBTUSE / etc.) with pill background. */
function AngleTypeLabel({ gazeAngle }: { gazeAngle: number }) {
  const { label, color } = getAngleType(gazeAngle);
  return (
    <div
      className="pointer-events-none absolute right-3 top-3 z-20 rounded-full px-5 py-2 text-center"
      style={{
        background: "rgba(5,10,25,0.97)",
        border: `1.8px solid ${color}`,
        filter: `drop-shadow(0 0 8px ${color}90)`,
        color,
        fontSize: "15px",
        fontWeight: 900,
        fontFamily: "monospace",
        letterSpacing: "0.08em",
        lineHeight: 1,
      }}
    >
      {label}
    </div>
  );
}

function SetTypeLabel({ label }: { label: string }) {
  const setKindKey = label as Level2SetKindKey;
  const setTexts = texts.levels["2"].setKinds[setKindKey];
  const color = label.includes("COMPLEMENTARY")
    ? "#22c55e"
    : label.includes("SUPPLEMENTARY")
      ? "#f97316"
      : "#38bdf8";
  const displayLabel = setTexts?.label ?? label;
  const sublabel = setTexts?.sublabel ?? "";
  return (
    <div
      className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-center rounded-full px-5 py-2 text-center"
      style={{
        background: "rgba(5,10,25,0.97)",
        border: `1.8px solid ${color}`,
        filter: `drop-shadow(0 0 8px ${color}90)`,
      }}
    >
      <div
        style={{
          color,
          fontSize: "12px",
          fontWeight: 900,
          fontFamily: "monospace",
          letterSpacing: "0.06em",
          lineHeight: 1.1,
        }}
      >
        {displayLabel}
      </div>
      <div
        style={{
          color,
          fontSize: "9px",
          fontWeight: 900,
          fontFamily: "monospace",
          letterSpacing: "0.08em",
          lineHeight: 1.1,
          opacity: 0.95,
          marginTop: "2px",
        }}
      >
        {sublabel}
      </div>
    </div>
  );
}

function getMissingSectorRadius(question: AngleQuestion): number | null {
  const missingIdx =
    question.sectorArcs?.findIndex((sector) => sector.missing) ?? -1;
  if (missingIdx < 0) return null;
  return 52 + missingIdx * 12;
}

/** Coordinate axes through cannon centre — full screen. */
function CoordAxes() {
  // Axes extend to SVG edges
  return (
    <g style={{ pointerEvents: "none" }} opacity={0.75}>
      {/* X axis — full width */}
      <line
        x1={0}
        y1={CY}
        x2={W}
        y2={CY}
        stroke="#38bdf8"
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      {/* Y axis — full height */}
      <line
        x1={CX}
        y1={0}
        x2={CX}
        y2={H}
        stroke="#22c55e"
        strokeWidth={1.5}
        strokeDasharray="6 4"
      />
      {/* Labels */}
      <text
        x={W - 8}
        y={CY - 8}
        textAnchor="end"
        fontSize={10}
        fill="#38bdf8"
        fontFamily="monospace"
        fontWeight="bold"
      >
        +x
      </text>
      <text
        x={10}
        y={CY - 8}
        textAnchor="start"
        fontSize={10}
        fill="#38bdf8"
        fontFamily="monospace"
        fontWeight="bold"
      >
        -x
      </text>
      <text
        x={CX + 8}
        y={14}
        textAnchor="start"
        fontSize={10}
        fill="#22c55e"
        fontFamily="monospace"
        fontWeight="bold"
      >
        +y
      </text>
      <text
        x={CX + 8}
        y={H - 6}
        textAnchor="start"
        fontSize={10}
        fill="#22c55e"
        fontFamily="monospace"
        fontWeight="bold"
      >
        -y
      </text>
    </g>
  );
}

/** Bright aim beam + sector arc — shown while actively aiming or firing. */
function GazeBeamDrag({
  gazeAngle,
  level: _level,
  baseAngle = 0,
  arcRadiusOverride,
  dottedRay = false,
}: {
  gazeAngle: number;
  level: 1 | 2 | 3;
  baseAngle?: number;
  arcRadiusOverride?: number;
  dottedRay?: boolean;
}) {
  const ep = polarToXY(CX, CY, gazeAngle, BEAM_LEN);
  const beamColor = "#38bdf8";
  const displaySweep = gazeAngle - baseAngle;

  // Arc: signed (handle negative angles for L1)
  const absAngle = Math.abs(displaySweep);
  const arcR = arcRadiusOverride ?? 52;

  // Build signed arc path for the main angle arc
  function signedArcPath(): string {
    if (absAngle < 0.5) return "";
    const start = polarToXY(CX, CY, baseAngle, arcR);
    const end = polarToXY(CX, CY, gazeAngle, arcR);
    const largeArc = absAngle > 180 ? 1 : 0;
    const sweepFlag = displaySweep >= 0 ? 0 : 1;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${arcR} ${arcR} 0 ${largeArc} ${sweepFlag} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  // Arrowhead sits at the end of the arc and points along the tangent.
  function arcArrowhead(): { x: number; y: number; rot: number } | null {
    if (absAngle < 6) return null;
    const travelSign = displaySweep >= 0 ? 1 : -1;
    const inset =
      absAngle <= 90
        ? Math.min(18, Math.max(10, absAngle * 0.18))
        : Math.min(14, Math.max(7, absAngle * 0.12));
    const tipAngle = gazeAngle - travelSign * Math.min(inset, absAngle / 3);
    const tip = polarToXY(CX, CY, tipAngle, arcR);
    // tangent direction at arc end: perpendicular to radius, in direction of arc travel
    const tangentAngle = travelSign > 0 ? tipAngle + 90 : tipAngle - 90;
    return { x: tip.x, y: tip.y, rot: 90 - tangentAngle }; // arrow shape points up by default
  }

  const arcD = signedArcPath();
  const arrow = arcArrowhead();
  const compArcD = "";
  const suppArcD = "";

  return (
    <g style={{ pointerEvents: "none" }}>
      {arcD && (
        <path
          d={arcD}
          stroke={beamColor}
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dottedRay ? "7 6" : undefined}
        />
      )}
      {compArcD && (
        <path
          d={compArcD}
          stroke="#22c55e"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="5 4"
          opacity={0.75}
        />
      )}
      {suppArcD && (
        <path
          d={suppArcD}
          stroke="#a78bfa"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="5 4"
          opacity={0.75}
        />
      )}
      {/* Aim ray */}
      <line
        x1={CX}
        y1={CY}
        x2={ep.x}
        y2={ep.y}
        stroke={beamColor}
        strokeWidth={7}
        strokeLinecap="round"
        opacity={0.18}
      />
      <line
        x1={CX}
        y1={CY}
        x2={ep.x}
        y2={ep.y}
        stroke={beamColor}
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeDasharray={dottedRay ? "7 6" : undefined}
        style={{ filter: `drop-shadow(0 0 5px ${beamColor})` }}
      />
      <circle
        cx={ep.x}
        cy={ep.y}
        r={7}
        fill={beamColor}
        fillOpacity={0.2}
        stroke={beamColor}
        strokeWidth={2}
      />
      <circle cx={ep.x} cy={ep.y} r={3.2} fill={beamColor} />
      {/* Arrowhead on arc */}
      {arrow && (
        <g transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.rot})`}>
          <path d="M 0 -6 L 5 4 L 0 2 L -5 4 Z" fill={beamColor} />
        </g>
      )}
    </g>
  );
}

/** Level 1 scene: starfield + distant mountains. */
function L1Scene() {
  const stars = [
    [30, 20],
    [90, 45],
    [165, 18],
    [240, 35],
    [320, 12],
    [400, 38],
    [458, 22],
    [50, 80],
    [130, 95],
    [205, 68],
    [290, 85],
    [375, 72],
    [455, 92],
    [15, 130],
    [100, 148],
    [180, 125],
    [265, 145],
    [345, 130],
    [430, 148],
    [40, 190],
    [120, 205],
    [200, 192],
    [330, 200],
    [415, 210],
    [470, 188],
  ];
  return (
    <g opacity={0.55}>
      {stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.5 : 1} fill="white" />
      ))}
      <path
        d={`M0 ${H} Q60 236 120 254 Q160 214 200 240 Q250 206 300 236 Q340 210 380 232 Q420 198 460 220 L480 ${H} Z`}
        fill="rgba(30,58,95,0.35)"
      />
    </g>
  );
}

/** Level 2 scene: bounded angle set with divider rays and labelled sectors. */
function L2Scene({
  question,
  showMissingMarker,
  focusMissingAngle,
}: {
  question: AngleQuestion;
  showMissingMarker: boolean;
  focusMissingAngle: boolean;
}) {
  const dividerAngles = question.dividerAngles ?? [0, question.totalContext];
  const sectors = question.sectorArcs ?? [];
  const activeSector = sectors.find((sector) => sector.missing);
  const activeFrom = activeSector?.fromAngle;
  const activeTo = activeSector?.toAngle;
  return (
    <g>
      {dividerAngles.map((angle, i) => {
        const end = polarToXY(
          CX,
          CY,
          angle === 360 ? 0 : angle,
          EGG_RADIUS + 18,
        );
        const isActiveEdge =
          !focusMissingAngle || angle === activeFrom || angle === activeTo;
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={end.x}
            y2={end.y}
            stroke="rgba(248,250,252,0.95)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={isActiveEdge ? 1 : 0.3}
          />
        );
      })}
      {sectors.map((sector, i) => {
        const span = sector.toAngle - sector.fromAngle;
        if (span < 4) return null;
        const radius = 52 + i * 12;
        const label = sector.missing && !showMissingMarker ? "" : sector.label;
        const mid = sector.fromAngle + span / 2;
        const labelRadius = radius + 16;
        const p = polarToXY(CX, CY, mid, labelRadius);
        const isActiveSector = !focusMissingAngle || sector.missing;
        return (
          <g key={i}>
            <path
              d={arcPath(CX, CY, radius, sector.fromAngle, sector.toAngle)}
              fill="none"
              stroke={sector.missing ? "#fde047" : "rgba(248,250,252,0.92)"}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={isActiveSector ? 1 : 0.3}
            />
            {label && (
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fontWeight="900"
                fontFamily="monospace"
                fill={sector.missing ? "#fde047" : "#f8fafc"}
                stroke="rgba(0,0,0,0.95)"
                strokeWidth={3}
                paintOrder="stroke"
                opacity={isActiveSector ? 1 : 0.3}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Highlights numbers in yellow within prompt text. */
function ColoredPrompt({
  text,
  className = "",
  hideFirstChar = false,
}: {
  text: string;
  className?: string;
  hideFirstChar?: boolean;
}) {
  const parts = text.split(/(\d+\.?\d*)/g);
  let firstCharPending = hideFirstChar;
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (!firstCharPending || p.length === 0) {
          return /^\d+\.?\d*$/.test(p) ? (
            <span key={i} className="text-yellow-300 font-black">
              {p}
            </span>
          ) : (
            p
          );
        }
        firstCharPending = false;
        const firstChar = p[0];
        const rest = p.slice(1);
        const isNumber = /^\d+\.?\d*$/.test(p);
        const numberClass = isNumber ? "text-yellow-300 font-black" : undefined;
        return (
          <span key={i} className={numberClass}>
            <span className="opacity-0">{firstChar}</span>
            {rest}
          </span>
        );
      })}
    </span>
  );
}

/** On-screen numeric keypad — replaces the keyboard input. */
function NumericKeypad({
  value,
  onChange,
  onFire,
  canFire: canFireProp,
  disabled,
  hideDisplay = false,
  fireRef,
  roundKey,
  fullWidth = false,
  inviteGlow = false,
  emphasizeFire = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onFire: () => void;
  canFire: boolean;
  disabled: boolean;
  hideDisplay?: boolean;
  fireRef?: React.RefObject<HTMLButtonElement | null>;
  roundKey?: number;
  fullWidth?: boolean;
  inviteGlow?: boolean;
  emphasizeFire?: boolean;
}) {
  const [minimized, setMinimized] = useState(false);
  const [firePressed, setFirePressed] = useState(false);
  const [fireGrowAnim, setFireGrowAnim] = useState(false);
  const [glowKeys, setGlowKeys] = useState<string[]>([]);
  useEffect(() => {
    setMinimized(false);
  }, [roundKey]);
  useEffect(() => {
    if (!inviteGlow) {
      setGlowKeys([]);
      return;
    }
    const candidates = [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      ".",
      "±",
      "⌫",
    ];
    const pickGlowKeys = () => {
      const pool = [...candidates];
      const idx = Math.floor(Math.random() * pool.length);
      setGlowKeys([pool[idx]]);
    };
    pickGlowKeys();
    const timer = window.setInterval(pickGlowKeys, 840);
    return () => window.clearInterval(timer);
  }, [inviteGlow]);
  useEffect(() => {
    if (!emphasizeFire) {
      setFireGrowAnim(false);
      setFirePressed(false);
      return;
    }
    setFireGrowAnim(true);
    const timer = window.setTimeout(() => setFireGrowAnim(false), 420);
    return () => window.clearTimeout(timer);
  }, [emphasizeFire]);
  function press(key: string) {
    playKeyClick();
    if (disabled) return;
    if (key === "⌫") {
      const next = value.slice(0, -1);
      onChange(next === "-" ? "" : next);
    } else if (key === "±") {
      if (value.startsWith("-")) onChange(value.slice(1));
      else if (value === "" || value === "0") onChange("-0");
      else onChange("-" + value);
    } else if (key === ".") {
      if (!value.includes(".")) onChange(value === "" ? "0." : value + ".");
    } else {
      if (value === "0") onChange(key);
      else if (value === "-0") onChange(`-${key}`);
      else onChange(value + key);
    }
  }

  const display = value === "" ? "0" : value;
  const shownDisplay = hideDisplay ? "---" : display;

  const rows = [
    ["7", "8", "9", "⌫"],
    ["4", "5", "6", "±"],
    ["1", "2", "3", "."],
  ];

  const base =
    "rounded flex items-center justify-center font-black select-none text-xl h-10 transition-[transform,background-color,color,border-color,box-shadow] active:scale-95";
  const activeKeyStyle =
    "active:bg-cyan-300 active:text-sky-950 active:border-cyan-100 active:shadow-[0_0_0_2px_rgba(103,232,249,0.34),0_0_18px_rgba(34,211,238,0.55),inset_0_-2px_0_rgba(8,47,73,0.18)]";
  const digit = `${base} bg-slate-800 text-slate-100 border border-slate-600/60 ${activeKeyStyle}`;
  const op = `${base} bg-slate-700/80 text-slate-100 border border-slate-500/60 ${activeKeyStyle}`;
  const fireButtonStyle = emphasizeFire
    ? {
        position: "absolute" as const,
        right: 0,
        bottom: 0,
        zIndex: 30,
        width: "calc(50% - 1px)",
        height: "2.5rem",
        transformOrigin: "bottom right",
        animation: fireGrowAnim
          ? "keypad-fire-grow 420ms cubic-bezier(0.2,0.9,0.22,1) both, keypad-fire-pulse 1.15s 420ms ease-in-out infinite"
          : "keypad-fire-pulse 1.15s ease-in-out infinite",
      }
    : undefined;

  return (
    <div
      className={`flex flex-col gap-1 rounded-xl p-1.5 shrink-0 min-w-0 ${fullWidth ? "w-full" : "w-36 sm:w-40 md:w-44 lg:w-48"}`}
      style={{
        background: "rgba(2,6,23,0.97)",
        border: "4px solid rgba(255,255,255,0.7)",
        boxShadow:
          "0 0 18px rgba(56,189,248,0.12), inset 0 0 12px rgba(0,0,0,0.4)",
      }}
    >
      {/* LCD Display */}
      <div
        className="rounded-lg px-2 h-12 flex items-center justify-end overflow-hidden cursor-pointer"
        onClick={() => setMinimized((m) => !m)}
        style={{
          fontFamily: "'DSEG7Classic', 'Courier New', monospace",
          fontWeight: 700,
          fontSize: "2.1rem",
          background: minimized ? "rgba(0,8,4,0)" : "rgba(0,8,4,0.95)",
          border: minimized
            ? "2px solid rgba(56,189,248,0)"
            : "2px solid rgba(56,189,248,0.28)",
          color: "#67e8f9",
          textShadow:
            "0 0 10px rgba(103,232,249,0.85), 0 0 22px rgba(56,189,248,0.4)",
          letterSpacing: "0.12em",
        }}
      >
        {shownDisplay}°
      </div>
      {/* Digit rows */}
      <div
        className="flex flex-col gap-0.5"
        style={{
          overflow: minimized ? "hidden" : "visible",
          maxHeight: minimized ? "0px" : "300px",
          opacity: minimized ? 0 : 1,
          pointerEvents: minimized ? "none" : "auto",
          transition: "max-height 0.4s ease-in-out, opacity 0.3s ease-in-out",
        }}
      >
        {rows.map((row, r) => (
          <div key={r} className="grid grid-cols-4 gap-0.5">
            {row.map((btn) => (
              <button
                key={btn}
                onClick={() => press(btn)}
                className={/[0-9]/.test(btn) ? digit : op}
                style={
                  glowKeys.includes(btn)
                    ? {
                        background:
                          "linear-gradient(180deg, #67e8f9 0%, #22d3ee 100%)",
                        color: "#082f49",
                        borderColor: "#cffafe",
                        boxShadow:
                          "0 0 0 2px rgba(103,232,249,0.34), 0 0 18px rgba(34,211,238,0.55), inset 0 -2px 0 rgba(8,47,73,0.18)",
                        animation:
                          "keypad-tutorial-key 1.2s ease-in-out infinite",
                      }
                    : undefined
                }
              >
                <span
                  className={
                    btn === "⌫"
                      ? "text-4xl leading-none"
                      : btn === "±"
                        ? "text-3xl leading-none"
                        : btn === "."
                          ? "text-4xl leading-none font-black"
                          : undefined
                  }
                >
                  {btn}
                </span>
              </button>
            ))}
          </div>
        ))}
        {/* Zero + Fire */}
        <div className="flex gap-0.5 mt-0.5 relative">
          <button onClick={() => press("0")} className={`${digit} flex-[2]`}>
            0
          </button>
          <button
            ref={fireRef}
            onClick={onFire}
            onPointerDown={() => setFirePressed(true)}
            onPointerUp={() => setFirePressed(false)}
            onPointerCancel={() => setFirePressed(false)}
            onPointerLeave={() => setFirePressed(false)}
            disabled={!canFireProp}
            className={`${base} flex-[2] arcade-button disabled:opacity-40 disabled:cursor-not-allowed`}
            style={emphasizeFire && canFireProp ? { opacity: 0 } : undefined}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
              <path d="M12 2C12 2 7 6 7 13H9L7 22L12 19L17 22L15 13H17C17 6 12 2 12 2Z" />
              <path
                d="M9 13C9 13 7 14 6 16C7 16 8 15.5 9 15"
                fill="rgba(255,180,0,0.9)"
              />
              <path
                d="M15 13C15 13 17 14 18 16C17 16 16 15.5 15 15"
                fill="rgba(255,180,0,0.9)"
              />
            </svg>
          </button>
          {emphasizeFire && canFireProp && (
            <button
              type="button"
              onClick={onFire}
              onPointerDown={() => setFirePressed(true)}
              onPointerUp={() => setFirePressed(false)}
              onPointerCancel={() => setFirePressed(false)}
              onPointerLeave={() => setFirePressed(false)}
              className={`${base} arcade-button`}
              style={fireButtonStyle}
            >
              <span
                className="flex h-full w-full items-center justify-center rounded"
                style={{
                  borderColor: "#fde047",
                  boxShadow:
                    "0 0 0 2px rgba(250,204,21,0.32), 0 0 26px rgba(250,204,21,0.7)",
                  transform: `scale(${firePressed ? 0.88 : 1})`,
                  transition:
                    "transform 140ms ease-out, box-shadow 180ms ease-out",
                }}
              >
                <svg viewBox="0 0 24 24" fill="white" className="h-8 w-8">
                  <path d="M12 2C12 2 7 6 7 13H9L7 22L12 19L17 22L15 13H17C17 6 12 2 12 2Z" />
                  <path
                    d="M9 13C9 13 7 14 6 16C7 16 8 15.5 9 15"
                    fill="rgba(255,180,0,0.9)"
                  />
                  <path
                    d="M15 13C15 13 17 14 18 16C17 16 16 15.5 15 15"
                    fill="rgba(255,180,0,0.9)"
                  />
                </svg>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Golden target icon for win/gameover screens. */
function GoldenTarget() {
  return (
    <svg
      viewBox="0 0 40 40"
      width="32"
      height="32"
      style={{
        filter:
          "drop-shadow(0 0 6px rgba(250,204,21,0.95)) drop-shadow(0 0 16px rgba(251,191,36,0.55))",
      }}
    >
      <circle
        cx="20"
        cy="20"
        r="17"
        fill="none"
        stroke="#facc15"
        strokeWidth="3"
      />
      <circle
        cx="20"
        cy="20"
        r="10"
        fill="none"
        stroke="#facc15"
        strokeWidth="2"
      />
      <circle cx="20" cy="20" r="4" fill="#facc15" />
      <line x1="2" y1="20" x2="10" y2="20" stroke="#facc15" strokeWidth="2" />
      <line x1="30" y1="20" x2="38" y2="20" stroke="#facc15" strokeWidth="2" />
      <line x1="20" y1="2" x2="20" y2="10" stroke="#facc15" strokeWidth="2" />
      <line x1="20" y1="30" x2="20" y2="38" stroke="#facc15" strokeWidth="2" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArcadeAngleScreen() {
  const initialLevelRef = useRef<1 | 2>(readInitialLevel());
  const initialLevel = initialLevelRef.current;
  const [level, setLevel] = useState<1 | 2>(initialLevel);
  const [unlockedLevel, setUnlockedLevel] = useState<1 | 2>(initialLevel);
  const [screen, setScreen] = useState<"playing" | "won" | "gameover">(
    "playing",
  );
  const [showShareDrawer, setShowShareDrawer] = useState(false);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    const coarsePointer =
      window.matchMedia?.("(pointer: coarse)").matches ?? false;
    return (
      coarsePointer && Math.min(window.innerWidth, window.innerHeight) < 900
    );
  });
  const [isTouchInput, setIsTouchInput] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(pointer: coarse)").matches ?? false;
  });
  const [isMobileLandscape, setIsMobileLandscape] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024 && window.innerWidth > window.innerHeight;
  });
  const [currentQ, setCurrentQ] = useState<AngleQuestion>(() =>
    makeQuestion(initialLevel),
  );
  const [eggsCollected, setEggsCollected] = useState(0);
  const [monsterEggs, setMonsterEggs] = useState(0);
  const [gamePhase, setGamePhase] = useState<"normal" | "monster" | "platinum">(
    "normal",
  );

  const [gazeAngle, setGazeAngle] = useState(() => currentQ.startAngleDeg ?? 0);
  const [dragging, setDragging] = useState(false);

  const [answer, setAnswer] = useState("");
  const [subAnswers, setSubAnswers] = useState<[string, string, string]>([
    "",
    "",
    "",
  ]);
  const [subStep, setSubStep] = useState(0);

  const [calcRoundKey, setCalcRoundKey] = useState(0);

  const [soundMuted, setSoundMuted] = useState(() => isMuted());
  const [flash, setFlash] = useState<{
    text: string;
    ok: boolean;
    icon?: boolean;
  } | null>(null);
  const [monsterRoundName, setMonsterRoundName] = useState("");
  const [showMonsterAnnounce, setShowMonsterAnnounce] = useState(false);
  const [hasDiscoveredCannonDrag, setHasDiscoveredCannonDrag] = useState(false);
  const [typedAimTutorialStage, setTypedAimTutorialStage] = useState<
    "type" | "fire" | "done"
  >("type");
  const [hasSeenFirstFireTutorial, setHasSeenFirstFireTutorial] =
    useState(false);
  const [firstFireTutorialReady, setFirstFireTutorialReady] = useState(false);
  const [tutorialAngle, setTutorialAngle] = useState(0);
  const [tutorialHintVisible, setTutorialHintVisible] = useState(false);

  const [revealedAngle, setRevealedAngle] = useState<number | null>(null);
  const isFullScreenOverlayActive =
    showMonsterAnnounce || screen === "won" || screen === "gameover";

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    window.parent.postMessage(
      {
        type: "interactive-maths:overlay-active",
        active:
          showShareDrawer || showCommentsDrawer || isFullScreenOverlayActive,
      },
      "*",
    );
  }, [isFullScreenOverlayActive, showCommentsDrawer, showShareDrawer]);

  // Intro / deploy animation
  type IntroPhase = "origin" | "deploying" | "ready";
  const [introPhase, setIntroPhase] = useState<IntroPhase>("origin");
  const [deployT, setDeployT] = useState(0);
  const [panelVisible, setPanelVisible] = useState(false);
  const [typeIdx, setTypeIdx] = useState(0);
  const [introKey, setIntroKey] = useState(0); // bump to replay intro for same Q

  // Shot animation
  const [isFiring, setIsFiring] = useState<{
    hit: boolean;
    aimAngle: number;
  } | null>(null);
  const [shotT, setShotT] = useState(0);
  const [explosion, setExplosion] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Spin animation (monster round: cannon rotates to typed angle before firing)
  const [spinAnim, setSpinAnim] = useState<{
    from: number;
    to: number;
    startT: number;
  } | null>(null);
  const [platinumActorsVisible, setPlatinumActorsVisible] = useState(true);
  const [platinumRevealPending, setPlatinumRevealPending] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const fireButtonRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);
  const flashTimerRef = useRef<number | null>(null);
  const platinumRevealTimerRef = useRef<number | null>(null);
  const lastTickAngleRef = useRef(-999);
  const gazeAngleRef = useRef(currentQ.startAngleDeg ?? 0); // always in sync with gazeAngle state
  const lastPointerAngleRef = useRef<number | null>(null); // raw [0,360) from last pointer event
  const dragAngleRef = useRef(0); // continuous unsnapped drag angle during active drag
  const gamePhaseRef = useRef<"normal" | "monster" | "platinum">("normal");
  const currentQRef = useRef(currentQ);
  const earnEggRef = useRef(() => {});
  const earnMonsterEggRef = useRef(() => {});
  const earnPlatinumEggRef = useRef(() => {});
  const loseEggRef = useRef(() => {});
  const submitLockRef = useRef(false);

  gamePhaseRef.current = gamePhase;
  currentQRef.current = currentQ;
  gazeAngleRef.current = gazeAngle;

  const sceneBusy =
    introPhase !== "ready" ||
    isFiring !== null ||
    spinAnim !== null ||
    platinumRevealPending;
  const sceneBusyRef = useRef(false);
  sceneBusyRef.current = sceneBusy;

  useEffect(() => {
    setPlatinumActorsVisible(gamePhase !== "platinum" || level === 1);
    setPlatinumRevealPending(false);
    if (platinumRevealTimerRef.current) {
      clearTimeout(platinumRevealTimerRef.current);
      platinumRevealTimerRef.current = null;
    }
  }, [currentQ.id, gamePhase, introKey, level]);

  useEffect(() => {
    startMusic();
    setSoundMuted(isMuted());
  }, []);

  useEffect(() => {
    const syncViewportMode = () => {
      const coarsePointer =
        window.matchMedia?.("(pointer: coarse)").matches ?? false;
      setIsTouchInput(coarsePointer);
      setIsCompactViewport(
        coarsePointer && Math.min(window.innerWidth, window.innerHeight) < 900,
      );
      setIsMobileLandscape(
        window.innerWidth < 1024 && window.innerWidth > window.innerHeight,
      );
    };

    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    return () => window.removeEventListener("resize", syncViewportMode);
  }, []);

  useEffect(() => {
    if (
      level !== 1 ||
      hasDiscoveredCannonDrag ||
      showMonsterAnnounce ||
      gamePhase !== "normal" ||
      introPhase !== "ready" ||
      sceneBusy
    ) {
      setTutorialHintVisible(false);
      return;
    }

    let frameId = 0;
    let startedAt = 0;
    const delayMs = 1000;
    const holdMs = 500;
    const travelMs = 1400;
    const cycleMs = holdMs + travelMs + holdMs + travelMs;
    const revealTimer = window.setTimeout(
      () => setTutorialHintVisible(true),
      delayMs,
    );
    const hintFrom = 0;
    const targetDelta = shortestSignedAngleDelta(
      hintFrom,
      currentQ.hiddenAngleDeg,
    );
    const hintDelta =
      Math.sign(targetDelta || 1) * Math.min(Math.abs(targetDelta), 60);
    setTutorialHintVisible(false);
    setTutorialAngle(hintFrom);

    const animate = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt;
      const activeElapsed = Math.max(0, elapsed - delayMs);
      let wave = 0;

      if (elapsed >= delayMs) {
        const cyclePos = activeElapsed % cycleMs;

        if (cyclePos < holdMs) {
          wave = 0;
        } else if (cyclePos < holdMs + travelMs) {
          const t = (cyclePos - holdMs) / travelMs;
          wave = (1 - Math.cos(Math.PI * t)) / 2;
        } else if (cyclePos < holdMs + travelMs + holdMs) {
          wave = 1;
        } else {
          const t = (cyclePos - holdMs - travelMs - holdMs) / travelMs;
          wave = (1 + Math.cos(Math.PI * t)) / 2;
        }
      }

      setTutorialAngle(hintFrom + hintDelta * wave);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(revealTimer);
    };
  }, [
    currentQ.hiddenAngleDeg,
    currentQ.startAngleDeg,
    gamePhase,
    hasDiscoveredCannonDrag,
    introPhase,
    level,
    sceneBusy,
    showMonsterAnnounce,
  ]);

  const canFireRef = useRef(false);

  function handleAudioToggle() {
    const nextMuted = toggleMute();
    if (!nextMuted) ensureAudioReady();
    setSoundMuted(nextMuted);
  }

  function canUseNativeShare() {
    const nav = navigator as Navigator & {
      standalone?: boolean;
    };

    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      !!nav.standalone ||
      navigator.maxTouchPoints > 0
    );
  }

  async function handleShare() {
    playButton();
    setShowCommentsDrawer(false);

    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data?: ShareData) => boolean;
      standalone?: boolean;
    };
    const shareData: ShareData = {
      title: document.title || texts.generic.appTitle,
      text: texts.generic.social.shareTitle,
      url: SHELL_SHARE_URL,
    };
    const looksMobileOrPwa = canUseNativeShare();

    if (
      looksMobileOrPwa &&
      typeof nav.share === "function" &&
      (!nav.canShare || nav.canShare(shareData))
    ) {
      try {
        await nav.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }

    setShowShareDrawer((s) => !s);
  }

  async function handleCaptureScene() {
    if (!IS_LOCALHOST_DEV) return;
    const svg = svgRef.current;
    if (!svg) return;

    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      clone.setAttribute("width", String(W));
      clone.setAttribute("height", String(H));

      const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bg.setAttribute("x", "0");
      bg.setAttribute("y", "0");
      bg.setAttribute("width", String(W));
      bg.setAttribute("height", String(H));
      bg.setAttribute("fill", phaseBg.bg);
      clone.insertBefore(bg, clone.firstChild);

      const svgText = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        img.onload = () => {
          const scale = 2;
          const canvas = document.createElement("canvas");
          canvas.width = W * scale;
          canvas.height = H * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context unavailable"));
            return;
          }
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          ctx.drawImage(img, 0, 0, W, H);
          URL.revokeObjectURL(url);
          canvas.toBlob((blobOut) => {
            if (!blobOut) {
              reject(new Error("Unable to encode PNG"));
              return;
            }
            resolve(blobOut);
          }, "image/png");
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Unable to render scene snapshot"));
        };
        img.src = url;
      });

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `angle-explorer-scene-${stamp}.png`;
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data?: ShareData) => boolean;
      };
      const file = new File([pngBlob], fileName, { type: "image/png" });
      const shareData: ShareData = {
        files: [file],
        title: "Angle Explorer scene",
        text: "Save or share this Angle Explorer scene.",
      };

      if (
        canUseNativeShare() &&
        typeof nav.share === "function" &&
        (!nav.canShare || nav.canShare(shareData))
      ) {
        try {
          await nav.share(shareData);
          showFlash("Image ready to share", true);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        }
      }

      const pngUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(pngUrl);
      showFlash("Scene downloaded", true);
    } catch {
      showFlash("Capture failed", false);
    }
  }

  // ── Desktop keyboard → keypad binding ──────────────────────────────────────
  const keypadValueRef = useRef("");
  const handleKeypadChangeRef = useRef((_v: string) => {});
  const doSubmitRef = useRef(() => {});
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (sceneBusyRef.current) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key;
      if (k === "Enter") {
        e.preventDefault();
        if (keypadValueRef.current.trim() !== "") {
          window.setTimeout(() => doSubmitRef.current(), 0);
        }
        return;
      }
      const isDigit = /^[0-9]$/.test(k);
      const isBackspace = k === "Backspace" || k === "Delete";
      const isMinus = k === "-" || k === "Subtract";
      const isDecimal = k === "." || k === "Decimal";
      if (!isDigit && !isBackspace && !isMinus && !isDecimal) return;
      e.preventDefault();
      playKeyClick();
      const val = keypadValueRef.current;
      let next: string;
      if (isBackspace) {
        next = val.slice(0, -1);
      } else if (isMinus) {
        if (val.startsWith("-")) next = val.slice(1);
        else if (val === "" || val === "0") next = "-0";
        else next = "-" + val;
      } else if (isDecimal) {
        if (val.includes(".")) return;
        next = val === "" ? "0." : val + ".";
      } else {
        if (val === "0") next = k;
        else if (val === "-0") next = `-${k}`;
        else next = val + k;
      }
      keypadValueRef.current = next;
      handleKeypadChangeRef.current(next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Target deploy intro animation ──────────────────────────────────────────
  useEffect(() => {
    setIntroPhase("origin");
    setDeployT(0);
    setPanelVisible(false);
    setTypeIdx(0);
    setRevealedAngle(null);
    setExplosion(null);

    let animId = 0;
    const t1 = window.setTimeout(() => {
      playTargetDeploy();
      setIntroPhase("deploying");
      const start = performance.now();
      function frame(now: number) {
        const prog = Math.min(1, (now - start) / DEPLOY_MS);
        setDeployT(easeOutCubic(prog));
        if (prog < 1) {
          animId = requestAnimationFrame(frame);
        } else {
          setIntroPhase("ready");
          setPanelVisible(true);
        }
      }
      animId = requestAnimationFrame(frame);
    }, 220);

    return () => {
      window.clearTimeout(t1);
      cancelAnimationFrame(animId);
    };
  }, [currentQ.id, introKey]);

  // ── Typewriter ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!panelVisible) {
      setTypeIdx(0);
      return;
    }
    if (currentQ.promptLines) {
      setTypeIdx(999);
      return;
    } // L3: show all at once
    const text = currentQ.prompt;
    setTypeIdx(0);
    let i = 0;
    const iv = window.setInterval(() => {
      i++;
      setTypeIdx(i);
      playTypewriterClick();
      if (i >= text.length) window.clearInterval(iv);
    }, 22);
    return () => window.clearInterval(iv);
  }, [panelVisible, currentQ.id]);

  // ── Shot animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFiring) return;
    let cancelled = false;
    const { hit, aimAngle } = isFiring;
    const t0 = performance.now();
    let animId = 0;
    function frame(now: number) {
      if (cancelled) return;
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / SHOT_TRAVEL_MS);
      setShotT(t);
      if (elapsed < SHOT_TRAVEL_MS) {
        animId = requestAnimationFrame(frame);
        return;
      }
      // Shot complete
      setIsFiring(null);
      if (hit) {
        playCorrect();
        playExplosion();
        const q = currentQRef.current;
        const qRadius = TARGET_DISTANCE;
        const fhPt = polarToXY(CX, CY, q.hiddenAngleDeg, qRadius);
        setRevealedAngle(aimAngle);
        setExplosion({ x: fhPt.x, y: fhPt.y });
        window.setTimeout(() => {
          setExplosion(null);
          if (gamePhaseRef.current === "platinum") earnPlatinumEggRef.current();
          else if (gamePhaseRef.current === "monster")
            earnMonsterEggRef.current();
          else earnEggRef.current();
        }, HIT_RESOLVE_MS);
      } else {
        loseEggRef.current();
      }
    }
    animId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
    };
  }, [isFiring]);

  // ── Spin animation (monster round: cannon rotates to typed angle before firing) ───
  useEffect(() => {
    if (!spinAnim) return;
    let cancelled = false;
    let animId = 0;
    function frame(now: number) {
      if (cancelled) return;
      const t = Math.min(1, (now - spinAnim!.startT) / SPIN_MS);
      const current =
        spinAnim!.from + (spinAnim!.to - spinAnim!.from) * easeOutCubic(t);
      setGazeAngle(current);
      if (t < 1) {
        animId = requestAnimationFrame(frame);
      } else {
        setSpinAnim(null);
        const q = currentQRef.current;
        const correct = angleDiffDeg(current, q.hiddenAngleDeg) < TYPED_TOL;
        fireCannon(correct, current);
      }
    }
    animId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
    };
  }, [spinAnim]);

  // ── Drag / aim handling ────────────────────────────────────────────────────
  const moveGaze = useCallback(
    (svgX: number, svgY: number) => {
      if (sceneBusyRef.current) return;
      const dx = svgX - CX;
      const dy = svgY - CY;
      if (Math.hypot(dx, dy) < MIN_AIM_RADIUS) return;
      const raw = pointerToAngle(CX, CY, svgX, svgY); // always [0, 360)
      const q = currentQRef.current;
      let angle: number;
      if (level === 1) {
        const prevRaw = lastPointerAngleRef.current;
        if (prevRaw === null) {
          // First drag sample: choose the equivalent angle closest to the current barrel.
          angle = closestEquivalentAngle(raw, dragAngleRef.current);
        } else {
          // Keep the drag continuous across 180°/0° so the sign reflects drag direction.
          angle = dragAngleRef.current + shortestSignedAngleDelta(prevRaw, raw);
        }
        dragAngleRef.current = Math.min(Math.max(angle, -360), 360);
        angle = dragAngleRef.current;
      } else {
        const start = q.startAngleDeg ?? 0;
        const max = q.totalContext;
        const reference =
          lastPointerAngleRef.current === null
            ? dragAngleRef.current
            : dragAngleRef.current;
        const continuous = closestEquivalentAngle(raw, reference);
        angle = Math.min(Math.max(continuous, start), max);
        dragAngleRef.current = angle;
      }
      lastPointerAngleRef.current = raw;

      const SNAP_TARGETS =
        level === 1
          ? [
              -180, -150, -135, -120, -90, -60, -45, -30, 0, 30, 45, 60, 90,
              120, 135, 150, 180,
            ]
          : [q.hiddenAngleDeg];
      const snapped = snapAngleValue(angle, SNAP_TARGETS, 5);
      if (snapped !== angle) {
        if (snapped !== gazeAngleRef.current) playSnap();
        angle = snapped;
      }
      const tickAngle =
        level === 2 ? Math.max(0, angle - (q.startAngleDeg ?? 0)) : angle;
      const tickInterval = level === 2 ? 5 : TICK_INTERVAL;
      if (Math.abs(tickAngle - lastTickAngleRef.current) >= tickInterval) {
        lastTickAngleRef.current = tickAngle;
        const tickSoundAngle =
          level === 2 ? (tickAngle / Math.max(q.answer, 1)) * 360 : tickAngle;
        playAngleTick(tickSoundAngle);
      }
      gazeAngleRef.current = angle; // update synchronously so next pointer event has correct base
      setGazeAngle(angle);

      // Normal rounds mirror drag into the keypad; special rounds do not.
      if (
        !currentQRef.current.promptLines &&
        gamePhaseRef.current === "normal"
      ) {
        const displayAngle =
          level === 2
            ? angle - (currentQRef.current.startAngleDeg ?? 0)
            : angle;
        setAnswer(String(Math.round(displayAngle)));
      }
    },
    [level],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingRef.current || !svgRef.current) return;
      const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
      moveGaze(x, y);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      lastPointerAngleRef.current = null;
      dragAngleRef.current = gazeAngleRef.current;
      setDragging(false);
      if (
        level === 1 &&
        gamePhaseRef.current === "normal" &&
        !hasSeenFirstFireTutorial &&
        canFireRef.current
      ) {
        setFirstFireTutorialReady(true);
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [moveGaze]);

  function startDrag(e: React.PointerEvent) {
    if (sceneBusy) return;
    if (!svgRef.current) return;
    const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
    if (
      showFireHint &&
      canKeypadFire &&
      isPointOnAimEndpoint(x, y, aimForBeam)
    ) {
      e.preventDefault();
      doSubmit();
      return;
    }
    // In platinum the cannon is dead — only typing + fire moves it.
    if (gamePhase === "platinum") return;
    const canDragFromRay = showSceneActors && isPointOnAimRay(x, y, aimForBeam);
    if (!isPointOnCannon(x, y, revealGaze) && !canDragFromRay) return;
    e.preventDefault();
    if (!hasDiscoveredCannonDrag) setHasDiscoveredCannonDrag(true);
    if (level === 1 && gamePhase === "normal" && !hasSeenFirstFireTutorial) {
      setFirstFireTutorialReady(false);
    }
    lastTickAngleRef.current = -999;
    lastPointerAngleRef.current = null; // reset so first point sets the base
    dragAngleRef.current = gazeAngleRef.current;
    svgRef.current?.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
  }

  // ── Game logic ─────────────────────────────────────────────────────────────
  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1600);
  }

  function showIconFlash(ok: boolean) {
    playFlashDrop(ok);
    setFlash({ text: "", ok, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1200);
  }

  function nextQuestion(targetLevel = level) {
    const q = makeQuestion(targetLevel);
    submitLockRef.current = false;
    setCurrentQ(q);
    setAnswer("");
    setSubAnswers(["", "", ""]);
    setSubStep(0);
    setGazeAngle(q.startAngleDeg ?? 0);
    setIsFiring(null);
    setExplosion(null);
    setSpinAnim(null);
    setPlatinumRevealPending(false);
    lastTickAngleRef.current = -999;
  }

  function fireCannon(hit: boolean, aimAngle: number) {
    playCannonFire();
    setShotT(0);
    setIsFiring({ hit, aimAngle });
  }

  function commitAimAngle(angle: number) {
    lastPointerAngleRef.current = null;
    dragAngleRef.current = angle;
    gazeAngleRef.current = angle;
    setGazeAngle(angle);
  }

  function earnEgg() {
    const newEggs = eggsCollected + 1;
    if (newEggs === LEVEL_TARGET_COUNT) {
      setEggsCollected(LEVEL_TARGET_COUNT);
      window.setTimeout(() => startMonsterRound(), 950);
      return;
    }
    setEggsCollected(newEggs);
    shuffleMusic();
    showIconFlash(true);
    window.setTimeout(() => nextQuestion(level), 950);
  }

  function earnMonsterEgg() {
    const newGolden = monsterEggs + 1;
    if (newGolden === LEVEL_TARGET_COUNT) {
      setMonsterEggs(LEVEL_TARGET_COUNT);
      window.setTimeout(() => startPlatinumRound(), 950);
      return;
    }
    setMonsterEggs(newGolden);
    playGoldenEgg();
    switchToMonsterMusic();
    showIconFlash(true);
    window.setTimeout(() => nextQuestion(level), 950);
  }

  function loseEgg() {
    submitLockRef.current = false;
    playWrong();
    if (gamePhase === "monster" || gamePhase === "platinum") {
      setMonsterEggs((e) => Math.max(0, e - 1));
    } else {
      setEggsCollected((e) => Math.max(0, e - 1));
    }
    showIconFlash(false);
    // All phases: retry same question — leave cannon angle and answer intact
    setIsFiring(null);
    setSpinAnim(null);
    setExplosion(null);
  }

  earnEggRef.current = earnEgg;
  earnMonsterEggRef.current = earnMonsterEgg;
  earnPlatinumEggRef.current = earnPlatinumEgg;
  loseEggRef.current = loseEgg;

  function startMonsterRound() {
    const name =
      MONSTER_ROUND_NAMES[
        Math.floor(Math.random() * MONSTER_ROUND_NAMES.length)
      ];
    setMonsterRoundName(name);
    setGamePhase("monster");
    setMonsterEggs(0);
    setShowMonsterAnnounce(true);
    playMonsterStart();
    switchToMonsterMusic();
    nextQuestion(level);
    window.setTimeout(() => setShowMonsterAnnounce(false), ROUND_ANNOUNCE_MS);
    setCalcRoundKey((k) => k + 1);
  }

  function startPlatinumRound() {
    const name =
      PLATINUM_ROUND_NAMES[
        Math.floor(Math.random() * PLATINUM_ROUND_NAMES.length)
      ];
    setMonsterRoundName(name);
    setGamePhase("platinum");
    setMonsterEggs(0);
    setShowMonsterAnnounce(true);
    playMonsterStart();
    switchToMonsterMusic();
    nextQuestion(level);
    window.setTimeout(() => setShowMonsterAnnounce(false), ROUND_ANNOUNCE_MS);
    setCalcRoundKey((k) => k + 1);
  }

  function earnPlatinumEgg() {
    const newPlat = monsterEggs + 1;
    if (newPlat === LEVEL_TARGET_COUNT) {
      setMonsterEggs(LEVEL_TARGET_COUNT);
      if (level === 2) {
        playGameComplete();
        setScreen("gameover");
      } else {
        playMonsterVictory();
        if (!IS_DEV) setUnlockedLevel(() => 2);
        setScreen("won");
      }
      return;
    }
    setMonsterEggs(newPlat);
    playGoldenEgg();
    showIconFlash(true);
    window.setTimeout(() => nextQuestion(level), 950);
  }

  function beginNewRun(targetLevel?: 1 | 2) {
    playButton();
    shuffleMusic();
    const lv = targetLevel ?? level;
    submitLockRef.current = false;
    if (targetLevel) setLevel(targetLevel);
    const firstQ = makeQuestion(lv);
    setScreen("playing");
    setCurrentQ(firstQ);
    setEggsCollected(0);
    setMonsterEggs(0);
    setGamePhase("normal");
    setFlash(null);
    setDragging(false);
    setHasSeenFirstFireTutorial(false);
    setFirstFireTutorialReady(false);
    setAnswer("");
    setSubAnswers(["", "", ""]);
    setSubStep(0);
    setRevealedAngle(null);
    setGazeAngle(firstQ.startAngleDeg ?? 0);
    setIsFiring(null);
    setExplosion(null);
    setSpinAnim(null);
    setPlatinumRevealPending(false);
    lastTickAngleRef.current = -999;
    setCalcRoundKey((k) => k + 1);
  }

  function resetCurrentQuestion() {
    playButton();
    submitLockRef.current = false;
    setFlash(null);
    setDragging(false);
    draggingRef.current = false;
    setFirstFireTutorialReady(false);
    setAnswer("");
    setSubAnswers(["", "", ""]);
    setSubStep(0);
    setGazeAngle(currentQRef.current.startAngleDeg ?? 0);
    setIsFiring(null);
    setExplosion(null);
    setSpinAnim(null);
    setPlatinumRevealPending(false);
    setIntroKey((k) => k + 1); // re-triggers intro animation for same question
  }

  function devSetEggs(i: number) {
    if (!IS_DEV) return;
    const target = i + 1;
    if (gamePhase === "monster") {
      if (target === LEVEL_TARGET_COUNT) earnMonsterEgg();
      else setMonsterEggs(target);
    } else if (gamePhase === "platinum") {
      if (target === LEVEL_TARGET_COUNT) earnPlatinumEgg();
      else setMonsterEggs(target);
    } else {
      if (target === LEVEL_TARGET_COUNT) {
        setEggsCollected(LEVEL_TARGET_COUNT);
        startMonsterRound();
      } else {
        setEggsCollected(target);
        nextQuestion();
      }
    }
  }

  function handleKeypadChange(v: string) {
    const parsed = parseFloat(v);
    const hasLockedTypedAngle = !isNaN(parsed) && Math.abs(parsed) > 0;
    if (
      level === 1 &&
      gamePhase !== "normal" &&
      typedAimTutorialStage !== "done"
    ) {
      setTypedAimTutorialStage(hasLockedTypedAngle ? "fire" : "type");
    }
    if (currentQ.promptLines) {
      setSubAnswers((prev) => {
        const next = [...prev] as [string, string, string];
        next[subStep] = v;
        return next;
      });
      return;
    }
    setAnswer(v);
    if (!sceneBusy && gamePhase !== "platinum") {
      if (v === "" || v === "-" || v === "." || v === "-.") {
        setGazeAngle(currentQ.startAngleDeg ?? 0);
        return;
      }
      const num = parseFloat(v);
      if (!isNaN(num)) {
        let clamped = num;
        if (level === 2) {
          const start = currentQ.startAngleDeg ?? 0;
          clamped = Math.min(
            Math.max(start + num, start),
            currentQ.totalContext,
          );
        }
        setGazeAngle(clamped);
      }
    }
  }

  // ── Submit / Fire ──────────────────────────────────────────────────────────
  function doSubmit() {
    if (sceneBusy || submitLockRef.current) return;
    if (level === 1 && gamePhase === "normal" && !hasSeenFirstFireTutorial) {
      setHasSeenFirstFireTutorial(true);
      setFirstFireTutorialReady(false);
    }
    if (
      level === 1 &&
      gamePhase !== "normal" &&
      typedAimTutorialStage === "fire"
    ) {
      setTypedAimTutorialStage("done");
    }

    // Monster round single-step: typed value must be exact
    if (isMonster && !currentQ.promptLines) {
      playButton();
      const typed = parseFloat(answer.trim());
      if (isNaN(typed)) return;
      const correct = angleDiffDeg(typed, currentQ.answer) < TYPED_TOL;
      const typedAim =
        level === 2
          ? Math.min(
              Math.max(
                (currentQ.startAngleDeg ?? 0) + typed,
                currentQ.startAngleDeg ?? 0,
              ),
              currentQ.totalContext,
            )
          : typed;
      commitAimAngle(typedAim);
      submitLockRef.current = true;
      fireCannon(correct, typedAim);
      return;
    }

    // Platinum round: cannon rotates to typed value then fires (blind shot)
    if (gamePhase === "platinum" && !currentQ.promptLines) {
      const typedAngle = parseFloat(answer.trim());
      if (isNaN(typedAngle)) return;
      playButton();
      const spinTarget =
        level === 2
          ? Math.min(
              Math.max(
                (currentQ.startAngleDeg ?? 0) + typedAngle,
                currentQ.startAngleDeg ?? 0,
              ),
              currentQ.totalContext,
            )
          : typedAngle;
      submitLockRef.current = true;
      setPlatinumActorsVisible(true);
      setPlatinumRevealPending(true);
      platinumRevealTimerRef.current = window.setTimeout(() => {
        setPlatinumRevealPending(false);
        setSpinAnim({
          from: gazeAngleRef.current,
          to: spinTarget,
          startT: performance.now(),
        });
        platinumRevealTimerRef.current = null;
      }, PLATINUM_REVEAL_MS);
      return;
    }

    playButton();

    if (currentQ.promptLines && currentQ.subAnswers) {
      // L3 multi-step
      const g = parseFloat(subAnswers[subStep]);
      if (isNaN(g)) {
        showFlash(texts.generic.feedback.enterNumber, false);
        return;
      }
      const ok = Math.abs(g - currentQ.subAnswers[subStep]) < 0.6;
      if (subStep < 2) {
        if (ok) {
          setSubStep((s) => s + 1);
        } else {
          playWrong();
          showFlash(texts.generic.feedback.tryAgain, false);
          setSubAnswers((prev) => {
            const next = [...prev] as [string, string, string];
            next[subStep] = "";
            return next;
          });
        }
        return;
      }
      // Final step — fire!
      submitLockRef.current = true;
      fireCannon(ok, ok ? currentQ.hiddenAngleDeg : gazeAngle);
      return;
    }

    // L1 / L2 single step
    const trimmed = answer.trim();
    if (trimmed === "") {
      const correct =
        angleDiffDeg(gazeAngle, currentQ.hiddenAngleDeg) < ANGLE_HIT_TOL;
      submitLockRef.current = true;
      fireCannon(correct, gazeAngle);
    } else {
      const guess = parseFloat(trimmed);
      if (isNaN(guess)) return;
      const correct = angleDiffDeg(guess, currentQ.answer) < TYPED_TOL;
      const guessAim =
        level === 2
          ? Math.min(
              Math.max(
                (currentQ.startAngleDeg ?? 0) + guess,
                currentQ.startAngleDeg ?? 0,
              ),
              currentQ.totalContext,
            )
          : guess;
      commitAimAngle(guessAim);
      submitLockRef.current = true;
      fireCannon(correct, guessAim);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const phaseBg = LEVEL_BG[`${level}-${gamePhase}`] ?? {
    bg: "#080e1c",
    glow: "#1e3a5f",
    tint: "transparent",
  };
  const isMonster = gamePhase === "monster";
  const isPlatinum = gamePhase === "platinum";
  const showSceneActors =
    !isPlatinum ||
    level === 1 ||
    platinumActorsVisible ||
    spinAnim !== null ||
    isFiring !== null ||
    explosion !== null ||
    revealedAngle !== null;

  const revealGaze = revealedAngle ?? gazeAngle;
  const aimForBeam = isFiring ? isFiring.aimAngle : revealGaze;
  const targetRadius = TARGET_DISTANCE;
  const fh = polarToXY(CX, CY, currentQ.hiddenAngleDeg, targetRadius);
  const unclampedTargetX = CX + (fh.x - CX) * deployT;
  const unclampedTargetY = CY + (fh.y - CY) * deployT;
  const targetCenterInset = TARGET_SPRITE_RADIUS + TARGET_EDGE_MARGIN;
  const targetX = Math.min(
    Math.max(unclampedTargetX, targetCenterInset),
    W - targetCenterInset,
  );
  const targetY = Math.min(
    Math.max(unclampedTargetY, targetCenterInset),
    H - targetCenterInset,
  );
  const promptText =
    isPlatinum && !showSceneActors && level === 2
      ? texts.levels["2"].prompts.blindShot
      : getInstructionPrompt(level, gamePhase);
  const displayPrompt = panelVisible
    ? promptText.slice(0, Math.max(typeIdx, 1))
    : promptText.slice(0, 1);
  const hideFirstPromptChar = !currentQ.promptLines && typeIdx === 0;
  const showDevAnswer =
    IS_DEV &&
    panelVisible &&
    (currentQ.promptLines ? true : typeIdx >= promptText.length);
  const baseAngle = level === 2 ? (currentQ.startAngleDeg ?? 0) : 0;
  const activeArcRadius =
    level === 2 ? (getMissingSectorRadius(currentQ) ?? 52) : 52;
  const arcSweep = (revealedAngle ?? aimForBeam) - baseAngle;
  const hasStartedL2Interaction =
    level === 2 &&
    (dragging ||
      answer.trim() !== "" ||
      Math.abs(gazeAngle - baseAngle) > 0.5 ||
      isFiring !== null ||
      spinAnim !== null);

  const parsedAnswer = parseFloat(answer.trim());
  const showCannonDragHint =
    level === 1 &&
    tutorialHintVisible &&
    !hasDiscoveredCannonDrag &&
    !showMonsterAnnounce &&
    gamePhase === "normal" &&
    introPhase === "ready" &&
    !sceneBusy;
  const showKeypadTypeHint =
    level === 1 &&
    typedAimTutorialStage === "type" &&
    !showMonsterAnnounce &&
    gamePhase !== "normal" &&
    introPhase === "ready" &&
    !sceneBusy;
  // isAiming: cannon is actively pointed somewhere (dragging, firing, spinAnim, or valid number typed)
  const isAiming =
    showSceneActors &&
    (dragging ||
      isFiring !== null ||
      spinAnim !== null ||
      (!isPlatinum && answer.trim() !== "" && !isNaN(parsedAnswer)));
  const showCoordAxes =
    level === 1 &&
    showSceneActors &&
    introPhase === "ready" &&
    (dragging || Math.abs(arcSweep) >= 0.5);
  const showAngleOverlay =
    isAiming &&
    introPhase === "ready" &&
    Math.abs(arcSweep) >= 0.5 &&
    ((!isMonster && !isPlatinum) || revealedAngle !== null);

  // Fire only enabled when typed value matches current aim (confirms the user has read the angle)
  const canFire =
    !sceneBusy &&
    !currentQ.promptLines &&
    answer.trim() !== "" &&
    !isNaN(parsedAnswer);
  canFireRef.current = canFire;
  const keypadValue = currentQ.promptLines ? subAnswers[subStep] : answer;
  const canKeypadFire = currentQ.promptLines
    ? !sceneBusy && !isNaN(parseFloat(subAnswers[subStep]))
    : canFire;
  const showFirstRoundFireHint =
    level === 1 &&
    gamePhase === "normal" &&
    !showMonsterAnnounce &&
    introPhase === "ready" &&
    !sceneBusy &&
    canKeypadFire &&
    hasDiscoveredCannonDrag &&
    firstFireTutorialReady &&
    !hasSeenFirstFireTutorial;
  const showFireHint = showFirstRoundFireHint;
  keypadValueRef.current = keypadValue;
  handleKeypadChangeRef.current = handleKeypadChange;
  doSubmitRef.current = doSubmit;

  return (
    <div
      className="flex flex-col landscape:flex-row h-svh w-screen overflow-hidden font-arcade relative"
      style={{
        background: `radial-gradient(ellipse at top, ${phaseBg.glow} 0%, ${phaseBg.bg} 72%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 arcade-grid opacity-20" />
      {(isMonster || isPlatinum) && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: phaseBg.tint }}
        />
      )}

      {/* ── Portrait: Top bar (hidden in landscape) ── */}
      <div className="shrink-0 z-20 flex items-start gap-2 px-2 py-1.5 landscape:hidden">
        {/* Centre HUD (flex-1 so it fills space, buttons sit on the right) */}
        <div
          className="flex-1 flex flex-col items-center gap-1"
          style={{ marginLeft: "calc(0.5rem + 4px)", marginTop: "4px" }}
        >
          <div className="grid grid-cols-5 gap-1.5 justify-items-center">
            {([1, 2] as const).map((lv) => {
              const locked = !IS_DEV && lv > unlockedLevel && lv > level;
              return (
                <button
                  key={lv}
                  onClick={() => !locked && beginNewRun(lv)}
                  disabled={locked}
                  className="w-9 h-9 rounded text-sm font-black border-2 transition-colors"
                  style={{
                    background: locked
                      ? "#0f172a"
                      : level === lv
                        ? isMonster
                          ? "#92400e"
                          : "#0ea5e9"
                        : lv < level
                          ? "#78350f"
                          : "#1e293b",
                    borderColor: locked
                      ? "#1e293b"
                      : level === lv
                        ? isMonster
                          ? "#fbbf24"
                          : "#38bdf8"
                        : lv < level
                          ? "#fbbf24"
                          : "#475569",
                    color: locked
                      ? "#334155"
                      : level === lv
                        ? isMonster
                          ? "#fde047"
                          : "white"
                        : lv < level
                          ? "#fde047"
                          : "#64748b",
                    boxShadow:
                      lv < level ? "0 0 8px rgba(251,191,36,0.45)" : undefined,
                    cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  {locked ? "🔒" : lv}
                </button>
              );
            })}
          </div>

          {(isMonster || isPlatinum) && (
            <div
              className="text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={
                isPlatinum
                  ? {
                      background:
                        "linear-gradient(135deg, rgba(71,85,105,0.85) 0%, rgba(100,116,139,0.9) 50%, rgba(71,85,105,0.85) 100%)",
                      color: "#e2e8f0",
                      border: "2px solid #94a3b8",
                      boxShadow:
                        "0 0 12px rgba(148,163,184,0.6), 0 0 28px rgba(148,163,184,0.3)",
                      textShadow: "0 0 10px rgba(226,232,240,0.9)",
                      animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                    }
                  : {
                      background:
                        "linear-gradient(135deg, rgba(161,122,6,0.85) 0%, rgba(202,138,4,0.9) 50%, rgba(161,122,6,0.85) 100%)",
                      color: "#fef08a",
                      border: "2px solid #fbbf24",
                      boxShadow:
                        "0 0 12px rgba(251,191,36,0.6), 0 0 28px rgba(234,179,8,0.35)",
                      textShadow: "0 0 10px rgba(250,204,21,0.9)",
                      animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                    }
              }
            >
              {isPlatinum
                ? texts.rounds.platinum.badgeIcon
                : texts.rounds.monster.badgeIcon}{" "}
              {monsterRoundName}{" "}
              {isPlatinum
                ? texts.rounds.platinum.badgeIcon
                : texts.rounds.monster.badgeIcon}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {Array.from({ length: LEVEL_TARGET_COUNT }, (_, i) => i).map(
              (i) => {
                const collected =
                  isMonster || isPlatinum ? i < monsterEggs : i < eggsCollected;
                const isTarget =
                  IS_DEV &&
                  i === (isMonster || isPlatinum ? monsterEggs : eggsCollected);
                return (
                  <span
                    key={i}
                    onClick={IS_DEV ? () => devSetEggs(i) : undefined}
                    style={{
                      display: "inline-flex",
                      cursor: IS_DEV ? "pointer" : "default",
                    }}
                  >
                    <ProgressIcon
                      collected={collected}
                      gamePhase={gamePhase}
                      preview={isTarget && !collected}
                    />
                  </span>
                );
              },
            )}
          </div>
        </div>

        {/* Right buttons */}
        <div
          className="flex flex-row gap-1.5 shrink-0"
          style={{ marginTop: "6px" }}
        >
          <button
            onClick={resetCurrentQuestion}
            title={texts.generic.buttons.reset}
            className="arcade-button w-10 h-10 flex items-center justify-center p-2"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <path
                d="M1 4v6h6"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M23 20v-6h-6"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={handleAudioToggle}
            title={texts.generic.buttons.mute}
            className="arcade-button w-10 h-10 flex items-center justify-center p-2"
            style={
              soundMuted
                ? {
                    background: "linear-gradient(180deg,#475569,#334155)",
                    boxShadow: "0 5px 0 #1e293b",
                    borderColor: "#94a3b8",
                  }
                : {}
            }
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              {soundMuted ? (
                <>
                  <polygon
                    points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                    fill="white"
                  />
                  <line
                    x1="23"
                    y1="9"
                    x2="17"
                    y2="15"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="17"
                    y1="9"
                    x2="23"
                    y2="15"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <>
                  <polygon
                    points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                    fill="white"
                  />
                  <path
                    d="M15.54 8.46a5 5 0 0 1 0 7.07"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19.07 4.93a10 10 0 0 1 0 14.14"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ── Middle: SVG + landscape sidebar ── */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-row">
        {/* SVG scene */}
        <div className="relative flex-1 min-h-0 min-w-0 z-10 flex flex-col">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="flex-1 min-h-0 w-full touch-none select-none"
            onPointerDown={startDrag}
            style={{ cursor: dragging ? "grabbing" : "crosshair" }}
          >
            {/* Level-specific terrain */}
            {level === 1 && <L1Scene />}
            {level === 2 && (
              <L2Scene
                question={currentQ}
                showMissingMarker={!hasStartedL2Interaction}
                focusMissingAngle={
                  dragging || isFiring !== null || spinAnim !== null
                }
              />
            )}

            {/* Coordinate axes — L1 only */}
            {showCoordAxes && <CoordAxes />}

            {/* Known angle markers */}
            {currentQ.knownEggs.map((egg, i) => {
              const p = polarToXY(CX, CY, egg.angleDeg, EGG_RADIUS);
              return <KnownMarker key={i} x={p.x} y={p.y} label={egg.label} />;
            })}
            {/* Target crosshair — above banner, below beam */}
            {showSceneActors &&
              !(isFiring?.hit && shotT > 0.88) &&
              !explosion &&
              revealedAngle === null && (
                <g transform={`translate(${targetX}, ${targetY})`}>
                  <TargetSprite
                    pulse={
                      introPhase === "ready" &&
                      revealedAngle === null &&
                      !isFiring
                    }
                  />
                </g>
              )}

            {/* Projectile tracer */}
            {isFiring && (
              <ProjectileTracer
                aimAngle={isFiring.aimAngle}
                t={shotT}
                hit={isFiring.hit}
                targetRadius={targetRadius}
              />
            )}

            {/* Explosion */}
            {explosion && <ExplosionAt x={explosion.x} y={explosion.y} />}

            {/* First fire tutorial cue at the ray endpoint */}
            {showFireHint && canKeypadFire && !isFiring && !explosion && (
              <FireRayHint aimAngle={aimForBeam} />
            )}

            {/* Aim beam — always visible as part of the cannon */}
            {showSceneActors && (
              <GazeBeamDrag
                gazeAngle={aimForBeam}
                level={level}
                baseAngle={baseAngle}
                arcRadiusOverride={activeArcRadius}
              />
            )}
            {showCannonDragHint && level === 1 && (
              <GazeBeamDrag
                gazeAngle={tutorialAngle}
                level={level}
                baseAngle={0}
                dottedRay
              />
            )}

            {/* Cannon */}
            {showSceneActors && (
              <g transform={`translate(${CX}, ${CY})`}>
                <CannonSprite aimAngle={revealGaze} dragging={dragging} />
              </g>
            )}

            {showSceneActors && showCannonDragHint && (
              <CannonDragHint
                startAngle={0}
                hintAngle={tutorialAngle}
                isTouchInput={isTouchInput}
                isMobile={isCompactViewport}
              />
            )}

            {/* Show angle measure whenever the visible arc has a non-zero sweep */}
            {showAngleOverlay && (
              <LiveAngleLabel
                gazeAngle={aimForBeam}
                revealed={revealedAngle !== null}
                answerDeg={revealedAngle ?? currentQ.answer}
                baseAngle={baseAngle}
              />
            )}
          </svg>

          {isAiming &&
            level === 1 &&
            !isMonster &&
            !isPlatinum &&
            Math.abs(gazeAngle) > 0.5 && (
              <AngleTypeLabel gazeAngle={gazeAngle} />
            )}

          {level === 2 && !isMonster && !isPlatinum && currentQ.setKind && (
            <SetTypeLabel label={currentQ.setKind} />
          )}

          {isMobileLandscape &&
            (Boolean(currentQ.promptLines && currentQ.subAnswers) ||
              !currentQ.promptLines ||
              showDevAnswer) && (
              <div
                className="shrink-0 z-20 py-2"
                style={{
                  background: "rgba(2,6,23,0.7)",
                  borderTop: "1px solid rgba(56,189,248,0.12)",
                  minHeight: "3rem",
                  paddingLeft: "7rem",
                  paddingRight: "0.75rem",
                }}
              >
                {currentQ.promptLines && currentQ.subAnswers ? (
                  <div className="arcade-panel flex flex-col gap-1 px-2 py-1.5 text-[10px]">
                    {panelVisible &&
                      currentQ.promptLines.map((line, i) => {
                        const isDone = i < subStep;
                        const isCurrent = i === subStep;
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-1 transition-opacity ${i > subStep ? "opacity-30" : ""}`}
                          >
                            <ColoredPrompt
                              text={line}
                              className={`flex-1 leading-4 font-bold ${i === 2 ? "text-white" : "text-slate-300"}`}
                            />
                            <span className="text-slate-400">=</span>
                            {isDone ? (
                              <span className="text-green-400 font-bold w-8 text-right">
                                {subAnswers[i]}°
                              </span>
                            ) : isCurrent ? (
                              <span className="text-yellow-300 font-bold w-8 text-right">
                                {subAnswers[i] || "?"}
                              </span>
                            ) : (
                              <span className="w-8" />
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="arcade-panel min-h-[3rem] px-3 py-2 text-sm leading-5 text-white font-bold">
                    <ColoredPrompt
                      text={displayPrompt}
                      hideFirstChar={hideFirstPromptChar}
                    />
                  </div>
                )}
                {showDevAnswer && (
                  <div className="arcade-panel mt-1 px-2 py-1 text-[10px] font-black text-yellow-300">
                    {texts.generic.devAnswerPrefix} {currentQ.answer}°
                  </div>
                )}
              </div>
            )}
        </div>

        {/* ── Landscape sidebar: controls + keypad (hidden in portrait) ── */}
        <div
          className="hidden landscape:flex flex-col shrink-0 w-48 z-20"
          style={{
            borderLeft: "1px solid rgba(56,189,248,0.12)",
            background: "rgba(2,6,23,0.5)",
          }}
        >
          {/* Buttons + level select */}
          <div className="shrink-0 flex flex-wrap items-center gap-1.5 px-2 py-1.5">
            <div className="flex flex-row gap-1.5">
              <button
                onClick={resetCurrentQuestion}
                title={texts.generic.buttons.reset}
                className="arcade-button w-10 h-10 flex items-center justify-center p-2"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path
                    d="M1 4v6h6"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M23 20v-6h-6"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={handleAudioToggle}
                title={texts.generic.buttons.mute}
                className="arcade-button w-10 h-10 flex items-center justify-center p-2"
                style={
                  soundMuted
                    ? {
                        background: "linear-gradient(180deg,#475569,#334155)",
                        borderColor: "#94a3b8",
                      }
                    : {}
                }
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  {soundMuted ? (
                    <>
                      <polygon
                        points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                        fill="white"
                      />
                      <line
                        x1="23"
                        y1="9"
                        x2="17"
                        y2="15"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <line
                        x1="17"
                        y1="9"
                        x2="23"
                        y2="15"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </>
                  ) : (
                    <>
                      <polygon
                        points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                        fill="white"
                      />
                      <path
                        d="M15.54 8.46a5 5 0 0 1 0 7.07"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M19.07 4.93a10 10 0 0 1 0 14.14"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-1">
              {([1, 2] as const).map((lv) => {
                const locked = !IS_DEV && lv > unlockedLevel && lv > level;
                return (
                  <button
                    key={lv}
                    onClick={() => !locked && beginNewRun(lv)}
                    disabled={locked}
                    className="w-9 h-9 rounded text-sm font-black border-2 transition-colors"
                    style={{
                      background: locked
                        ? "#0f172a"
                        : level === lv
                          ? isMonster
                            ? "#92400e"
                            : "#0ea5e9"
                          : lv < level
                            ? "#78350f"
                            : "#1e293b",
                      borderColor: locked
                        ? "#1e293b"
                        : level === lv
                          ? isMonster
                            ? "#fbbf24"
                            : "#38bdf8"
                          : lv < level
                            ? "#fbbf24"
                            : "#475569",
                      color: locked
                        ? "#334155"
                        : level === lv
                          ? isMonster
                            ? "#fde047"
                            : "white"
                          : lv < level
                            ? "#fde047"
                            : "#64748b",
                      cursor: locked ? "not-allowed" : "pointer",
                      opacity: locked ? 0.5 : 1,
                    }}
                  >
                    {locked ? "🔒" : lv}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stars */}
          <div className="shrink-0 grid grid-cols-5 gap-1 justify-center justify-items-center pb-1">
            {Array.from({ length: LEVEL_TARGET_COUNT }, (_, i) => i).map(
              (i) => {
                const collected =
                  isMonster || isPlatinum ? i < monsterEggs : i < eggsCollected;
                const isTarget =
                  IS_DEV &&
                  i === (isMonster || isPlatinum ? monsterEggs : eggsCollected);
                return (
                  <span
                    key={i}
                    onClick={IS_DEV ? () => devSetEggs(i) : undefined}
                    style={{
                      display: "inline-flex",
                      cursor: IS_DEV ? "pointer" : "default",
                    }}
                  >
                    <ProgressIcon
                      collected={collected}
                      gamePhase={gamePhase}
                      preview={isTarget && !collected}
                    />
                  </span>
                );
              },
            )}
          </div>

          {!isMobileLandscape && (
            <div className="shrink-0 flex flex-col gap-3 px-1 pt-3 pb-2">
              {currentQ.promptLines && currentQ.subAnswers ? (
                <div className="arcade-panel flex flex-col gap-1 px-2 py-2 text-[10px]">
                  {panelVisible &&
                    currentQ.promptLines.map((line, i) => {
                      const isDone = i < subStep;
                      const isCurrent = i === subStep;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-1 transition-opacity ${i > subStep ? "opacity-30" : ""}`}
                        >
                          <ColoredPrompt
                            text={line}
                            className={`flex-1 leading-4 font-bold ${i === 2 ? "text-white" : "text-slate-300"}`}
                          />
                          <span className="text-slate-400">=</span>
                          {isDone ? (
                            <span className="text-green-400 font-bold w-8 text-right">
                              {subAnswers[i]}°
                            </span>
                          ) : isCurrent ? (
                            <span className="text-yellow-300 font-bold w-8 text-right">
                              {subAnswers[i] || "?"}
                            </span>
                          ) : (
                            <span className="w-8" />
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="arcade-panel min-h-[4.5rem] px-3 py-3 text-sm leading-6 text-white font-bold text-left">
                  <ColoredPrompt
                    text={displayPrompt}
                    hideFirstChar={hideFirstPromptChar}
                  />
                </div>
              )}
              {showDevAnswer && (
                <div className="arcade-panel px-2 py-1 text-[10px] font-black text-yellow-300">
                  {texts.generic.devAnswerPrefix} {currentQ.answer}°
                </div>
              )}
              {(isMonster || isPlatinum) && (
                <div
                  className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded-full text-center"
                  style={
                    isPlatinum
                      ? {
                          background: "rgba(71,85,105,0.85)",
                          color: "#e2e8f0",
                          border: "1px solid #94a3b8",
                        }
                      : {
                          background: "rgba(161,122,6,0.85)",
                          color: "#fef08a",
                          border: "1px solid #fbbf24",
                        }
                  }
                >
                  {isPlatinum
                    ? texts.rounds.platinum.badgeIcon
                    : texts.rounds.monster.badgeIcon}{" "}
                  {monsterRoundName}
                </div>
              )}
            </div>
          )}

          {/* Keypad fills remaining space */}
          <div
            className="mt-auto shrink-0 px-1 relative"
            style={{ paddingBottom: SAFE_AREA_BOTTOM_PAD }}
          >
            <NumericKeypad
              value={keypadValue}
              onChange={handleKeypadChange}
              onFire={doSubmit}
              canFire={canKeypadFire}
              disabled={sceneBusy}
              roundKey={calcRoundKey}
              fullWidth
              inviteGlow={showKeypadTypeHint}
            />
            {showFireHint && canKeypadFire && (
              <FireButtonHint onFire={doSubmit} />
            )}
          </div>
        </div>
      </div>

      {/* ── Portrait: Bottom panel (hidden in landscape) ── */}
      <div
        className="shrink-0 z-50 flex flex-col gap-2 px-2 landscape:hidden"
        style={{ paddingBottom: SAFE_AREA_BOTTOM_PAD }}
      >
        {/* Prompt / question text — left column */}
        <div className="flex-1 min-w-0 self-stretch flex flex-col justify-end">
          <div className="flex flex-col gap-1.5">
            {currentQ.promptLines && currentQ.subAnswers ? (
              /* L3 multi-step */
              <div className="arcade-panel flex flex-col gap-1.5 px-3 py-2 text-xs md:text-sm">
                {currentQ.promptLines.map((line, i) => {
                  const isDone = i < subStep;
                  const isCurrent = i === subStep;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 transition-opacity ${i > subStep ? "opacity-30" : ""}`}
                    >
                      <ColoredPrompt
                        text={line}
                        className={`flex-1 leading-5 font-bold ${i === 2 ? "text-white" : "text-slate-300"}`}
                      />
                      <span className="text-slate-400 text-xs">=</span>
                      {isDone ? (
                        <span className="text-green-400 text-xs font-bold w-10 text-right">
                          {subAnswers[i]}°
                        </span>
                      ) : isCurrent ? (
                        <span className="text-yellow-300 text-xs font-bold w-10 text-right">
                          {subAnswers[i] || "?"}
                        </span>
                      ) : (
                        <span className="w-10" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="arcade-panel min-h-[4.25rem] px-3 py-2 text-xl leading-6 text-white font-bold">
                <ColoredPrompt
                  text={displayPrompt}
                  hideFirstChar={hideFirstPromptChar}
                />
              </div>
            )}
            {showDevAnswer && (
              <div className="arcade-panel px-3 py-1.5 text-xs font-black text-yellow-300">
                {texts.generic.devAnswerPrefix} {currentQ.answer}°
              </div>
            )}
          </div>
        </div>

        {/* Numeric keypad — always visible */}
        <div
          className="relative"
          style={{ paddingTop: "4px", paddingBottom: SAFE_AREA_BOTTOM_PAD }}
        >
          <NumericKeypad
            value={keypadValue}
            onChange={handleKeypadChange}
            onFire={doSubmit}
            canFire={canKeypadFire}
            disabled={sceneBusy}
            fireRef={fireButtonRef}
            roundKey={calcRoundKey}
            fullWidth
            inviteGlow={showKeypadTypeHint}
          />
          {showFireHint && canKeypadFire && (
            <FireButtonHint onFire={doSubmit} />
          )}
        </div>
      </div>

      {/* ── Flash feedback ── */}
      {flash?.icon &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{ left: "16px", top: "16px" }}
          >
            {flash.ok ? (
              <svg
                viewBox="0 0 120 120"
                width="64"
                height="64"
                style={{
                  display: "block",
                  animation:
                    "icon-drop-left 1.15s cubic-bezier(0.22,0.72,0.2,1) forwards",
                  filter:
                    "drop-shadow(0 0 12px #4ade80) drop-shadow(0 0 24px #16a34a)",
                }}
              >
                <circle cx="60" cy="60" r="54" fill="#14532d" />
                <path
                  d="M30 62 L50 82 L90 38"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 120 120"
                width="64"
                height="64"
                style={{
                  display: "block",
                  animation:
                    "icon-drop-left 1.15s cubic-bezier(0.22,0.72,0.2,1) forwards",
                  filter:
                    "drop-shadow(0 0 12px #f87171) drop-shadow(0 0 24px #b91c1c)",
                }}
              >
                <circle cx="60" cy="60" r="54" fill="#7f1d1d" />
                <path
                  d="M38 38 L82 82 M82 38 L38 82"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="13"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>,
          document.body,
        )}
      {flash &&
        (flash.icon ? null : (
          <div
            className={`pointer-events-none absolute left-1/2 top-[30%] z-40 -translate-x-1/2 rounded-xl border-2 px-8 py-4 text-2xl font-black uppercase tracking-widest animate-bounce-in ${flash.ok ? "border-emerald-400 bg-emerald-950/90 text-emerald-300" : "border-pink-400 bg-pink-950/90 text-pink-300"}`}
          >
            {flash.text}
          </div>
        ))}

      {/* ── Monster Round announcement ── */}
      {showMonsterAnnounce && (
        <div
          className="absolute inset-0 z-[70] flex flex-col items-center justify-center"
          style={{
            background: isPlatinum
              ? "radial-gradient(ellipse at center, rgba(30,41,59,0.97) 0%, rgba(5,8,20,0.99) 75%)"
              : "radial-gradient(ellipse at center, rgba(88,28,135,0.95) 0%, rgba(10,2,20,0.98) 75%)",
            animation: `round-announce-fade ${ROUND_ANNOUNCE_MS}ms ease-in-out both`,
          }}
        >
          <div
            className="text-7xl mb-4"
            style={{
              animation: `round-announce-content ${ROUND_ANNOUNCE_MS}ms ease-in-out both`,
            }}
          >
            {isPlatinum
              ? texts.rounds.platinum.announceIcon
              : texts.rounds.monster.announceIcon}
          </div>
          <div
            className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center px-4"
            style={{
              color: isPlatinum ? "#e2e8f0" : "#fde047",
              textShadow: isPlatinum
                ? "0 0 30px rgba(226,232,240,0.6)"
                : "0 0 30px rgba(250,204,21,0.8)",
              animation: `round-announce-content ${ROUND_ANNOUNCE_MS}ms ease-in-out both`,
            }}
          >
            {monsterRoundName}
          </div>
          <div
            className="mt-4 px-6 text-center text-base font-black whitespace-nowrap"
            style={{
              color: isPlatinum ? "#cbd5e1" : "#fef08a",
              animation: `round-announce-content ${ROUND_ANNOUNCE_MS}ms ease-in-out both`,
            }}
          >
            {promptText}
          </div>
        </div>
      )}

      {/* ── Won screen ── */}
      {screen === "won" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-6">
          <div className="arcade-panel p-10 text-center">
            {isMonster || isPlatinum ? (
              <>
                <div
                  className="text-4xl font-black uppercase tracking-[0.18em] md:text-5xl"
                  style={{ color: isPlatinum ? "#e2e8f0" : "#fde047" }}
                >
                  {formatText(
                    texts.levels[String(level) as "1" | "2"].completion
                      .finalTitle,
                    { level },
                  )}
                </div>
                <div
                  className="mt-1 text-lg font-bold"
                  style={{ color: isPlatinum ? "#94a3b8" : "#d8b4fe" }}
                >
                  {isPlatinum
                    ? texts.rounds.platinum.victorySubtitle
                    : texts.rounds.monster.victorySubtitle}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <GoldenTarget key={i} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl font-black uppercase tracking-[0.18em] text-emerald-400 md:text-5xl">
                  {formatText(texts.levels["1"].completion.standardTitle, {
                    level,
                  })}
                </div>
                <div className="mt-2 text-xl text-yellow-300">
                  {texts.levels["1"].completion.standardSubtitle}
                </div>
              </>
            )}
            <div className="mt-8 flex flex-col items-center gap-3">
              {level < 2 && (
                <button
                  onClick={() => beginNewRun(2)}
                  className="arcade-button px-8 py-4 text-base md:text-lg"
                >
                  {texts.generic.buttons.nextLevel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Game over (all 3 levels complete) ── */}
      {screen === "gameover" && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(88,28,135,0.97) 0%, rgba(5,2,18,0.99) 80%)",
          }}
        >
          <div
            className="arcade-panel p-8 md:p-12 text-center mx-6 max-w-lg w-full"
            style={{
              boxShadow:
                "0 0 40px rgba(251,191,36,0.35), 0 0 80px rgba(109,40,217,0.3)",
            }}
          >
            <div className="flex justify-center gap-3 text-4xl mb-4">
              🎯💥🎯
            </div>
            <div
              className="text-3xl md:text-4xl font-black uppercase tracking-widest text-yellow-300"
              style={{ textShadow: "0 0 24px rgba(250,204,21,0.8)" }}
            >
              {texts.generic.completeAllLevels.title}
            </div>
            <div className="mt-2 text-base md:text-lg text-purple-200 font-bold">
              {formatText(texts.generic.completeAllLevels.subtitle, {
                count: 2,
              })}
            </div>
            <div className="flex justify-center gap-2 mt-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <GoldenTarget key={i} />
              ))}
            </div>
            <button
              onClick={() => {
                setUnlockedLevel(1);
                beginNewRun(1);
              }}
              className="arcade-button mt-8 px-10 py-4 text-lg font-black uppercase tracking-wider w-full"
              style={{
                boxShadow: "0 0 16px rgba(251,191,36,0.4), 0 6px 0 #78350f",
                borderColor: "#fbbf24",
              }}
            >
              {texts.generic.buttons.playAgain}
            </button>
          </div>
        </div>
      )}

      {/* ── Share + Comments buttons — bottom-left ── */}
      {isCompactViewport ? (
        <div
          className="absolute z-[60] flex flex-col items-start gap-1.5"
          style={{ bottom: "1rem", left: "1rem" }}
        >
          {IS_LOCALHOST_DEV && (
            <button
              onClick={handleCaptureScene}
              title="Capture scene"
              className="arcade-button w-10 h-10 flex items-center justify-center p-1.5"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                <path
                  d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12.5"
                  r="3.25"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
            </button>
          )}
          <div className="flex flex-row gap-1.5">
            <button
              onClick={handleShare}
              title={texts.generic.buttons.share}
              className="arcade-button w-10 h-10 flex items-center justify-center p-2"
              style={
                showShareDrawer
                  ? {
                      background: "linear-gradient(180deg,#0369a1,#075985)",
                      borderColor: "#38bdf8",
                    }
                  : {}
              }
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                <circle
                  cx="18"
                  cy="5"
                  r="3"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                />
                <circle
                  cx="6"
                  cy="12"
                  r="3"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                />
                <circle
                  cx="18"
                  cy="19"
                  r="3"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                />
                <line
                  x1="8.59"
                  y1="13.51"
                  x2="15.42"
                  y2="17.49"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="15.41"
                  y1="6.51"
                  x2="8.59"
                  y2="10.49"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              onClick={() => {
                setShowCommentsDrawer((s) => !s);
                setShowShareDrawer(false);
              }}
              title={texts.generic.buttons.comments}
              className="arcade-button w-10 h-10 flex items-center justify-center p-2"
              style={
                showCommentsDrawer
                  ? {
                      background: "linear-gradient(180deg,#854d0e,#713f12)",
                      borderColor: "#facc15",
                    }
                  : {}
              }
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="absolute z-[60] flex flex-row gap-1.5"
          style={{ bottom: "1rem", left: "1rem" }}
        >
          <button
            onClick={handleShare}
            title={texts.generic.buttons.share}
            className="arcade-button w-10 h-10 flex items-center justify-center p-2"
            style={
              showShareDrawer
                ? {
                    background: "linear-gradient(180deg,#0369a1,#075985)",
                    borderColor: "#38bdf8",
                  }
                : {}
            }
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <circle
                cx="18"
                cy="5"
                r="3"
                fill="none"
                stroke="white"
                strokeWidth="2"
              />
              <circle
                cx="6"
                cy="12"
                r="3"
                fill="none"
                stroke="white"
                strokeWidth="2"
              />
              <circle
                cx="18"
                cy="19"
                r="3"
                fill="none"
                stroke="white"
                strokeWidth="2"
              />
              <line
                x1="8.59"
                y1="13.51"
                x2="15.42"
                y2="17.49"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="15.41"
                y1="6.51"
                x2="8.59"
                y2="10.49"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            onClick={() => {
              setShowCommentsDrawer((s) => !s);
              setShowShareDrawer(false);
            }}
            title={texts.generic.buttons.comments}
            className="arcade-button w-10 h-10 flex items-center justify-center p-2"
            style={
              showCommentsDrawer
                ? {
                    background: "linear-gradient(180deg,#854d0e,#713f12)",
                    borderColor: "#facc15",
                  }
                : {}
            }
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {IS_LOCALHOST_DEV && (
            <button
              onClick={handleCaptureScene}
              title="Capture scene"
              className="arcade-button w-10 h-10 flex items-center justify-center p-1.5"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                <path
                  d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12.5"
                  r="3.25"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── Backdrop — closes whichever drawer is open ── */}
      {(showShareDrawer || showCommentsDrawer) && (
        <div
          className="fixed inset-0 z-[2147483646]"
          onClick={() => {
            setShowShareDrawer(false);
            setShowCommentsDrawer(false);
          }}
        />
      )}

      {/* ── Share drawer ── */}
      <div
        className="fixed z-[2147483646]"
        style={{
          left: "1rem",
          bottom: "1rem",
          transform: showShareDrawer
            ? "translateY(0)"
            : "translateY(calc(100% + 1rem))",
          transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
          background: "rgba(2,6,23,0.97)",
          border: "3px solid rgba(56,189,248,0.4)",
          borderRadius: "16px",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
          width: "fit-content",
          maxWidth: "calc(100vw - 2rem)",
        }}
      >
        <div
          className="flex items-center justify-between gap-4 px-4 py-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-sm font-black uppercase tracking-widest text-cyan-300">
            {texts.generic.drawers.shareHeading}
          </div>
          <button
            onClick={() => setShowShareDrawer(false)}
            style={{
              color: "#94a3b8",
              fontSize: "1.75rem",
              lineHeight: 1,
              fontWeight: 900,
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>
        <SocialShare />
      </div>

      {/* ── Comments drawer ── */}
      <div
        className="fixed bottom-0 z-[2147483647] overflow-y-auto"
        style={{
          left: isMobileLandscape || isCompactViewport ? "0" : "1rem",
          right: isMobileLandscape || isCompactViewport ? "0" : "1rem",
          width:
            isMobileLandscape || isCompactViewport
              ? "100vw"
              : "calc(100vw - 2rem)",
          minWidth:
            isMobileLandscape || isCompactViewport
              ? "100vw"
              : "calc(100vw - 2rem)",
          height: isMobileLandscape || isCompactViewport ? "100dvh" : "70vh",
          minHeight: isMobileLandscape || isCompactViewport ? "100dvh" : "70vh",
          maxWidth:
            isMobileLandscape || isCompactViewport
              ? "100vw"
              : "calc(100vw - 2rem)",
          maxHeight: isMobileLandscape || isCompactViewport ? "100dvh" : "70vh",
          display: "flex",
          flexDirection: "column",
          transform: showCommentsDrawer ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
          background: "#171717",
          borderTop: "3px solid rgba(250,204,21,0.4)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="sticky top-0 px-4 py-3"
          style={{
            background: "#171717",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <div>
            <button
              onClick={openCommentsComposer}
              style={{
                border: "1px solid rgba(250, 204, 21, 0.7)",
                borderRadius: "999px",
                background: "#facc15",
                color: "#111111",
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                padding: "0.55rem 0.95rem",
                fontSize: "0.76rem",
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Add Comment
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCommentsDrawer(false)}
              style={{
                width: "2.2rem",
                height: "2.2rem",
                borderRadius: "999px",
                border: "0",
                background: "transparent",
                color: "#fde047",
                fontSize: "1.75rem",
                lineHeight: 1,
                fontWeight: 900,
                padding: "0",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, width: "100%", minWidth: 0 }}>
          <SocialComments />
        </div>
      </div>
    </div>
  );
}
