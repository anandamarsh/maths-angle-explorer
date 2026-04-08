import { useEffect, useState } from "react";

type SlideType = "intro" | "outro";

interface Props {
  type: SlideType;
  onComplete?: () => void;
  onFadeStart?: () => void;
  isStatic?: boolean;
}

const DEMO_TEST_SCALE = (() => {
  if (typeof window === "undefined") return 1;
  const raw = new URLSearchParams(window.location.search).get("demoTestScale");
  const parsed = raw ? Number.parseFloat(raw) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
})();

function scaleDemoMs(ms: number) {
  return Math.max(1, Math.round(ms * DEMO_TEST_SCALE));
}

const INTRO_HOLD_MS = scaleDemoMs(10_000);
const OUTRO_HOLD_MS = scaleDemoMs(5_000);
const INTRO_FADE_MS = scaleDemoMs(600);
const OUTRO_FADE_MS = scaleDemoMs(1_200);

export default function DemoIntroOverlay({
  type,
  onComplete,
  onFadeStart,
  isStatic = false,
}: Props) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (isStatic) return;

    const fadeMs = type === "intro" ? INTRO_FADE_MS : OUTRO_FADE_MS;
    const holdMs = type === "intro" ? INTRO_HOLD_MS : OUTRO_HOLD_MS;
    const fadeTimer = window.setTimeout(() => {
      onFadeStart?.();
      setOpacity(0);
    }, holdMs);
    const completeTimer = window.setTimeout(() => {
      onComplete?.();
    }, holdMs + fadeMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
    };
  }, [isStatic, onComplete, onFadeStart, type]);

  const fadeMs = type === "intro" ? INTRO_FADE_MS : OUTRO_FADE_MS;

  return (
    <div
      data-testid={`demo-overlay-${type}`}
      style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "all" }}
    >
      {type === "intro" ? (
        isStatic ? (
          <div
            data-testid="demo-intro-prompt"
            style={{ position: "fixed", inset: 0, background: "#020617" }}
          />
        ) : (
          <iframe
            title="Demo intro screen"
            data-testid="demo-intro-frame"
            src="/intro.html"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
              background: "#020617",
              opacity,
              transition: `opacity ${fadeMs}ms ease-in-out`,
            }}
          />
        )
      ) : (
        <div style={{ position: "fixed", inset: 0, background: "#020617" }}>
          <iframe
            title="Demo outro screen"
            data-testid="demo-outro-frame"
            src="/outro.html"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
              background: "#020617",
              opacity,
              transition: `opacity ${fadeMs}ms ease-in-out`,
            }}
          />
        </div>
      )}
    </div>
  );
}
