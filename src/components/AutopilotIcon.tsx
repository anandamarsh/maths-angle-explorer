interface Props {
  onClick: () => void;
}

export default function AutopilotIcon({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      title="Autopilot ON — click to stop"
      aria-label="Autopilot active — click to cancel"
      className="w-10 h-10 flex items-center justify-center rounded-lg shrink-0"
      style={{
        border: "2px solid #22c55e",
        background: "rgba(34,197,94,0.12)",
        animation: "autopilot-blink 2s ease-in-out infinite",
        cursor: "pointer",
        boxShadow: "0 0 10px rgba(34,197,94,0.45)",
      }}
    >
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <line x1="12" y1="2" x2="12" y2="5" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="12" cy="1.5" r="1.2" fill="#22c55e"/>
        <rect x="4" y="5" width="16" height="12" rx="2.5" stroke="#22c55e" strokeWidth="1.8" fill="rgba(34,197,94,0.08)"/>
        <circle cx="9" cy="10" r="2" fill="#22c55e" opacity="0.9"/>
        <circle cx="15" cy="10" r="2" fill="#22c55e" opacity="0.9"/>
        <circle cx="9.7" cy="9.3" r="0.65" fill="white" opacity="0.7"/>
        <circle cx="15.7" cy="9.3" r="0.65" fill="white" opacity="0.7"/>
        <path d="M8.5 13.5 Q12 15.5 15.5 13.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <line x1="9" y1="17" x2="9" y2="20" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="15" y1="17" x2="15" y2="20" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="7" y1="20" x2="17" y2="20" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </button>
  );
}
