interface Props {
  onClick: () => void;
}

export default function AutopilotIcon({ onClick }: Props) {
  const blue = "#67e8f9";
  return (
    <button
      type="button"
      onClick={onClick}
      title="Autopilot ON — click to stop"
      aria-label="Autopilot active — click to cancel"
      className="h-10 w-10 shrink-0 rounded-lg"
      style={{
        border: `2px solid ${blue}`,
        background: blue,
        animation: "autopilot-blink 2s ease-in-out infinite",
        boxShadow: "0 0 10px rgba(103,232,249,0.35)",
      }}
    >
      <svg viewBox="0 0 24 24" className="h-full w-full p-1.5" fill="none">
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
