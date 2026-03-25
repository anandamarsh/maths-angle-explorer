export default function App() {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#020617" }}
    >
      {/* Icon */}
      <div className="mb-8">
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="96" height="96" rx="24" fill="#0f172a" />
          {/* Fixed spine ray */}
          <line x1="48" y1="48" x2="82" y2="48" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          {/* Swept blade ray */}
          <line x1="48" y1="48" x2="22" y2="22" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
          {/* Arc showing the angle */}
          <path d="M 68 48 A 20 20 0 0 0 52.6 31.4" stroke="#facc15" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Angle label */}
          <text x="64" y="42" fontSize="10" fill="#facc15" fontFamily="monospace" fontWeight="bold">135°</text>
          {/* Vertex dot */}
          <circle cx="48" cy="48" r="3.5" fill="#38bdf8" />
        </svg>
      </div>

      {/* Title */}
      <p className="text-xs font-bold tracking-[0.25em] uppercase text-sky-400 mb-2">
        Interactive Maths
      </p>
      <h1 className="text-4xl font-black text-white mb-3 text-center">
        Angle Explorer
      </h1>
      <p className="text-slate-400 text-sm text-center max-w-xs mb-10">
        Sweep, drag and discover angles — complementary, supplementary, vertical and more.
      </p>

      {/* Level cards placeholder */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {[
          { level: 1, name: "The Full Sweep",       sub: "Zero → Reflex → Full turn",    color: "#38bdf8" },
          { level: 2, name: "Complementary",         sub: "Two angles that make a corner", color: "#34d399" },
          { level: 3, name: "Supplementary",         sub: "Two angles on a straight line", color: "#a78bfa" },
          { level: 4, name: "Adjacent Fan",          sub: "Multi-ray diagrams",            color: "#f97316" },
          { level: 5, name: "Vertical Angles",       sub: "Opposite angles at a cross",    color: "#fb7185" },
          { level: 6, name: "Reflex & Full Turn",    sub: "Past 180° and back to 360°",   color: "#facc15" },
        ].map(({ level, name, sub, color }) => (
          <button
            key={level}
            disabled
            className="flex items-center gap-4 rounded-2xl px-4 py-3 text-left opacity-60 cursor-not-allowed"
            style={{ background: "#0f172a", border: "1px solid #1e293b" }}
          >
            <span
              className="text-xs font-black w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: color, color: "#020617" }}
            >
              {level}
            </span>
            <div>
              <div className="text-white font-bold text-sm">{name}</div>
              <div className="text-slate-500 text-xs">{sub}</div>
            </div>
            <span className="ml-auto text-slate-600 text-xs">soon</span>
          </button>
        ))}
      </div>

      <p className="mt-10 text-slate-600 text-xs">Coming soon — in active development</p>
    </div>
  )
}
