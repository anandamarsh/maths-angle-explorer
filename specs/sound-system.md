# Sound System

**File:** `src/sound/index.ts`

Web Audio API synthesis — no external audio files. All sounds generated in code
using oscillators and noise. Extended from the base template with angle-specific SFX.
Music is muted by default in development.

---

## Module-level state

```ts
let ctx: AudioContext | null = null;
let footToggle = false;          // alternates bass notes for walking feel
const SFX_GAIN = 2.2;            // SFX volume multiplier
const BG_GAIN = 0.25;            // background music volume multiplier
let muted = import.meta.env.DEV; // true in dev, false in production
```

`ac()` lazily creates the AudioContext and resumes it if suspended:
```ts
function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
```

`ensureAudioReady()` is called on the first user interaction to wake the AudioContext
before any SFX is needed (avoids the "suspended" state on first fire).

---

## Core primitives

### `tone(freq, start, dur, vol, type)`

Plays a single oscillator tone (SFX channel, always plays regardless of mute):
```ts
function tone(freq, start, dur, vol = 0.08, type: OscillatorType = "square")
// vol is scaled by SFX_GAIN
// Envelope: constant vol → exponential ramp to 0.001 at start+dur
```

### `musicTone(freq, start, dur, vol, type)`

Same as `tone` but respects `muted` (skips entirely if muted) and uses `BG_GAIN`.

### `noiseBurst(startTime, filterFreq, vol, dur)`

White noise through a bandpass filter. Used for percussive textures.
```ts
function noiseBurst(startTime, filterFreq, vol, dur)
// Creates random buffer → bandpass filter (Q=1.8) → gain with exponential ramp
```

---

## Exported SFX functions

### `playCannonFire()`

Sharp punch for when the cannon fires:
- Bass thump (sine, 80Hz)
- Two-tone noise bursts (mid + high frequency)
- Short descending whistle (sine, 1800→400Hz sweep)

### `playExplosion()`

Hit explosion at the target:
- Low rumble (sine, 55Hz)
- Mid crack (sawtooth, 440→220Hz)
- Two noise bursts (low + high frequency)

### `playCorrect()`

Ascending major chord progression (same as template):
```ts
tone(110,    t, 0.08, 0.18, "sine")      // bass thump
tone(523.25, t, 0.12, 0.11, "square")    // C5
tone(659.25, t+0.06, 0.15, 0.1, "square") // E5
tone(783.99, t+0.12, 0.15, 0.1, "square") // G5
tone(1046.5, t+0.18, 0.22, 0.12, "square") // C6
tone(1318.5, t+0.24, 0.28, 0.09, "triangle") // E6 fade
```

### `playWrong()`

Descending sawtooth buzzer:
```ts
tone(90,  t, 0.1, 0.2, "sine")           // low bass
tone(440, t, 0.12, 0.12, "sawtooth")     // A4
tone(349.23, t+0.1, 0.15, 0.11, "sawtooth") // F4
tone(261.63, t+0.2, 0.18, 0.1, "sawtooth")  // C4
tone(196, t+0.3, 0.22, 0.09, "sawtooth")    // G3
```

### `playAngleTick()`

Subtle click during cannon rotation (called ~10ms while dragging):
```ts
// Short noise burst + high-frequency tone
noiseBurst(t, 3200, 0.05, 0.012);
tone(2400, t, 0.015, 0.04, "square");
```

### `playSnap()`

Slightly louder tick for when the angle snaps to a landmark value:
```ts
noiseBurst(t, 2400, 0.12, 0.025);
tone(1800, t, 0.04, 0.09, "square");
```

### `playKeyClick()`

Sharp percussive tick for keypad button presses:
```ts
noiseBurst(t, 2600, 0.14, 0.02);
tone(1900, t, 0.026, 0.08, "square");
```

### `playTypewriterClick()`

Typewriter-style tick for the intro text animation:
```ts
noiseBurst(t, 1800, 0.08, 0.015);
tone(1200, t, 0.02, 0.05, "square");
```

### `playButton()`

Two-tone UI click for toolbar buttons:
```ts
tone(659.25, t, 0.05, 0.06, "square");
tone(783.99, t+0.04, 0.05, 0.045, "square");
```

### `playFlashDrop()`

Downward whoosh for the screen flash feedback:
```ts
// Sweeping sine oscillator from 600→200Hz over 0.22s
tone(600, t, 0.22, 0.1, "sine");
```

### `playTargetDeploy()`

Two-tone blip when the target appears:
```ts
tone(880, t, 0.06, 0.08, "sine");
tone(1100, t+0.07, 0.08, 0.09, "sine");
```

### `playMonsterStart()`

Dramatic announcement stab for the Monster/Platinum round banner:
```ts
// Low bass drone + three ascending tones with noise burst
tone(55, t, 0.4, 0.15, "sine");
tone(220, t+0.05, 0.25, 0.1, "sawtooth");
tone(440, t+0.15, 0.3, 0.08, "sawtooth");
tone(660, t+0.25, 0.35, 0.06, "square");
noiseBurst(t, 800, 0.2, 0.1);
```

### `playMonsterVictory()`

Victory fanfare for clearing the monster round:
```ts
// 6-note ascending melody with bass
const melody = [523.25, 659.25, 783.99, 880, 1046.5, 1318.5];
melody.forEach((f, i) => tone(f, t + i * 0.1, 0.18, 0.09, "square"));
tone(130.81, t, 0.5, 0.12, "triangle");
```

### `playGoldenEgg()`

Bright sparkle for collecting a star in normal mode:
```ts
tone(1046.5, t, 0.12, 0.1, "sine");
tone(1318.5, t+0.05, 0.1, 0.08, "triangle");
```

### `playGameComplete()`

All-levels-cleared celebration — extended melody + bass:
```ts
// 8-note melody at 0.13s intervals, with bass drone underneath
const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 1568];
melody.forEach((f, i) => tone(f, t + i * 0.13, 0.22, 0.1, "square"));
tone(130.81, t, 1.1, 0.13, "sine");
```

### `playLevelComplete()`

6-note level complete melody (also used per star in earlier template — here used only
for level completion):
```ts
const melody = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
melody.forEach((f, i) => tone(f, t + i * 0.12, 0.2, 0.09));
```

---

## Mute controls

```ts
export function toggleMute(): boolean  // toggles muted, returns new state
export function isMuted(): boolean     // current muted state
export function ensureAudioReady(): void  // wakes AudioContext
```

`toggleMute` controls both SFX and music (unlike template which only mutes music).
SFX use `tone()` which always plays regardless of `muted` — this is intentional to
keep the sound engine responsive. Only background music uses `musicTone()` which
respects `muted`.

---

## Background music

Same 4-pattern system as the template. `startMusic()`, `shuffleMusic()`, `stopMusic()`,
and the tick loop are identical. Music is managed at module level (not React state).

```ts
interface MusicPattern {
  melody: number[];
  bass: number[];
  bpm: number;
  melodyVol?: number;
  bassVol?: number;
  melodyType?: OscillatorType;
  bassType?: OscillatorType;
}
```

### `switchToMonsterMusic()`

Switches to a higher-tempo pattern (pattern 4, bpm 170) when the monster round begins.
Restores normal pattern selection after the round.

---

## Usage pattern

```ts
import { isMuted, toggleMute, ensureAudioReady,
         playCorrect, playWrong, playCannonFire, playExplosion,
         playAngleTick, playSnap, playKeyClick, playButton,
         playMonsterStart, playMonsterVictory, playGoldenEgg,
         playGameComplete, playTargetDeploy, playFlashDrop,
         playTypewriterClick, playLevelComplete,
         startMusic, shuffleMusic, switchToMonsterMusic } from "../sound";

// First user interaction:
ensureAudioReady();
startMusic();

// Dragging the cannon:
// (called every TICK_INTERVAL ms while dragging)
playAngleTick();

// On angle snap:
playSnap();
```
