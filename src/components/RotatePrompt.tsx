import { useEffect, useState } from "react";

function usePortraitMobile() {
  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const [isPortrait, setIsPortrait] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(orientation: portrait)").matches
      : false
  );

  useEffect(() => {
    if (!isTouchDevice) return;

    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [isTouchDevice]);

  return isTouchDevice && isPortrait;
}

export default function RotatePrompt() {
  const show = usePortraitMobile();

  // Attempt runtime lock when the overlay appears (requires fullscreen on some browsers)
  useEffect(() => {
    if (show) {
      (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })
        ?.lock?.("landscape")
        ?.catch(() => {});
    }
  }, [show]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#020617",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Animated phone + rotate arrow */}
      <div style={{ animation: "wobble 1.8s ease-in-out infinite" }}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Phone body */}
          <rect
            x="35"
            y="10"
            width="50"
            height="80"
            rx="8"
            fill="#0f172a"
            stroke="#818cf8"
            strokeWidth="3"
          />
          {/* Screen */}
          <rect x="41" y="22" width="38" height="55" rx="3" fill="#020617" />
          {/* Home indicator */}
          <rect x="50" y="83" width="20" height="3" rx="1.5" fill="#818cf8" />
          {/* Rotate arrow arc */}
          <path
            d="M 20 100 A 45 45 0 0 1 100 100"
            stroke="#818cf8"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="8 4"
          />
          {/* Arrow head */}
          <polyline
            points="93,92 100,100 92,107"
            stroke="#818cf8"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>

      <div style={{ textAlign: "center", color: "#e0e7ff", padding: "0 2rem" }}>
        <p
          style={{
            fontSize: "1.4rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            letterSpacing: "0.02em",
          }}
        >
          Rotate your device
        </p>
        <p style={{ fontSize: "1rem", color: "#818cf8", lineHeight: 1.5 }}>
          Angle Explorer plays best in landscape mode
        </p>
      </div>

      <style>{`
        @keyframes wobble {
          0%   { transform: rotate(0deg); }
          20%  { transform: rotate(-25deg); }
          50%  { transform: rotate(20deg); }
          75%  { transform: rotate(-15deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
