// Sound module — copied from maths-distance-calculator and extended with
// playAngleTick() for the angle-sweep feedback.

let ctx: AudioContext | null = null;
let footToggle = false;
/** In dev, start muted so local runs don’t blast audio by default. */
let muted = import.meta.env.DEV;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, vol = 0.08, type: OscillatorType = "square") {
  if (muted) return;
  const c = ac();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.01);
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function noiseBurst(startTime: number, filterFreq: number, vol: number, dur: number) {
  if (muted) return;
  const c = ac();
  const bufLen = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.8;

  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(startTime);
  src.stop(startTime + dur + 0.01);
}

export function playStep() {
  if (muted) return;
  const t = ac().currentTime;
  footToggle = !footToggle;
  const side = footToggle ? 1 : -1;
  noiseBurst(t, 420 + side * 60, 0.28, 0.055);
  tone(footToggle ? 72 : 88, t, 0.09, 0.22, "sine");
  noiseBurst(t, 2800, 0.09, 0.018);
}

export function playCorrect() {
  const t = ac().currentTime;
  tone(110, t, 0.08, 0.18, "sine");
  tone(523.25, t, 0.12, 0.11, "square");
  tone(659.25, t + 0.06, 0.15, 0.1, "square");
  tone(783.99, t + 0.12, 0.15, 0.1, "square");
  tone(1046.5, t + 0.18, 0.22, 0.12, "square");
  tone(1318.5, t + 0.24, 0.28, 0.09, "triangle");
}

export function playWrong() {
  const t = ac().currentTime;
  tone(90, t, 0.1, 0.2, "sine");
  tone(440, t, 0.12, 0.12, "sawtooth");
  tone(349.23, t + 0.1, 0.15, 0.11, "sawtooth");
  tone(261.63, t + 0.2, 0.18, 0.1, "sawtooth");
  tone(196, t + 0.3, 0.22, 0.09, "sawtooth");
}

export function playLevelComplete() {
  const t = ac().currentTime;
  const melody = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
  melody.forEach((f, i) => tone(f, t + i * 0.12, 0.2, 0.09));
}

export function playSnap() {
  const t = ac().currentTime;
  tone(880, t, 0.06, 0.07, "square");
  tone(1108.7, t + 0.05, 0.08, 0.06, "square");
}

export function playButton() {
  const t = ac().currentTime;
  tone(659.25, t, 0.05, 0.06, "square");
  tone(783.99, t + 0.04, 0.05, 0.045, "square");
}

/** Subtle tick as gaze sweeps — pitch maps 200–800 Hz across 0°–360°. */
export function playAngleTick(angleDeg: number) {
  if (muted) return;
  const freq = 200 + (angleDeg / 360) * 600;
  tone(freq, ac().currentTime, 0.03, 0.045, "sine");
}

/** Short typewriter-style click for each character in the prompt typewriter. */
export function playTypewriterClick() {
  if (muted) return;
  const c = ac();
  const t = c.currentTime;
  // Noise burst (mechanical key body)
  const bufLen = Math.ceil(c.sampleRate * 0.018);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.25));
  const src = c.createBufferSource();
  src.buffer = buf;
  const flt = c.createBiquadFilter();
  flt.type = "bandpass";
  flt.frequency.value = 3200;
  flt.Q.value = 1.2;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.22, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
  src.connect(flt);
  flt.connect(gain);
  gain.connect(c.destination);
  src.start(t);
  src.stop(t + 0.02);
}

// ─── Background music ─────────────────────────────────────────────────────────

interface MusicPattern {
  melody: number[];
  bass: number[];
  bpm: number;
  melodyVol?: number;
  bassVol?: number;
  melodyType?: OscillatorType;
  bassType?: OscillatorType;
}

const MUSIC_PATTERNS: MusicPattern[] = [
  // "Overworld Chase" — C→G→Am→F chord arpeggios (I-V-vi-IV), 210 BPM
  {
    melody: [
      523.25, 659.25, 783.99, 659.25,  587.33, 783.99, 987.77, 783.99,
      523.25, 659.25, 880, 659.25,     523.25, 698.46, 880, 698.46,
    ],
    bass: [
      130.81, 0, 196.0, 0,  98.0, 0, 146.83, 0,
      110.0, 0, 164.81, 0,  87.31, 0, 130.81, 0,
    ],
    bpm: 210,
    melodyVol: 0.065,
    bassVol: 0.05,
    melodyType: "square",
    bassType: "square",
  },
  // "Star Sprint" — C major scale run ascending/descending, 215 BPM
  {
    melody: [
      523.25, 587.33, 659.25, 783.99, 880, 987.77, 880, 783.99,
      659.25, 587.33, 523.25, 493.88, 523.25, 659.25, 783.99, 1046.5,
    ],
    bass: [
      130.81, 0, 0, 0, 196.0, 0, 0, 0,
      130.81, 0, 0, 0, 130.81, 0, 196.0, 0,
    ],
    bpm: 215,
    melodyVol: 0.065,
    bassVol: 0.05,
    melodyType: "square",
    bassType: "triangle",
  },
  // "Power Up" — D major I-V (D→A) arpeggios, 205 BPM
  {
    melody: [
      587.33, 739.99, 880, 739.99,  440, 587.33, 739.99, 587.33,
      369.99, 493.88, 587.33, 493.88, 587.33, 739.99, 880, 1174.66,
    ],
    bass: [
      146.83, 0, 0, 0, 110.0, 0, 0, 0,
      92.50, 0, 0, 0, 146.83, 0, 0, 0,
    ],
    bpm: 205,
    melodyVol: 0.065,
    bassVol: 0.05,
    melodyType: "square",
    bassType: "square",
  },
  // "Coin Collect" — Am→F→C→G (vi-IV-I-V) arpeggios, 210 BPM
  {
    melody: [
      440, 523.25, 659.25, 880,    349.23, 440, 523.25, 698.46,
      523.25, 659.25, 783.99, 1046.5, 392.0, 493.88, 587.33, 783.99,
    ],
    bass: [
      110.0, 0, 0, 0, 87.31, 0, 0, 0,
      130.81, 0, 0, 0, 98.0, 0, 0, 0,
    ],
    bpm: 210,
    melodyVol: 0.065,
    bassVol: 0.05,
    melodyType: "square",
    bassType: "square",
  },
  // "Boss Run" — G major I-IV-V (G→C→D) arpeggios, 220 BPM
  {
    melody: [
      392.0, 493.88, 587.33, 783.99, 523.25, 659.25, 783.99, 523.25,
      587.33, 739.99, 880, 587.33,  783.99, 987.77, 783.99, 659.25,
    ],
    bass: [
      98.0, 0, 0, 0, 130.81, 0, 0, 0,
      73.42, 0, 0, 0, 98.0, 0, 0, 0,
    ],
    bpm: 220,
    melodyVol: 0.06,
    bassVol: 0.05,
    melodyType: "square",
    bassType: "square",
  },
  // "Galaxy Run" — Em→C→G→D (i-VI-III-VII) arpeggios, 215 BPM
  {
    melody: [
      659.25, 783.99, 987.77, 783.99,  523.25, 659.25, 783.99, 659.25,
      783.99, 987.77, 1174.66, 987.77,  587.33, 739.99, 880, 739.99,
    ],
    bass: [
      164.81, 0, 0, 0, 130.81, 0, 0, 0,
      196.0, 0, 0, 0, 146.83, 0, 0, 0,
    ],
    bpm: 215,
    melodyVol: 0.065,
    bassVol: 0.05,
    melodyType: "square",
    bassType: "square",
  },
];

let bgTimer: ReturnType<typeof setTimeout> | null = null;
let musicOn = false;
let step = 0;
let currentPattern: MusicPattern = MUSIC_PATTERNS[0];

function tick() {
  if (!musicOn) return;
  const t = ac().currentTime;
  const beat = 60 / currentPattern.bpm;
  const { melody, bass, melodyVol = 0.05, bassVol = 0.04,
          melodyType = "square", bassType = "triangle" } = currentPattern;

  if (melody[step]) tone(melody[step], t, beat * 0.7, melodyVol, melodyType);
  if (bass[step]) tone(bass[step], t, beat * 0.9, bassVol, bassType);

  step = (step + 1) % melody.length;
  bgTimer = setTimeout(tick, beat * 1000);
}

export function startMusic() {
  if (musicOn) return;
  currentPattern = MUSIC_PATTERNS[Math.floor(Math.random() * MUSIC_PATTERNS.length)];
  step = 0;
  musicOn = true;
  ac();
  tick();
}

export function shuffleMusic() {
  const others = MUSIC_PATTERNS.filter((p) => p !== currentPattern);
  currentPattern = others[Math.floor(Math.random() * others.length)];
  step = 0;
}

export function stopMusic() {
  musicOn = false;
  if (bgTimer) clearTimeout(bgTimer);
  bgTimer = null;
}

export function isMusicOn() {
  return musicOn;
}

// ─── Monster Round music & SFX ────────────────────────────────────────────────

const MONSTER_MUSIC_PATTERNS: MusicPattern[] = [
  {
    melody: [
      220, 0, 220, 246.94, 220, 0, 196, 0,
      196, 0, 174.61, 0, 196, 0, 220, 0,
    ],
    bass: [
      55, 0, 55, 0, 73.42, 0, 55, 0,
      49, 0, 43.65, 0, 49, 0, 55, 0,
    ],
    bpm: 160,
    melodyVol: 0.08,
    bassVol: 0.065,
    melodyType: "sawtooth",
    bassType: "square",
  },
  {
    melody: [
      146.83, 0, 164.81, 155.56, 146.83, 0, 130.81, 0,
      123.47, 0, 130.81, 0, 146.83, 164.81, 0, 0,
    ],
    bass: [
      73.42, 0, 0, 0, 73.42, 0, 61.74, 0,
      61.74, 0, 65.41, 0, 73.42, 0, 0, 0,
    ],
    bpm: 125,
    melodyVol: 0.07,
    bassVol: 0.08,
    melodyType: "square",
    bassType: "sawtooth",
  },
  {
    melody: [
      329.63, 0, 349.23, 0, 329.63, 293.66, 261.63, 0,
      261.63, 293.66, 329.63, 0, 349.23, 329.63, 293.66, 0,
    ],
    bass: [
      82.41, 0, 82.41, 0, 73.42, 0, 65.41, 0,
      65.41, 0, 73.42, 0, 82.41, 0, 87.31, 0,
    ],
    bpm: 155,
    melodyVol: 0.075,
    bassVol: 0.06,
    melodyType: "sawtooth",
    bassType: "triangle",
  },
];

export function switchToMonsterMusic() {
  currentPattern = MONSTER_MUSIC_PATTERNS[Math.floor(Math.random() * MONSTER_MUSIC_PATTERNS.length)];
  step = 0;
}

export function playMonsterStart() {
  const t = ac().currentTime;
  tone(55,      t,        0.18, 0.28, "sawtooth");
  tone(110,     t + 0.06, 0.15, 0.22, "sawtooth");
  tone(392,     t + 0.18, 0.14, 0.14, "square");
  tone(349.23,  t + 0.34, 0.14, 0.13, "square");
  tone(329.63,  t + 0.50, 0.14, 0.13, "square");
  tone(261.63,  t + 0.66, 0.38, 0.17, "sawtooth");
  noiseBurst(t + 0.66, 200, 0.15, 0.32);
}

export function playGameComplete() {
  const t = ac().currentTime;
  [0, 0.18, 0.36, 0.54, 0.72, 0.90].forEach((dt) => {
    noiseBurst(t + dt, 1200, 0.4,  0.07);
    noiseBurst(t + dt, 3500, 0.22, 0.05);
  });
  const notes: [number, number][] = [
    [1.1,  523.25], [1.28, 659.25], [1.46, 783.99], [1.64, 1046.5],
    [1.82, 1318.5], [2.0,  1567.98], [2.18, 2093],
    [2.4,  1760],   [2.55, 2093],   [2.7,  2349.32], [2.85, 2637.02],
  ];
  notes.forEach(([dt, freq]) => {
    tone(freq,     t + dt, 0.3,  0.12, "square");
    tone(freq / 2, t + dt, 0.3,  0.07, "triangle");
  });
  noiseBurst(t + 2.85, 1200, 0.5,  0.1);
  noiseBurst(t + 2.97, 3500, 0.28, 0.07);
  [1046.5, 1318.5, 1567.98, 2093].forEach((freq, i) => {
    tone(freq, t + 3.1 + i * 0.06, 1.5, 0.09, "triangle");
  });
}

export function playMonsterVictory() {
  const t = ac().currentTime;
  const clapTimes = [0, 0.22, 0.44, 0.58];
  clapTimes.forEach((dt) => {
    noiseBurst(t + dt, 1200, 0.35, 0.07);
    noiseBurst(t + dt, 3500, 0.18, 0.05);
  });
  const fanfare: [number, number][] = [
    [0.75, 523.25], [0.9,  659.25], [1.05, 783.99], [1.2, 1046.5],
    [1.35, 880],    [1.5,  1046.5], [1.65, 1318.5], [1.8, 1567.98],
  ];
  fanfare.forEach(([dt, freq]) => {
    tone(freq,     t + dt, 0.22, 0.11, "square");
    tone(freq / 2, t + dt, 0.22, 0.06, "triangle");
  });
  noiseBurst(t + 1.8, 1200, 0.4, 0.08);
  noiseBurst(t + 1.9, 3500, 0.22, 0.06);
  tone(1046.5, t + 2.1, 0.5, 0.10, "triangle");
  tone(1318.5, t + 2.1, 0.5, 0.08, "triangle");
  tone(1567.98, t + 2.1, 0.5, 0.07, "triangle");
}

export function playGoldenEgg() {
  const t = ac().currentTime;
  tone(880,    t,        0.08, 0.10, "square");
  tone(1108.7, t + 0.07, 0.10, 0.10, "square");
  tone(1318.5, t + 0.14, 0.12, 0.12, "triangle");
  tone(1760,   t + 0.21, 0.18, 0.10, "triangle");
  tone(2093,   t + 0.28, 0.22, 0.09, "triangle");
  noiseBurst(t + 0.33, 3500, 0.07, 0.18);
}

/** Whoosh — target deploying from cannon to its position. */
export function playTargetDeploy() {
  if (muted) return;
  const c = ac();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(620, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.48);
  gain.gain.setValueAtTime(0.11, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
  osc.start(t);
  osc.stop(t + 0.5);
  noiseBurst(t, 380, 0.06, 0.42);
}

/** Rocket launch — cannon fires a shot. */
export function playCannonFire() {
  if (muted) return;
  const c = ac();
  const now = c.currentTime;
  // ── Ignition crack ──
  const crackLen = Math.ceil(c.sampleRate * 0.08);
  const crackBuf = c.createBuffer(1, crackLen, c.sampleRate);
  const cd = crackBuf.getChannelData(0);
  for (let i = 0; i < crackLen; i++) {
    const t = i / c.sampleRate;
    cd[i] = (Math.random() * 2 - 1) * Math.exp(-t * 60);
  }
  const crackSrc = c.createBufferSource();
  crackSrc.buffer = crackBuf;
  const crackHp = c.createBiquadFilter();
  crackHp.type = "highpass"; crackHp.frequency.value = 1800;
  const crackG = c.createGain();
  crackG.gain.setValueAtTime(3.0, now);
  crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  crackSrc.connect(crackHp); crackHp.connect(crackG); crackG.connect(c.destination);
  crackSrc.start(now);
  // ── Rising whoosh / rocket roar ──
  const roarLen = Math.ceil(c.sampleRate * 0.55);
  const roarBuf = c.createBuffer(1, roarLen, c.sampleRate);
  const rd = roarBuf.getChannelData(0);
  for (let i = 0; i < roarLen; i++) {
    const t = i / c.sampleRate;
    const env = Math.min(1, t * 6) * Math.exp(-t * 2.2);
    rd[i] = (Math.random() * 2 - 1) * env;
  }
  const roarSrc = c.createBufferSource();
  roarSrc.buffer = roarBuf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(300, now + 0.02);
  lp.frequency.exponentialRampToValueAtTime(3500, now + 0.4);
  lp.Q.value = 1.2;
  const roarG = c.createGain();
  roarG.gain.setValueAtTime(2.2, now + 0.02);
  roarG.gain.linearRampToValueAtTime(0.001, now + 0.55);
  roarSrc.connect(lp); lp.connect(roarG); roarG.connect(c.destination);
  roarSrc.start(now + 0.02);
  // ── Low thrust rumble ──
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
  const thrustG = c.createGain();
  thrustG.gain.setValueAtTime(1.4, now);
  thrustG.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(thrustG); thrustG.connect(c.destination);
  osc.start(now); osc.stop(now + 0.3);
}

/** Explosion blast — projectile hits target. */
export function playExplosion() {
  if (muted) return;
  const c = ac();
  const now = c.currentTime;
  // ── Initial sharp crack ──
  const crackLen = Math.ceil(c.sampleRate * 0.06);
  const crackBuf = c.createBuffer(1, crackLen, c.sampleRate);
  const cd = crackBuf.getChannelData(0);
  for (let i = 0; i < crackLen; i++) {
    cd[i] = (Math.random() * 2 - 1) * Math.exp(-(i / c.sampleRate) * 80);
  }
  const crackSrc = c.createBufferSource();
  crackSrc.buffer = crackBuf;
  const crackBp = c.createBiquadFilter();
  crackBp.type = "bandpass"; crackBp.frequency.value = 2200; crackBp.Q.value = 0.6;
  const crackG = c.createGain();
  crackG.gain.setValueAtTime(4.0, now);
  crackSrc.connect(crackBp); crackBp.connect(crackG); crackG.connect(c.destination);
  crackSrc.start(now);
  // ── Deep bass boom ──
  const boom = c.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(70, now);
  boom.frequency.exponentialRampToValueAtTime(22, now + 0.9);
  const boomG = c.createGain();
  boomG.gain.setValueAtTime(4.0, now + 0.01);
  boomG.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  boom.connect(boomG); boomG.connect(c.destination);
  boom.start(now); boom.stop(now + 0.9);
  // ── Mid-range rumble ──
  const mid = c.createOscillator();
  mid.type = "sawtooth";
  mid.frequency.setValueAtTime(180, now + 0.02);
  mid.frequency.exponentialRampToValueAtTime(45, now + 0.45);
  const midG = c.createGain();
  midG.gain.setValueAtTime(1.8, now + 0.02);
  midG.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  mid.connect(midG); midG.connect(c.destination);
  mid.start(now + 0.02); mid.stop(now + 0.45);
  // ── Debris noise tail ──
  const debrisLen = Math.ceil(c.sampleRate * 0.7);
  const debrisBuf = c.createBuffer(1, debrisLen, c.sampleRate);
  const dd = debrisBuf.getChannelData(0);
  for (let i = 0; i < debrisLen; i++) {
    dd[i] = (Math.random() * 2 - 1) * Math.exp(-(i / c.sampleRate) * 5);
  }
  const debrisSrc = c.createBufferSource();
  debrisSrc.buffer = debrisBuf;
  const debrisLp = c.createBiquadFilter();
  debrisLp.type = "bandpass"; debrisLp.frequency.value = 600; debrisLp.Q.value = 0.9;
  const debrisG = c.createGain();
  debrisG.gain.setValueAtTime(1.5, now + 0.05);
  debrisG.gain.linearRampToValueAtTime(0.001, now + 0.7);
  debrisSrc.connect(debrisLp); debrisLp.connect(debrisG); debrisG.connect(c.destination);
  debrisSrc.start(now + 0.05);
}
