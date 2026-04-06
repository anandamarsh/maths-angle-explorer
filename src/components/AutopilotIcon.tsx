interface Props {
  onClick: () => void;
  active?: boolean;
  title?: string;
  ariaLabel?: string;
}

export default function AutopilotIcon({
  onClick,
  active = true,
  title = "Autopilot ON — click to stop",
  ariaLabel = "Autopilot active — click to cancel",
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="h-10 w-10 shrink-0 rounded-full"
      style={{
        border: "1px solid rgba(255,255,255,0.32)",
        background:
          "radial-gradient(circle at 30% 28%, #ecfeff 0%, #67e8f9 28%, #22d3ee 64%, #0891b2 100%)",
        animation: active ? "autopilot-blink 2s ease-in-out infinite" : undefined,
        boxShadow: active
          ? "0 0 0 2px rgba(125,211,252,0.25), 0 10px 22px rgba(8,145,178,0.35), inset 0 1px 0 rgba(255,255,255,0.65)"
          : "0 0 0 1px rgba(125,211,252,0.18), 0 8px 18px rgba(8,145,178,0.2), inset 0 1px 0 rgba(255,255,255,0.55)",
        opacity: active ? 1 : 0.96,
        transform: active ? "translateY(0)" : "translateY(1px)",
      }}
    >
      <svg viewBox="0 0 24 24" className="h-full w-full p-[0.34rem]" fill="none">
        <line x1="12" y1="2" x2="12" y2="5" stroke="#082f49" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="1.5" r="1.2" fill="#082f49" />
        <rect x="4" y="5" width="16" height="12" rx="2.5" stroke="#082f49" strokeWidth="1.8" fill="rgba(8,47,73,0.06)" />
        <circle cx="9" cy="10" r="2" fill="#082f49" opacity="0.9" />
        <circle cx="15" cy="10" r="2" fill="#082f49" opacity="0.9" />
        <circle cx="9.7" cy="9.3" r="0.65" fill="white" opacity="0.7" />
        <circle cx="15.7" cy="9.3" r="0.65" fill="white" opacity="0.7" />
        <path d="M8.5 13.5 Q12 15.5 15.5 13.5" stroke="#082f49" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <line x1="9" y1="17" x2="9" y2="20" stroke="#082f49" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="15" y1="17" x2="15" y2="20" stroke="#082f49" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="20" x2="17" y2="20" stroke="#082f49" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
