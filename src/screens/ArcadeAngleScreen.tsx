import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeQuestion,
  makeMonsterL3Question,
  type AngleQuestion,
} from "../game/angles";
import {
  startMusic,
  shuffleMusic,
  switchToMonsterMusic,
  toggleMute,
  isMuted,
  playButton,
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
} from "../sound";
import { polarToXY, arcPath, pointerToAngle } from "../geometry";

// ─── Constants ────────────────────────────────────────────────────────────────

const IS_DEV = import.meta.env.DEV;

const MONSTER_ROUND_NAMES = [
  "BARRAGE MODE",
  "TITAN FUSILLADE",
  "SHOCK AND AWE",
  "ARTILLERY STORM",
  "BLACKOUT ROUND",
  "THUNDER VOLLEY",
];

const PLATINUM_ROUND_NAMES = [
  "PLATINUM STRIKE",
  "SILVER BULLET",
  "PRECISION SHOT",
  "DEAD EYE",
  "SNIPER ELITE",
  "ONE SHOT ONE KILL",
];

const LEVEL_BG: Record<string, { bg: string; glow: string; tint: string }> = {
  "1-normal":   { bg: "#080e1c", glow: "#1e3a5f", tint: "transparent" },
  "1-monster":  { bg: "#0f0520", glow: "#5b21b6", tint: "rgba(109,40,217,0.08)" },
  "1-platinum": { bg: "#080b14", glow: "#94a3b8", tint: "rgba(148,163,184,0.07)" },
  "2-normal":   { bg: "#071510", glow: "#14532d", tint: "transparent" },
  "2-monster":  { bg: "#180a00", glow: "#92400e", tint: "rgba(234,88,12,0.1)" },
  "2-platinum": { bg: "#0a0c14", glow: "#94a3b8", tint: "rgba(148,163,184,0.07)" },
  "3-normal":   { bg: "#07161a", glow: "#134e4a", tint: "transparent" },
  "3-monster":  { bg: "#1a0508", glow: "#7f1d1d", tint: "rgba(220,38,38,0.1)" },
  "3-platinum": { bg: "#090c16", glow: "#94a3b8", tint: "rgba(148,163,184,0.07)" },
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
const L1_TARGET_RADIUS = 100;
const ANGLE_HIT_TOL = 7.5;
const TICK_INTERVAL = 10;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function angleDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function getAngleType(deg: number): { label: string; color: string } {
  const a = Math.abs(deg) % 360;
  if (a < 0.5)                    return { label: "ZERO",          color: "#64748b" };
  if (Math.abs(a - 90) < 2)       return { label: "RIGHT ANGLE",   color: "#22c55e" };
  if (Math.abs(a - 180) < 2)      return { label: "STRAIGHT",      color: "#a78bfa" };
  if (a > 180)                    return { label: "REFLEX",         color: "#f97316" };
  if (a < 90)                     return { label: "ACUTE",          color: "#38bdf8" };
  return                                 { label: "OBTUSE",         color: "#c084fc" };
}

function toSVGPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const r = pt.matrixTransform(ctm.inverse());
  return { x: r.x, y: r.y };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Retro arcade cannon centred at origin. Barrel rotates with aimAngle. */
function CannonSprite({ aimAngle, dragging }: { aimAngle: number; dragging: boolean }) {
  const barrelRot = -aimAngle; // math CCW → SVG CW
  return (
    <g>
      {/* Shadow */}
      <ellipse cx={0} cy={17} rx={28} ry={7} fill="rgba(0,0,0,0.45)" />
      {/* Wheels */}
      {([-14, 14] as const).map((wx, i) => (
        <g key={i}>
          <circle cx={wx} cy={13} r={10} fill="#052e16" stroke="#15803d" strokeWidth={2.5} />
          <circle cx={wx} cy={13} r={4} fill="#14532d" />
          <line x1={wx} y1={3} x2={wx} y2={23} stroke="#166534" strokeWidth={1.5} />
          <line x1={wx - 10} y1={13} x2={wx + 10} y2={13} stroke="#166534" strokeWidth={1.5} />
        </g>
      ))}
      {/* Body */}
      <rect x={-20} y={-8} width={40} height={20} rx={5}
        fill="#052e16" stroke="#16a34a" strokeWidth={2} />
      {/* Barrel (rotates) */}
      <g transform={`rotate(${barrelRot})`}>
        <rect x={2} y={-7} width={48} height={14} rx={4}
          fill="#052e16" stroke="#4ade80" strokeWidth={2}
          style={dragging ? { filter: "drop-shadow(0 0 7px #4ade80)" } : undefined} />
        {/* Muzzle ring */}
        <rect x={46} y={-8} width={10} height={16} rx={3}
          fill="#052e16" stroke="#4ade80" strokeWidth={2} />
      </g>
      {/* Pivot hub */}
      <circle cx={0} cy={0} r={7} fill="#14532d" stroke="#22c55e" strokeWidth={1.5} />
      <circle cx={0} cy={0} r={3} fill="#86efac" />
      {/* Aim halo while dragging */}
      {dragging && (
        <>
          <circle cx={0} cy={0} r={36} fill="none" stroke="#4ade80" strokeWidth={1.5} opacity={0.3} />
          <circle cx={0} cy={0} r={36} fill="none" stroke="#4ade80" strokeWidth={0.8}
            style={{ filter: "drop-shadow(0 0 5px #4ade80) drop-shadow(0 0 12px #16a34a)" }} />
        </>
      )}
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
      <circle cx={0} cy={0} r={14} fill="rgba(239,68,68,0.08)" stroke={col} strokeWidth={2.5} />
      <circle cx={0} cy={0} r={8}  fill="none" stroke={col} strokeWidth={1.5} />
      <circle cx={0} cy={0} r={2.5} fill={col} />
      <line x1={-20} y1={0}  x2={-11} y2={0}  stroke={col} strokeWidth={2} strokeLinecap="round" />
      <line x1={11}  y1={0}  x2={20}  y2={0}  stroke={col} strokeWidth={2} strokeLinecap="round" />
      <line x1={0}   y1={-20} x2={0}  y2={-11} stroke={col} strokeWidth={2} strokeLinecap="round" />
      <line x1={0}   y1={11}  x2={0}  y2={20}  stroke={col} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

/** Known angle marker (replaces scene egg). */
function KnownMarker({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.65))" }}>
      <circle cx={x} cy={y} r={7} fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth={1.5} />
      <line x1={x - 5} y1={y} x2={x + 5} y2={y} stroke="#38bdf8" strokeWidth={1.5} />
      <line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke="#38bdf8" strokeWidth={1.5} />
      <text x={x} y={y + 17} textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fontWeight="900" fontFamily="monospace"
        fill="#7dd3fc" stroke="rgba(0,0,0,0.8)" strokeWidth={2.5} paintOrder="stroke">
        {label}
      </text>
    </g>
  );
}

/** Glowing projectile tracer during a shot. */
function ProjectileTracer({ aimAngle, t, hit, targetRadius }: {
  aimAngle: number; t: number; hit: boolean; targetRadius: number;
}) {
  const maxDist = hit ? targetRadius : targetRadius * 1.42;
  const projDist = t * maxDist;
  const proj  = polarToXY(CX, CY, aimAngle, projDist);
  const trail = polarToXY(CX, CY, aimAngle, Math.max(0, projDist - 22));
  return (
    <g>
      <line x1={trail.x} y1={trail.y} x2={proj.x} y2={proj.y}
        stroke="#fbbf24" strokeWidth={3} strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 6px #f97316)" }} />
      <circle cx={proj.x} cy={proj.y} r={4.5} fill="#fde047"
        style={{ filter: "drop-shadow(0 0 10px #f97316)" }} />
    </g>
  );
}

/** Explosion SVG at a fixed point (CSS animated). */
function ExplosionAt({ x, y }: { x: number; y: number }) {
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g>
      <circle cx={x} cy={y} r={18} fill="rgba(249,115,22,0.45)" stroke="#f97316" strokeWidth={3}
        style={{ animation: "explode-ring 0.52s ease-out forwards", transformOrigin: `${x}px ${y}px` }} />
      <circle cx={x} cy={y} r={10} fill="#fbbf24"
        style={{ animation: "explode-core 0.36s ease-out forwards", transformOrigin: `${x}px ${y}px` }} />
      {spokes.map((a, i) => {
        const ep = polarToXY(x, y, a, 26);
        return (
          <line key={i} x1={x} y1={y} x2={ep.x} y2={ep.y}
            stroke="#fde047" strokeWidth={2} strokeLinecap="round" opacity={0.85}
            style={{
              animation: `explode-ring 0.44s ${i * 0.018}s ease-out forwards`,
              transformOrigin: `${x}px ${y}px`,
            }} />
        );
      })}
    </g>
  );
}

/** HUD progress star icon — replaces egg for shooter theme. */
function ProgressIcon({ collected, gamePhase }: {
  collected: boolean;
  gamePhase: "normal" | "monster" | "platinum";
}) {
  const outerR = 10, innerR = 4.2, pts = 5, cx = 11, cy = 11;
  let d = "";
  for (let i = 0; i < pts * 2; i++) {
    const a = (i * Math.PI / pts) - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    d += (i === 0 ? "M" : "L") + ` ${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)} `;
  }
  d += "Z";
  const fill   = !collected ? "transparent"
    : gamePhase === "platinum" ? "#e2e8f0"
    : gamePhase === "monster"  ? "#fde047"
    : "#e0f2fe";
  const stroke = !collected ? "rgba(255,255,255,0.25)"
    : gamePhase === "platinum" ? "#94a3b8"
    : gamePhase === "monster"  ? "#f59e0b"
    : "#7dd3fc";
  const glow = !collected ? "none"
    : gamePhase === "platinum"
      ? "drop-shadow(0 0 5px rgba(226,232,240,0.9)) drop-shadow(0 0 10px rgba(148,163,184,0.5))"
    : gamePhase === "monster"
      ? "drop-shadow(0 0 6px rgba(251,191,36,0.95)) drop-shadow(0 0 12px rgba(250,204,21,0.55))"
    : "drop-shadow(0 0 5px rgba(125,211,252,0.85))";
  return (
    <svg viewBox="0 0 22 22" width="22" height="22"
      style={{ filter: glow, transition: "all 0.3s", opacity: collected ? 1 : 0.45 }}>
      <path d={d} fill={fill} stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** Live angle value near the gaze arc midpoint; turns green on reveal. */
function LiveAngleLabel({ gazeAngle, revealed, answerDeg }: {
  gazeAngle: number;
  revealed: boolean;
  answerDeg: number;
}) {
  const arcAngle = revealed ? answerDeg : gazeAngle;
  if (Math.abs(arcAngle) < 1 && !revealed) return null;
  const text = revealed
    ? `${Number.isInteger(answerDeg) ? answerDeg : answerDeg.toFixed(1)}°`
    : `${gazeAngle >= 0 ? "" : "−"}${Math.abs(gazeAngle).toFixed(1)}°`;
  // Place label at midpoint of the signed arc, at radius 88
  const midAngle = arcAngle / 2;
  const p = polarToXY(CX, CY, midAngle, 88);
  return (
    <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
      fontSize={16} fontWeight="900" fontFamily="monospace"
      fill={revealed ? "#86efac" : "#fde047"}
      stroke="rgba(0,0,0,0.88)" strokeWidth={4} paintOrder="stroke">
      {text}
    </text>
  );
}

/** Angle-type banner (ACUTE / OBTUSE / etc.) with pill background. */
function AngleTypeLabel({ gazeAngle }: { gazeAngle: number }) {
  const { label, color } = getAngleType(gazeAngle);
  const rectW = label.length * 11 + 34;
  const rectH = 30;
  const rx = rectH / 2;
  const rectX = CX - rectW / 2;
  const rectY = 8;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rx}
        fill="rgba(5,10,25,0.97)" stroke={color} strokeWidth={1.8}
        style={{ filter: `drop-shadow(0 0 8px ${color}90)` }} />
      <text x={CX} y={rectY + rectH / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize={15} fontWeight="900" fontFamily="monospace"
        fill={color} style={{ letterSpacing: "0.08em" }}>
        {label}
      </text>
    </g>
  );
}

/** Coordinate axes through cannon centre — full screen. */
function CoordAxes() {
  // Axes extend to SVG edges
  return (
    <g style={{ pointerEvents: "none" }} opacity={0.75}>
      {/* X axis — full width */}
      <line x1={0} y1={CY} x2={W} y2={CY} stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="6 4" />
      {/* Y axis — full height */}
      <line x1={CX} y1={0} x2={CX} y2={H} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6 4" />
      {/* Labels */}
      <text x={W - 8} y={CY - 8} textAnchor="end" fontSize={10} fill="#38bdf8" fontFamily="monospace" fontWeight="bold">+x</text>
      <text x={10} y={CY - 8} textAnchor="start" fontSize={10} fill="#38bdf8" fontFamily="monospace" fontWeight="bold">-x</text>
      <text x={CX + 8} y={14} textAnchor="start" fontSize={10} fill="#22c55e" fontFamily="monospace" fontWeight="bold">+y</text>
      <text x={CX + 8} y={H - 6} textAnchor="start" fontSize={10} fill="#22c55e" fontFamily="monospace" fontWeight="bold">-y</text>
    </g>
  );
}

/** Bright aim beam + sector arc — shown while actively aiming or firing. */
function GazeBeamDrag({ gazeAngle, level }: { gazeAngle: number; level: 1 | 2 | 3 }) {
  const ep = polarToXY(CX, CY, gazeAngle, BEAM_LEN);
  const beamColor = "#38bdf8";

  // Arc: signed (handle negative angles for L1)
  const absAngle = Math.abs(gazeAngle);
  const a = ((gazeAngle % 360) + 360) % 360; // for comp/supp arcs on L2/L3
  const arcR = 55;

  // Build signed arc path for the main angle arc
  function signedArcPath(): string {
    if (absAngle < 0.5) return "";
    const start = polarToXY(CX, CY, 0, arcR);
    const end = polarToXY(CX, CY, gazeAngle, arcR);
    const largeArc = absAngle > 180 ? 1 : 0;
    // sweepFlag=0 → CCW in SVG (positive math angle); sweepFlag=1 → CW in SVG (negative math angle)
    const sweepFlag = gazeAngle >= 0 ? 0 : 1;
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${arcR} ${arcR} 0 ${largeArc} ${sweepFlag} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  // Arrowhead at the end of the arc
  function arcArrowhead(): { x: number; y: number; rot: number } | null {
    if (absAngle < 1) return null;
    const tipAngle = gazeAngle;
    const tip = polarToXY(CX, CY, tipAngle, arcR);
    // tangent direction at arc end: perpendicular to radius, in direction of arc travel
    const tangentAngle = gazeAngle >= 0 ? tipAngle + 90 : tipAngle - 90;
    return { x: tip.x, y: tip.y, rot: -tangentAngle }; // SVG rotate is CW, math CCW
  }

  const arcD = signedArcPath();
  const arrow = arcArrowhead();
  const compArcD = level === 2 && a > 0 && a < 90 ? arcPath(CX, CY, arcR, gazeAngle, 90) : "";
  const suppArcD = level === 3 && a > 0 && a < 180 ? arcPath(CX, CY, arcR, gazeAngle, 180) : "";

  return (
    <g style={{ pointerEvents: "none" }}>
      {arcD && <path d={`M ${CX} ${CY} ${arcD} Z`} fill={beamColor} fillOpacity={0.12} />}
      {arcD && <path d={arcD} stroke={beamColor} strokeWidth={2.2} fill="none" strokeLinecap="round" />}
      {/* Arrowhead on arc */}
      {arrow && (
        <g transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.rot})`}>
          <path d="M 0 -5 L 4 3 L 0 1 L -4 3 Z" fill={beamColor} />
        </g>
      )}
      {compArcD && <path d={compArcD} stroke="#22c55e" strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray="5 4" opacity={0.75} />}
      {suppArcD && <path d={suppArcD} stroke="#a78bfa" strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray="5 4" opacity={0.75} />}
      {/* Reference ray (0° axis) */}
      <line x1={CX} y1={CY} x2={polarToXY(CX, CY, 0, BEAM_LEN).x} y2={polarToXY(CX, CY, 0, BEAM_LEN).y}
        stroke={beamColor} strokeWidth={1.5} strokeLinecap="round" opacity={0.4} />
      {/* Aim ray */}
      <line x1={CX} y1={CY} x2={ep.x} y2={ep.y}
        stroke={beamColor} strokeWidth={7} strokeLinecap="round" opacity={0.18} />
      <line x1={CX} y1={CY} x2={ep.x} y2={ep.y}
        stroke={beamColor} strokeWidth={2.8} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${beamColor})` }} />
      <circle cx={ep.x} cy={ep.y} r={7} fill={beamColor} fillOpacity={0.2} stroke={beamColor} strokeWidth={2} />
      <circle cx={ep.x} cy={ep.y} r={3.2} fill={beamColor} />
    </g>
  );
}

/** Level 1 scene: starfield + distant mountains. */
function L1Scene() {
  const stars = [
    [30,20],[90,45],[165,18],[240,35],[320,12],[400,38],[458,22],
    [50,80],[130,95],[205,68],[290,85],[375,72],[455,92],
    [15,130],[100,148],[180,125],[265,145],[345,130],[430,148],
    [40,190],[120,205],[200,192],[330,200],[415,210],[470,188],
  ];
  return (
    <g opacity={0.55}>
      {stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.5 : 1} fill="white" />
      ))}
      <path d="M0 280 Q60 220 120 250 Q160 200 200 235 Q250 190 300 230 Q340 195 380 225 Q420 180 460 215 L480 280 Z"
        fill="rgba(30,58,95,0.35)" />
    </g>
  );
}

/** Level 2 scene: two rock walls at a right angle. */
function L2Scene() {
  const cx = CX, cy = CY;
  return (
    <g>
      <rect x={cx} y={cy - 12} width={W - cx + 5} height={24} rx={6} fill="#292524" stroke="#57534e" strokeWidth={2} />
      <rect x={cx - 12} y={-5} width={24} height={cy + 5} rx={6} fill="#292524" stroke="#57534e" strokeWidth={2} />
      <rect x={cx - 12} y={cy - 12} width={24} height={24} rx={4} fill="#44403c" stroke="#78716c" strokeWidth={2} />
      <path d={`M ${cx + 14} ${cy} L ${cx + 14} ${cy - 14} L ${cx} ${cy - 14}`}
        fill="none" stroke="#22c55e" strokeWidth={2} opacity={0.7} />
      <ellipse cx={cx + 40} cy={cy - 10} rx={12} ry={5} fill="rgba(34,197,94,0.12)" />
      <ellipse cx={cx + 5}  cy={cy - 50} rx={5}  ry={12} fill="rgba(34,197,94,0.12)" />
    </g>
  );
}

/** Level 3 scene: rocky ridge (180° line) with divider rays. */
function L3Scene({ div1, div2 }: { div1?: number; div2?: number }) {
  const spineEnd = polarToXY(CX, CY, 0, BEAM_LEN + 60);
  const boundEnd = polarToXY(CX, CY, 180, BEAM_LEN + 60);
  const r1 = div1 !== undefined ? polarToXY(CX, CY, div1, EGG_RADIUS + 20) : null;
  const r2 = div2 !== undefined ? polarToXY(CX, CY, div2, EGG_RADIUS + 20) : null;
  return (
    <g>
      <line x1={boundEnd.x} y1={boundEnd.y} x2={spineEnd.x} y2={spineEnd.y}
        stroke="#78716c" strokeWidth={6} strokeLinecap="round" />
      {[0.15, 0.35, 0.55, 0.72, 0.88].map((t, i) => {
        const rx = boundEnd.x + (spineEnd.x - boundEnd.x) * t;
        const ry = boundEnd.y + (spineEnd.y - boundEnd.y) * t;
        return (
          <ellipse key={i} cx={rx} cy={ry} rx={8 + (i % 3) * 3} ry={4 + (i % 2) * 2}
            fill="#44403c" stroke="#57534e" strokeWidth={1} opacity={0.7} />
        );
      })}
      <line x1={boundEnd.x} y1={boundEnd.y} x2={spineEnd.x} y2={spineEnd.y}
        stroke="rgba(120,113,108,0.3)" strokeWidth={14} strokeLinecap="round" />
      {r1 && <line x1={CX} y1={CY} x2={r1.x} y2={r1.y}
        stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4 4" />}
      {r2 && <line x1={CX} y1={CY} x2={r2.x} y2={r2.y}
        stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4 4" />}
    </g>
  );
}

/** Highlights numbers in yellow within prompt text. */
function ColoredPrompt({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(\d+\.?\d*)/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        /^\d+\.?\d*$/.test(p)
          ? <span key={i} className="text-yellow-300 font-black">{p}</span>
          : p
      )}
    </span>
  );
}

/** Golden target icon for win/gameover screens. */
function GoldenTarget() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32"
      style={{ filter: "drop-shadow(0 0 6px rgba(250,204,21,0.95)) drop-shadow(0 0 16px rgba(251,191,36,0.55))" }}>
      <circle cx="20" cy="20" r="17" fill="none" stroke="#facc15" strokeWidth="3" />
      <circle cx="20" cy="20" r="10" fill="none" stroke="#facc15" strokeWidth="2" />
      <circle cx="20" cy="20" r="4"  fill="#facc15" />
      <line x1="2"  y1="20" x2="10" y2="20" stroke="#facc15" strokeWidth="2" />
      <line x1="30" y1="20" x2="38" y2="20" stroke="#facc15" strokeWidth="2" />
      <line x1="20" y1="2"  x2="20" y2="10" stroke="#facc15" strokeWidth="2" />
      <line x1="20" y1="30" x2="20" y2="38" stroke="#facc15" strokeWidth="2" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArcadeAngleScreen() {
  const [level, setLevel]               = useState<1 | 2 | 3>(1);
  const [unlockedLevel, setUnlockedLevel] = useState<1 | 2 | 3>(1);
  const [screen, setScreen]             = useState<"playing" | "won" | "gameover">("playing");
  const [currentQ, setCurrentQ]         = useState<AngleQuestion>(() => makeQuestion(1));
  const [eggsCollected, setEggsCollected] = useState(0);
  const [monsterEggs, setMonsterEggs]   = useState(0);
  const [gamePhase, setGamePhase]       = useState<"normal" | "monster" | "platinum">("normal");

  const [gazeAngle, setGazeAngle] = useState(0);
  const [dragging, setDragging]   = useState(false);

  const [answer, setAnswer]         = useState("");
  const [subAnswers, setSubAnswers] = useState<[string, string, string]>(["", "", ""]);
  const [subStep, setSubStep]       = useState(0);

  const [soundMuted, setSoundMuted]           = useState(() => isMuted());
  const [flash, setFlash]                     = useState<{ text: string; ok: boolean; icon?: boolean } | null>(null);
  const [monsterRoundName, setMonsterRoundName] = useState("");
  const [showMonsterAnnounce, setShowMonsterAnnounce] = useState(false);

  const [revealedAngle, setRevealedAngle] = useState<number | null>(null);

  // Intro / deploy animation
  type IntroPhase = "origin" | "deploying" | "ready";
  const [introPhase, setIntroPhase] = useState<IntroPhase>("origin");
  const [deployT, setDeployT]       = useState(0);
  const [panelVisible, setPanelVisible] = useState(false);
  const [typeIdx, setTypeIdx]       = useState(0);
  const [introKey, setIntroKey]     = useState(0); // bump to replay intro for same Q

  // Shot animation
  const [isFiring, setIsFiring]   = useState<{ hit: boolean; aimAngle: number } | null>(null);
  const [shotT, setShotT]         = useState(0);
  const [explosion, setExplosion] = useState<{ x: number; y: number } | null>(null);

  // Spin animation (monster round: cannon rotates to typed angle before firing)
  const [spinAnim, setSpinAnim] = useState<{ from: number; to: number; startT: number } | null>(null);

  const svgRef           = useRef<SVGSVGElement>(null);
  const fireButtonRef    = useRef<HTMLButtonElement>(null);
  const draggingRef      = useRef(false);
  const flashTimerRef    = useRef<number | null>(null);
  const lastTickAngleRef = useRef(-999);
  const gamePhaseRef     = useRef<"normal" | "monster" | "platinum">("normal");
  const currentQRef      = useRef(currentQ);
  const earnEggRef       = useRef(() => {});
  const earnMonsterEggRef = useRef(() => {});
  const earnPlatinumEggRef = useRef(() => {});
  const loseEggRef       = useRef(() => {});

  gamePhaseRef.current = gamePhase;
  currentQRef.current  = currentQ;

  const sceneBusy    = introPhase !== "ready" || isFiring !== null || spinAnim !== null;
  const sceneBusyRef = useRef(false);
  sceneBusyRef.current = sceneBusy;

  useEffect(() => {
    startMusic();
    setSoundMuted(isMuted());
  }, []);

  // ── Global Enter key fires the cannon ──────────────────────────────────────
  const canFireRef = useRef(false);
  useEffect(() => {
    canFireRef.current = false; // will be set after canFire is computed below
  });
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      // Input already focused → form submit handles it natively
      if (document.activeElement?.tagName === "INPUT") return;
      if (canFireRef.current) fireButtonRef.current?.click();
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
    if (!panelVisible) { setTypeIdx(0); return; }
    if (currentQ.promptLines) { setTypeIdx(999); return; } // L3: show all at once
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
    const { hit } = isFiring;
    const t0 = performance.now();
    let animId = 0;
    function frame(now: number) {
      if (cancelled) return;
      const t = Math.min(1, (now - t0) / SHOT_MS);
      setShotT(t);
      if (t < 1) { animId = requestAnimationFrame(frame); return; }
      // Shot complete
      setIsFiring(null);
      if (hit) {
        playCorrect();
        playExplosion();
        const q = currentQRef.current;
        const qRadius = q.level === 1 ? L1_TARGET_RADIUS : EGG_RADIUS;
        const fhPt = polarToXY(CX, CY, q.hiddenAngleDeg, qRadius);
        setRevealedAngle(q.hiddenAngleDeg);
        setExplosion({ x: fhPt.x, y: fhPt.y });
        window.setTimeout(() => {
          setExplosion(null);
          if (gamePhaseRef.current === "platinum") earnPlatinumEggRef.current();
          else if (gamePhaseRef.current === "monster") earnMonsterEggRef.current();
          else earnEggRef.current();
        }, 560);
      } else {
        loseEggRef.current();
      }
    }
    animId = requestAnimationFrame(frame);
    return () => { cancelled = true; cancelAnimationFrame(animId); };
  }, [isFiring]);

  // ── Spin animation (monster round: cannon rotates to typed angle before firing) ───
  useEffect(() => {
    if (!spinAnim) return;
    let cancelled = false;
    let animId = 0;
    function frame(now: number) {
      if (cancelled) return;
      const t = Math.min(1, (now - spinAnim!.startT) / SPIN_MS);
      const current = spinAnim!.from + (spinAnim!.to - spinAnim!.from) * easeOutCubic(t);
      setGazeAngle(current);
      if (t < 1) {
        animId = requestAnimationFrame(frame);
      } else {
        setSpinAnim(null);
        const q = currentQRef.current;
        const correct = angleDiffDeg(current, q.hiddenAngleDeg) < ANGLE_HIT_TOL;
        fireCannon(correct, correct ? q.hiddenAngleDeg : current);
      }
    }
    animId = requestAnimationFrame(frame);
    return () => { cancelled = true; cancelAnimationFrame(animId); };
  }, [spinAnim]);

  // ── Drag / aim handling ────────────────────────────────────────────────────
  const moveGaze = useCallback((svgX: number, svgY: number) => {
    if (sceneBusyRef.current) return;
    let angle = pointerToAngle(CX, CY, svgX, svgY);
    // L1: free rotation 0–360 (CCW positive, full circle)
    // L2/L3: clamped to their valid range
    if (level === 2) angle = Math.min(Math.max(angle, 0), 90);
    if (level === 3) angle = Math.min(Math.max(angle, 0), 180);

    const SNAP_TARGETS = level === 1
      ? [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360]
      : level === 2 ? [45] : [90];
    for (const t of SNAP_TARGETS) {
      if (Math.abs(angle - t) < 3) { angle = t; playSnap(); break; }
    }
    if (Math.abs(angle - lastTickAngleRef.current) >= TICK_INTERVAL) {
      lastTickAngleRef.current = angle;
      playAngleTick(angle);
    }
    setGazeAngle(angle);

    // Auto-fill answer box in normal (non-monster) rounds for L1/L2
    if (gamePhaseRef.current !== "monster" && gamePhaseRef.current !== "platinum" && !currentQRef.current.promptLines) {
      setAnswer(angle === Math.round(angle) ? String(angle) : angle.toFixed(1));
    }
  }, [level]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingRef.current || !svgRef.current) return;
      const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
      moveGaze(x, y);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
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
    // In platinum L1 the cannon is dead — only typing + fire moves it
    if (gamePhase === "platinum" && level === 1) return;
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    if (svgRef.current) {
      const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
      moveGaze(x, y);
    }
  }

  // ── Game logic ─────────────────────────────────────────────────────────────
  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1600);
  }

  function nextQuestion(targetLevel = level, targetPhase: "normal" | "monster" | "platinum" = gamePhase) {
    const q = (targetPhase === "monster" || targetPhase === "platinum") && targetLevel === 3
      ? makeMonsterL3Question()
      : makeQuestion(targetLevel);
    setCurrentQ(q);
    setAnswer("");
    setSubAnswers(["", "", ""]);
    setSubStep(0);
    setGazeAngle(targetLevel === 3 ? 90 : 0);
    setIsFiring(null);
    setExplosion(null);
    setSpinAnim(null);
    lastTickAngleRef.current = -999;
  }

  function fireCannon(hit: boolean, aimAngle: number) {
    playCannonFire();
    setShotT(0);
    setIsFiring({ hit, aimAngle });
  }

  function earnEgg() {
    const newEggs = eggsCollected + 1;
    if (newEggs === 5) {
      setEggsCollected(5);
      window.setTimeout(() => startMonsterRound(), 950);
      return;
    }
    setEggsCollected(newEggs);
    shuffleMusic();
    setFlash({ text: "", ok: true, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1200);
    window.setTimeout(() => nextQuestion(level, "normal"), 950);
  }

  function earnMonsterEgg() {
    const newGolden = monsterEggs + 1;
    if (newGolden === 5) {
      setMonsterEggs(5);
      window.setTimeout(() => startPlatinumRound(), 950);
      return;
    }
    setMonsterEggs(newGolden);
    playGoldenEgg();
    switchToMonsterMusic();
    setFlash({ text: "", ok: true, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1200);
    window.setTimeout(() => nextQuestion(level, "monster"), 950);
  }

  function loseEgg() {
    playWrong();
    if (gamePhase === "monster" || gamePhase === "platinum") {
      setMonsterEggs((e) => Math.max(0, e - 1));
    } else {
      setEggsCollected((e) => Math.max(0, e - 1));
    }
    setFlash({ text: "", ok: false, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1100);
    if (gamePhase === "platinum") {
      // Platinum: advance to next question on miss (no retry), with pause
      window.setTimeout(() => nextQuestion(level, "platinum"), 950);
    } else {
      // Normal/Monster: retry same question
      setIsFiring(null);
      setSpinAnim(null);
      setExplosion(null);
      setAnswer("");
      setGazeAngle(level === 3 ? 90 : 0);
      lastTickAngleRef.current = -999;
    }
  }

  earnEggRef.current         = earnEgg;
  earnMonsterEggRef.current  = earnMonsterEgg;
  earnPlatinumEggRef.current = earnPlatinumEgg;
  loseEggRef.current         = loseEgg;

  function startMonsterRound() {
    const name = MONSTER_ROUND_NAMES[Math.floor(Math.random() * MONSTER_ROUND_NAMES.length)];
    setMonsterRoundName(name);
    setGamePhase("monster");
    setMonsterEggs(0);
    setShowMonsterAnnounce(true);
    playMonsterStart();
    switchToMonsterMusic();
    nextQuestion(level, "monster");
    window.setTimeout(() => setShowMonsterAnnounce(false), 2800);
  }

  function startPlatinumRound() {
    const name = PLATINUM_ROUND_NAMES[Math.floor(Math.random() * PLATINUM_ROUND_NAMES.length)];
    setMonsterRoundName(name);
    setGamePhase("platinum");
    setMonsterEggs(0);
    setShowMonsterAnnounce(true);
    playMonsterStart();
    switchToMonsterMusic();
    nextQuestion(level, "platinum");
    window.setTimeout(() => setShowMonsterAnnounce(false), 2800);
  }

  function earnPlatinumEgg() {
    const newPlat = monsterEggs + 1;
    if (newPlat === 5) {
      setMonsterEggs(5);
      if (level === 3) {
        playGameComplete();
        setScreen("gameover");
      } else {
        playMonsterVictory();
        if (!IS_DEV) setUnlockedLevel((u) => Math.max(u, level + 1) as 1 | 2 | 3);
        setScreen("won");
      }
      return;
    }
    setMonsterEggs(newPlat);
    playGoldenEgg();
    setFlash({ text: "", ok: true, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1200);
    window.setTimeout(() => nextQuestion(level, "platinum"), 950);
  }

  function beginNewRun(targetLevel?: 1 | 2 | 3) {
    playButton();
    shuffleMusic();
    const lv = targetLevel ?? level;
    if (targetLevel) setLevel(targetLevel);
    const firstQ = makeQuestion(lv);
    setScreen("playing");
    setCurrentQ(firstQ);
    setEggsCollected(0);
    setMonsterEggs(0);
    setGamePhase("normal");
    setFlash(null);
    setDragging(false);
    setAnswer("");
    setSubAnswers(["", "", ""]);
    setSubStep(0);
    setRevealedAngle(null);
    setGazeAngle(lv === 3 ? 90 : 0);
    setIsFiring(null);
    setExplosion(null);
    setSpinAnim(null);
    lastTickAngleRef.current = -999;
  }

  function resetCurrentQuestion() {
    playButton();
    setFlash(null);
    setDragging(false);
    draggingRef.current = false;
    setAnswer("");
    setSubAnswers(["", "", ""]);
    setSubStep(0);
    setGazeAngle(level === 3 ? 90 : 0);
    setIsFiring(null);
    setExplosion(null);
    setSpinAnim(null);
    setIntroKey((k) => k + 1); // re-triggers intro animation for same question
  }

  function devSetEggs(i: number) {
    if (!IS_DEV) return;
    const target = i + 1;
    if (gamePhase === "monster") {
      if (target === 5) earnMonsterEgg(); else setMonsterEggs(target);
    } else {
      if (target === 5) { setEggsCollected(5); startMonsterRound(); }
      else { setEggsCollected(target); nextQuestion(); }
    }
  }

  // ── Submit / Fire ──────────────────────────────────────────────────────────
  function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (sceneBusy) return;

    // Monster round single-step: fire at current aim (cannon already moved from typing/dragging)
    if (isMonster && !currentQ.promptLines) {
      playButton();
      const correct = angleDiffDeg(gazeAngle, currentQ.hiddenAngleDeg) < ANGLE_HIT_TOL;
      fireCannon(correct, correct ? currentQ.hiddenAngleDeg : gazeAngle);
      return;
    }

    // Platinum round: cannon rotates to typed value then fires (blind shot)
    if (gamePhase === "platinum" && !currentQ.promptLines) {
      const typedAngle = parseFloat(answer.trim());
      if (isNaN(typedAngle)) { showFlash("Type a number!", false); return; }
      playButton();
      setSpinAnim({ from: gazeAngle, to: typedAngle, startT: performance.now() });
      return;
    }

    playButton();

    if (currentQ.promptLines && currentQ.subAnswers) {
      // L3 multi-step
      const g = parseFloat(subAnswers[subStep]);
      if (isNaN(g)) { showFlash("Enter a number!", false); return; }
      const ok = Math.abs(g - currentQ.subAnswers[subStep]) < 0.6;
      if (subStep < 2) {
        if (ok) {
          setSubStep((s) => s + 1);
        } else {
          playWrong();
          showFlash("Try again!", false);
          setSubAnswers((prev) => {
            const next = [...prev] as [string, string, string];
            next[subStep] = "";
            return next;
          });
        }
        return;
      }
      // Final step — fire!
      fireCannon(ok, ok ? currentQ.hiddenAngleDeg : gazeAngle);
      return;
    }

    // L1 / L2 single step
    const trimmed = answer.trim();
    if (trimmed === "") {
      // Aim-based: validate gazeAngle proximity
      const correct = angleDiffDeg(gazeAngle, currentQ.hiddenAngleDeg) < ANGLE_HIT_TOL;
      fireCannon(correct, gazeAngle);
    } else {
      const guess = parseFloat(trimmed);
      if (isNaN(guess)) { showFlash("Type a number!", false); return; }
      const correct = angleDiffDeg(guess, currentQ.answer) < ANGLE_HIT_TOL;
      fireCannon(correct, correct ? currentQ.hiddenAngleDeg : gazeAngle);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const phaseBg = LEVEL_BG[`${level}-${gamePhase}`] ?? { bg: "#080e1c", glow: "#1e3a5f", tint: "transparent" };
  const isMonster = gamePhase === "monster";
  const isPlatinum = gamePhase === "platinum";

  const qAsAny = currentQ as AngleQuestion & { div1?: number; div2?: number };
  const revealGaze = revealedAngle ?? gazeAngle;
  const aimForBeam = isFiring ? isFiring.aimAngle : revealGaze;
  const targetRadius = currentQ.level === 1 ? L1_TARGET_RADIUS : EGG_RADIUS;
  const fh = polarToXY(CX, CY, currentQ.hiddenAngleDeg, targetRadius);
  const targetX = CX + (fh.x - CX) * deployT;
  const targetY = CY + (fh.y - CY) * deployT;
  const displayPrompt = panelVisible ? currentQ.prompt.slice(0, Math.max(typeIdx, 0)) : "";

  const parsedAnswer = parseFloat(answer.trim());
  // isAiming: cannon is actively pointed somewhere (dragging, firing, spinAnim, or valid number typed)
  const isAiming = dragging || isFiring !== null || spinAnim !== null
    || (answer.trim() !== "" && !isNaN(parsedAnswer));

  // Fire only enabled when typed value matches current aim (confirms the user has read the angle)
  const canFire = !sceneBusy && !currentQ.promptLines
    && answer.trim() !== "" && !isNaN(parsedAnswer);
  canFireRef.current = canFire;

  return (
    <div className="relative h-svh w-screen overflow-hidden font-arcade"
      style={{ background: `radial-gradient(ellipse at top, ${phaseBg.glow} 0%, ${phaseBg.bg} 72%)` }}>
      <div className="pointer-events-none absolute inset-0 arcade-grid opacity-20" />
      {(isMonster || isPlatinum) && (
        <div className="pointer-events-none absolute inset-0 z-[1]" style={{ background: phaseBg.tint }} />
      )}

      {/* ── Top bar ── */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-start px-3 pt-2 md:px-5 md:pt-2">

        {/* Left buttons */}
        <div className="flex flex-col md:flex-row gap-2 mt-[76px] md:mt-0 md:ml-[64px] shrink-0">
          <button onClick={resetCurrentQuestion} title="Reset"
            className="arcade-button w-16 h-16 flex items-center justify-center p-3.5">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <path d="M1 4v6h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 20v-6h-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"
                stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={() => { const m = toggleMute(); setSoundMuted(m); }} title="Mute"
            className="arcade-button w-16 h-16 flex items-center justify-center p-3.5"
            style={soundMuted ? { background: "linear-gradient(180deg,#475569,#334155)", boxShadow: "0 5px 0 #1e293b", borderColor: "#94a3b8" } : {}}>
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              {soundMuted ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white"/>
                  <line x1="23" y1="9" x2="17" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="17" y1="9" x2="23" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Centre HUD */}
        <div className="flex-1 flex flex-col items-center gap-1.5 pt-1">
          {/* Level select */}
          <div className="flex items-center gap-1.5">
            {([1, 2, 3] as const).map((lv) => {
              const locked = !IS_DEV && lv > unlockedLevel && lv > level;
              return (
                <button key={lv} onClick={() => !locked && beginNewRun(lv)}
                  disabled={locked}
                  className="w-9 h-8 rounded text-xs font-black border-2 transition-colors"
                  style={{
                    background: locked ? "#0f172a" : level === lv ? (isMonster ? "#92400e" : "#0ea5e9") : lv < level ? "#78350f" : "#1e293b",
                    borderColor: locked ? "#1e293b" : level === lv ? (isMonster ? "#fbbf24" : "#38bdf8") : lv < level ? "#fbbf24" : "#475569",
                    color: locked ? "#334155" : level === lv ? (isMonster ? "#fde047" : "white") : lv < level ? "#fde047" : "#64748b",
                    boxShadow: lv < level ? "0 0 8px rgba(251,191,36,0.45)" : undefined,
                    cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.5 : 1,
                  }}>
                  {locked ? "🔒" : lv}
                </button>
              );
            })}
          </div>

          {(isMonster || isPlatinum) && (
            <div className="text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={isPlatinum ? {
                background: "linear-gradient(135deg, rgba(71,85,105,0.85) 0%, rgba(100,116,139,0.9) 50%, rgba(71,85,105,0.85) 100%)",
                color: "#e2e8f0", border: "2px solid #94a3b8",
                boxShadow: "0 0 12px rgba(148,163,184,0.6), 0 0 28px rgba(148,163,184,0.3)",
                textShadow: "0 0 10px rgba(226,232,240,0.9)",
                animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
              } : {
                background: "linear-gradient(135deg, rgba(161,122,6,0.85) 0%, rgba(202,138,4,0.9) 50%, rgba(161,122,6,0.85) 100%)",
                color: "#fef08a", border: "2px solid #fbbf24",
                boxShadow: "0 0 12px rgba(251,191,36,0.6), 0 0 28px rgba(234,179,8,0.35)",
                textShadow: "0 0 10px rgba(250,204,21,0.9)",
                animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
              }}>
              {isPlatinum ? "🎯" : "⚡"} {monsterRoundName} {isPlatinum ? "🎯" : "⚡"}
            </div>
          )}

          {/* Progress tracker */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => {
              const collected = (isMonster || isPlatinum) ? i < monsterEggs : i < eggsCollected;
              const isTarget  = IS_DEV && i === ((isMonster || isPlatinum) ? monsterEggs : eggsCollected);
              return (
                <span key={i}
                  onClick={IS_DEV ? () => devSetEggs(i) : undefined}
                  style={{ display: "inline-flex", cursor: IS_DEV ? "pointer" : "default",
                    outline: isTarget ? "2px dashed rgba(255,255,255,0.4)" : undefined,
                    borderRadius: isTarget ? "50%" : undefined }}>
                  <ProgressIcon collected={collected} gamePhase={gamePhase} />
                </span>
              );
            })}
          </div>

        </div>
      </div>

      {/* ── SVG scene ── */}
      <div className="absolute inset-x-0 top-[184px] bottom-[86px] md:top-[96px] md:bottom-[92px] z-10">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full touch-none select-none"
          onPointerDown={startDrag}
          style={{ cursor: dragging ? "grabbing" : "crosshair" }}>

          {/* Level-specific terrain */}
          {level === 1 && <L1Scene />}
          {level === 2 && <L2Scene />}
          {level === 3 && <L3Scene div1={qAsAny.div1} div2={qAsAny.div2} />}

          {/* Coordinate axes — whenever cannon is aimed */}
          {isAiming && <CoordAxes />}

          {/* Known angle markers */}
          {currentQ.knownEggs.map((egg, i) => {
            const p = polarToXY(CX, CY, egg.angleDeg, EGG_RADIUS);
            return <KnownMarker key={i} x={p.x} y={p.y} label={egg.label} />;
          })}

          {/* Target crosshair — hide when projectile is about to hit or explosion is showing */}
          {!(isFiring?.hit && shotT > 0.88) && !explosion && revealedAngle === null && (
            <g transform={`translate(${targetX}, ${targetY})`}>
              <TargetSprite pulse={introPhase === "ready" && revealedAngle === null && !isFiring} />
            </g>
          )}

          {/* Live angle label — while aiming (or revealed after hit); hidden in monster round */}
          {(dragging || revealedAngle !== null || spinAnim !== null) && !isFiring && !isMonster && introPhase === "ready" && (
            <LiveAngleLabel
              gazeAngle={gazeAngle}
              revealed={revealedAngle !== null}
              answerDeg={currentQ.answer}
            />
          )}

          {/* Angle type label while aiming (L1 only) */}
          {isAiming && level === 1 && Math.abs(gazeAngle) > 0.5 && (
            <AngleTypeLabel gazeAngle={gazeAngle} />
          )}

          {/* Projectile tracer */}
          {isFiring && (
            <ProjectileTracer aimAngle={isFiring.aimAngle} t={shotT} hit={isFiring.hit} targetRadius={targetRadius} />
          )}

          {/* Explosion */}
          {explosion && <ExplosionAt x={explosion.x} y={explosion.y} />}

          {/* Aim beam — whenever cannon is aimed */}
          {isAiming && (
            <GazeBeamDrag gazeAngle={aimForBeam} level={level} />
          )}

          {/* Cannon */}
          <g transform={`translate(${CX}, ${CY})`}>
            <CannonSprite aimAngle={revealGaze} dragging={dragging} />
          </g>
        </svg>
      </div>

      {/* ── Bottom question panel (hidden until target has deployed) ── */}
      {panelVisible && (
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 md:px-5 md:pb-4 z-50">
          <form onSubmit={submitAnswer} className="flex items-center gap-2 md:gap-3">
            {currentQ.promptLines && currentQ.subAnswers ? (
              /* Multi-step (Level 3) */
              <div className="arcade-panel flex-1 flex flex-col gap-2 px-4 py-2.5">
                {currentQ.promptLines.map((line, i) => {
                  const isDone    = i < subStep;
                  const isCurrent = i === subStep;
                  return (
                    <div key={i} className={`flex items-center gap-2 transition-opacity duration-200 ${i > subStep ? "opacity-30" : ""}`}>
                      <ColoredPrompt text={line}
                        className={`flex-1 text-sm leading-5 font-bold ${i === 2 ? "text-white" : "text-slate-300"}`} />
                      {IS_DEV && currentQ.subAnswers && (
                        <span className="shrink-0 rounded px-1 text-[10px] font-black"
                          style={{ background: "rgba(250,204,21,0.18)", color: "#fde047", border: "1px solid rgba(250,204,21,0.3)" }}>
                          {currentQ.subAnswers[i]}
                        </span>
                      )}
                      <span className="text-slate-400 text-sm">=</span>
                      {isDone ? (
                        <div className="w-20 flex items-center justify-end gap-1">
                          <span className="text-green-400 text-sm font-bold">{subAnswers[i]}°</span>
                        </div>
                      ) : isCurrent ? (
                        <input autoFocus value={subAnswers[i]}
                          onChange={(e) => setSubAnswers((prev) => {
                            const next = [...prev] as [string, string, string];
                            next[i] = e.target.value;
                            return next;
                          })}
                          inputMode="decimal" placeholder="°"
                          className="w-20 rounded-lg border-[3px] border-white/70 bg-slate-950 px-2 py-1 text-sm text-white outline-none placeholder:text-slate-500 text-right" />
                      ) : (
                        <div className="w-20 h-[34px] rounded-lg border-[2px] border-white/15 bg-slate-950/40" />
                      )}
                      <button type="submit" disabled={!isCurrent}
                        className={`arcade-button shrink-0 h-8 w-8 flex items-center justify-center p-0 transition-opacity ${!isCurrent ? "opacity-30 cursor-not-allowed" : ""}`}>
                        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                          <path d="M4 13 L9 18 L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Single row (L1 / L2) */
              <div className="arcade-panel flex-1 flex items-center gap-2 px-4 py-2 min-h-[60px] text-sm md:text-base leading-6 text-white font-bold">
                <ColoredPrompt text={displayPrompt} />
                {IS_DEV && (
                  <span className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-xs font-black"
                    style={{ background: "rgba(250,204,21,0.18)", color: "#fde047", border: "1px solid rgba(250,204,21,0.35)" }}>
                    {currentQ.answer}
                  </span>
                )}
              </div>
            )}

            {/* Input + FIRE button (single-step levels) */}
            {!currentQ.promptLines && (
              <>
                <input value={answer} onChange={(e) => {
                  const v = e.target.value;
                  setAnswer(v);
                  // Immediately rotate cannon to typed angle (not in platinum — that happens on fire)
                  if (!sceneBusy && gamePhase !== "platinum") {
                    const num = parseFloat(v);
                    if (!isNaN(num)) {
                      let clamped = num;
                      if (level === 2) clamped = Math.min(Math.max(num, 0), 90);
                      else if (level === 3) clamped = Math.min(Math.max(num, 0), 180);
                      // L1: no clamp — allow any angle (0–360 CCW or 0 to –360 CW)
                      setGazeAngle(clamped);
                    }
                  }
                }}
                  inputMode="decimal" placeholder="°"
                  className="w-[72px] md:w-[90px] shrink-0 rounded-xl border-[3px] border-white/70 bg-slate-950 px-3 py-2.5 text-base md:text-lg text-white outline-none placeholder:text-slate-500 text-center" />
                <button ref={fireButtonRef} type="submit" disabled={!canFire} title="Fire!"
                  className="arcade-button shrink-0 rounded-full w-14 h-14 flex flex-col items-center justify-center p-0 disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                    <path d="M12 2C12 2 7 6 7 13H9L7 22L12 19L17 22L15 13H17C17 6 12 2 12 2Z" />
                    <path d="M9 13C9 13 7 14 6 16C7 16 8 15.5 9 15" fill="rgba(255,180,0,0.9)" />
                    <path d="M15 13C15 13 17 14 18 16C17 16 16 15.5 15 15" fill="rgba(255,180,0,0.9)" />
                  </svg>
                </button>
              </>
            )}
          </form>
        </div>
      )}

      {/* ── Flash feedback ── */}
      {flash && (
        flash.icon ? (
          <div className="pointer-events-none absolute z-50 mt-[76px] md:mt-0"
            style={{ top: "8px", left: "12px" }}>
            {flash.ok ? (
              <svg viewBox="0 0 120 120" width="64" height="64"
                style={{ animation: "icon-pop-corner 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards",
                  filter: "drop-shadow(0 0 12px #4ade80) drop-shadow(0 0 24px #16a34a)" }}>
                <circle cx="60" cy="60" r="54" fill="#052e16" opacity="0.88" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="#4ade80" strokeWidth="5" />
                <path d="M30 62 L50 82 L90 38" fill="none" stroke="#4ade80" strokeWidth="13"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 120 120" width="64" height="64"
                style={{ animation: "icon-pop-corner 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards",
                  filter: "drop-shadow(0 0 12px #f87171) drop-shadow(0 0 24px #b91c1c)" }}>
                <circle cx="60" cy="60" r="54" fill="#2d0a0a" opacity="0.88" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="#f87171" strokeWidth="5" />
                <path d="M38 38 L82 82 M82 38 L38 82" fill="none" stroke="#f87171" strokeWidth="13" strokeLinecap="round" />
              </svg>
            )}
          </div>
        ) : (
          <div className={`pointer-events-none absolute left-1/2 top-[30%] z-40 -translate-x-1/2 rounded-xl border-2 px-8 py-4 text-2xl font-black uppercase tracking-widest animate-bounce-in ${flash.ok ? "border-emerald-400 bg-emerald-950/90 text-emerald-300" : "border-pink-400 bg-pink-950/90 text-pink-300"}`}>
            {flash.text}
          </div>
        )
      )}

      {/* ── Monster Round announcement ── */}
      {showMonsterAnnounce && (
        <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center"
          style={{ background: isPlatinum
            ? "radial-gradient(ellipse at center, rgba(30,41,59,0.97) 0%, rgba(5,8,20,0.99) 75%)"
            : "radial-gradient(ellipse at center, rgba(88,28,135,0.95) 0%, rgba(10,2,20,0.98) 75%)" }}>
          <div className="text-7xl mb-4" style={{ animation: "icon-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>{isPlatinum ? "🎯" : "💥"}</div>
          <div className="text-4xl md:text-5xl font-black uppercase tracking-widest text-center px-4"
            style={{ color: isPlatinum ? "#e2e8f0" : "#fde047", textShadow: isPlatinum ? "0 0 30px rgba(226,232,240,0.6)" : "0 0 30px rgba(250,204,21,0.8)" }}>
            {monsterRoundName}
          </div>
          <div className="mt-5 text-lg tracking-wide" style={{ color: isPlatinum ? "#94a3b8" : "#d8b4fe" }}>
            {isPlatinum ? "Type blind — one shot only!" : "Drag to aim — no angle shown!"}
          </div>
          <div className="mt-2 text-xl text-yellow-400 font-black">Destroy 5 targets 🎯</div>
        </div>
      )}

      {/* ── Won screen ── */}
      {screen === "won" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-6">
          <div className="arcade-panel p-10 text-center">
            {(isMonster || isPlatinum) ? (
              <>
                <div className="text-4xl font-black uppercase tracking-[0.18em] md:text-5xl"
                  style={{ color: isPlatinum ? "#e2e8f0" : "#fde047" }}>
                  Level {level} Complete!
                </div>
                <div className="mt-1 text-lg font-bold" style={{ color: isPlatinum ? "#94a3b8" : "#d8b4fe" }}>
                  {isPlatinum ? "🎯 Platinum Cleared! 🎯" : "💥 Barrage Survived! 💥"}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {[0,1,2,3,4].map((i) => <GoldenTarget key={i} />)}
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl font-black uppercase tracking-[0.18em] text-emerald-400 md:text-5xl">
                  Level {level} Clear!
                </div>
                <div className="mt-2 text-xl text-yellow-300">🎯🎯🎯🎯🎯 All targets hit!</div>
              </>
            )}
            <div className="mt-8 flex flex-col items-center gap-3">
              {level < 3 && (
                <button onClick={() => beginNewRun((level + 1) as 1 | 2 | 3)}
                  className="arcade-button px-8 py-4 text-base md:text-lg">
                  Next Level
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Game over (all 3 levels complete) ── */}
      {screen === "gameover" && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center"
          style={{ background: "radial-gradient(ellipse at center, rgba(88,28,135,0.97) 0%, rgba(5,2,18,0.99) 80%)" }}>
          <div className="arcade-panel p-8 md:p-12 text-center mx-6 max-w-lg w-full"
            style={{ boxShadow: "0 0 40px rgba(251,191,36,0.35), 0 0 80px rgba(109,40,217,0.3)" }}>
            <div className="flex justify-center gap-3 text-4xl mb-4">🎯💥🎯</div>
            <div className="text-3xl md:text-4xl font-black uppercase tracking-widest text-yellow-300"
              style={{ textShadow: "0 0 24px rgba(250,204,21,0.8)" }}>
              You Did It!
            </div>
            <div className="mt-2 text-base md:text-lg text-purple-200 font-bold">All 3 Levels Cleared</div>
            <div className="flex justify-center gap-2 mt-5">
              {[0,1,2,3,4].map((i) => <GoldenTarget key={i} />)}
            </div>
            <button onClick={() => { setUnlockedLevel(1); beginNewRun(1); }}
              className="arcade-button mt-8 px-10 py-4 text-lg font-black uppercase tracking-wider w-full"
              style={{ boxShadow: "0 0 16px rgba(251,191,36,0.4), 0 6px 0 #78350f", borderColor: "#fbbf24" }}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
