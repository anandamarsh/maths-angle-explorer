# Autopilot Mode

**Files:**
- `src/hooks/useAutopilot.ts` — engine
- `src/components/PhantomHand.tsx` — visual cursor overlay
- `src/components/AutopilotIcon.tsx` — blinking robot icon in toolbar

---

## What it does

Plays the game autonomously — typing angle answers on the keypad, sending the email
report, and proceeding to the next level — in a loop. Simulates human-like timing with
randomised delays. Deliberately misses ~20% of answers.

Key difference from template: **Angle Explorer has no canvas tap phase**. The game
goes straight to typing (there is no ripple/tap interaction). The autopilot skips
directly to `scheduleAim()` when in the `"aiming"` phase.

Two modes:
- **`"continuous"`** — plays indefinitely, loops back after final level
- **`"single-question"`** — plays one answer cycle, then stops

---

## Activation

- Cheat code `198081` (keyboard) → toggles continuous autopilot on/off
- Cheat code `197879` → shows and submits correct answer once (not full autopilot)
- Robot button click (autopilot inactive) → starts `"single-question"` mode
- Robot button click (autopilot active) → stops autopilot

---

## Timing constants (`T`)

```ts
const T = {
  AIM_FIRST:   [500, 900],    // "thinking" pause before starting to type
  KEY_BETWEEN: [320, 600],    // between each keypad digit press
  PRE_SUBMIT:  [400, 700],    // pause before pressing Fire (submit)
  EMAIL_CLICK: [2000, 3200],  // after modal appears, before typing email
  EMAIL_CHAR:  [8, 15],       // between each email character
  SEND_PAUSE:  [700, 1100],   // after last email char, before clicking Send
  END_PAUSE:   [3600, 5000],  // after send, before clicking Next Level
};
```

Note: there are no `TAP_FIRST` or `TAP_BETWEEN` constants because the autopilot
never interacts with the canvas (no drag or tap phase in this game).

---

## Wrong answer generation

```ts
const WRONG_ANSWER_RATE = 0.2;    // 20% chance
const MAX_WRONG_PER_STAGE = 2;    // max wrong answers per stage (resets at level end)

function wrongAnswer(correct: number): number {
  // Large offsets (±15–30°) rather than small ±1–3 from template
  const offsets = [-30, -20, 15, 20, 30, -15];
  const offset = offsets[Math.floor(Math.random() * offsets.length)];
  return correct + offset;
}
```

`wrongCountRef` tracks wrong answers in the current stage and resets in `scheduleLevelEnd`.
Once `MAX_WRONG_PER_STAGE` is reached, the autopilot always answers correctly.

---

## Interfaces

### `AutopilotGamePhase`

```ts
export type AutopilotGamePhase = "aiming" | "feedback" | "levelComplete";
```

Simpler than the template's phases — no `"tapping"` or `"answering"` split because
the game always accepts typed input during the `"aiming"` phase.

### `AutopilotCallbacks`

Must be populated by the screen every render:
```ts
export interface AutopilotCallbacks {
  setCalcValue: (v: string) => void;     // set keypad display value directly
  playKeyPress: () => void;              // SFX for each digit typed
  submitAnswer: () => void;              // calls handleFire()
  goNextLevel: () => void;
  playAgain: () => void;
  emailModalControls: React.MutableRefObject<ModalAutopilotControls | null>;
  onAutopilotComplete?: () => void;
}
```

Note: no `simulateTap` or `restartAll` — the angle explorer autopilot does not tap the
canvas and does not loop back to restart (it stops after final level).

### `ModalAutopilotControls`

```ts
export interface ModalAutopilotControls {
  appendChar: (ch: string) => void;
  setEmail: (v: string) => void;
  triggerSend: () => Promise<void>;  // async — autopilot awaits send before next level
}
```

### `AutopilotGameState`

```ts
interface AutopilotGameState {
  phase: AutopilotGamePhase;
  correctAnswer: number;    // the correct angle for the current question
  level: number;
  levelCount: number;
}
```

### `UseAutopilotArgs`

```ts
interface UseAutopilotArgs {
  gameState: AutopilotGameState;
  callbacksRef: React.RefObject<AutopilotCallbacks | null>;
  autopilotEmail: string;
  mode?: "continuous" | "single-question";  // default "continuous"
}
```

---

## Hook API

```ts
export function useAutopilot(args: UseAutopilotArgs): {
  isActive: boolean;
  activate: () => void;
  deactivate: () => void;
  phantomPos: PhantomPos | null;
}
```

The hook:
- Maintains `isActive` state + `isActiveRef` (so callbacks can check without closure issues)
- Maintains `timersRef` (all scheduled `setTimeout` IDs, cleared on deactivate)
- Watches `[isActive, gameState.phase]` — re-schedules actions on every phase change
- Maintains `wrongCountRef` — resets to 0 at level end

---

## Phase scheduling

### `scheduleAim()` → `scheduleTyping(targetAngle, startDelay)`

Called when `phase === "aiming"`:

```ts
function scheduleAim() {
  const { correctAnswer } = stateRef.current;
  const canGoWrong = wrongCountRef.current < MAX_WRONG_PER_STAGE;
  const isWrong = canGoWrong && Math.random() < WRONG_ANSWER_RATE;
  if (isWrong) wrongCountRef.current += 1;
  const targetAngle = isWrong ? wrongAnswer(correctAnswer) : correctAnswer;
  scheduleTyping(targetAngle, rand(T.AIM_FIRST));
}
```

```ts
function scheduleTyping(targetAngle: number, startDelay: number) {
  const isNeg = targetAngle < 0;
  const digits = String(Math.round(Math.abs(targetAngle))).split("");
  let delay = startDelay;

  // Pre-position hand at first key
  after(delay - 300, () => {
    const firstKey = isNeg ? "±" : digits[0];
    const rect = getKeyRect(firstKey);
    if (rect) moveHand(rect.left + rect.width/2, rect.top + rect.height/2);
  });

  // Clear display just before typing
  after(delay - 100, () => {
    callbacksRef.current?.setCalcValue("");
  });

  // Negative sign
  if (isNeg) {
    after(delay, () => {
      const el = document.querySelector('[data-autopilot-key="±"]');
      if (el) { const r = el.getBoundingClientRect(); clickAt(r.left + r.width/2, r.top + r.height/2); }
      callbacksRef.current?.playKeyPress();
      callbacksRef.current?.setCalcValue("-0");
    });
    delay += rand(T.KEY_BETWEEN);
  }

  // Each digit — sets full accumulated value directly (avoids stale closure)
  let built = "";
  for (const d of digits) {
    built = built === "" ? d : built + d;
    const typedValue = isNeg ? `-${built}` : built;
    after(delay, () => {
      const el = document.querySelector(`[data-autopilot-key="${d}"]`);
      if (el) { const r = el.getBoundingClientRect(); clickAt(r.left + r.width/2, r.top + r.height/2); }
      callbacksRef.current?.playKeyPress();
      callbacksRef.current?.setCalcValue(typedValue);
    });
    delay += rand(T.KEY_BETWEEN);
  }

  // Move to submit, then fire
  delay += rand(T.PRE_SUBMIT);
  after(delay - 300, () => {
    const rect = getKeyRect("submit");
    if (rect) moveHand(rect.left + rect.width/2, rect.top + rect.height/2);
  });
  after(delay, () => {
    const rect = getKeyRect("submit");
    if (rect) clickAt(rect.left + rect.width/2, rect.top + rect.height/2);
    window.setTimeout(() => {
      if (!isActiveRef.current) return;
      callbacksRef.current?.submitAnswer();
      setPhantomPos(null);
      if (mode === "single-question") {
        isActiveRef.current = false;
        setIsActive(false);
        callbacksRef.current?.onAutopilotComplete?.();
      }
    }, 140);
  });
}
```

### `scheduleLevelEnd()`

```ts
function scheduleLevelEnd() {
  wrongCountRef.current = 0;  // reset for next stage
  const email = autopilotEmail;
  if (!email) {
    // No email — just advance to next level after END_PAUSE
    after(rand(T.END_PAUSE), () => {
      const { level, levelCount } = stateRef.current;
      if (level < levelCount) callbacksRef.current?.goNextLevel();
      else { isActiveRef.current = false; setIsActive(false); callbacksRef.current?.onAutopilotComplete?.(); }
    });
    return;
  }
  // Email sequence: click input → type → send → await → next level
  // (same structure as template but triggerSend() is awaited async)
}
```

When `triggerSend()` is called, it returns a `Promise<void>`. The autopilot awaits it
before proceeding to Next Level. This is different from the template where `triggerSend`
is synchronous.

---

## Helper functions

```ts
function getKeyRect(key: string): DOMRect | null
// Finds element by data-autopilot-key and returns bounding rect.

function moveHand(x, y)
// Sets phantomPos without isClicking.

function clickAt(x, y)
// Sets phantomPos with isClicking=true, reverts after 130ms.

function after(ms, fn)
// Schedules fn after ms, cancels if isActive becomes false.
// Pushes timer ID to timersRef.
```

---

## `PhantomHand` component

```tsx
interface PhantomHandProps {
  pos: PhantomPos | null;  // null = hidden
}

export interface PhantomPos {
  x: number;         // screen pixel X
  y: number;         // screen pixel Y
  isClicking: boolean;
}
```

When visible:
- Fixed position at `(pos.x - 12, pos.y - 8)`
- `z-index: 200`, `pointer-events: none`
- Green hand SVG with drop-shadow: `0 0 12px rgba(0, 255, 100, 0.7)`
- `isClicking`: scale down to 0.85 with `transition: transform 100ms`

Rendered **outside** the main game div so it floats above all z-index layers.

---

## `AutopilotIcon` component

```tsx
interface AutopilotIconProps {
  onClick: () => void;
  active: boolean;       // whether autopilot/demo is running
  title: string;
  ariaLabel: string;
}
```

Robot emoji `🤖` in a circular button.

When `active`:
- `animation: autopilot-blink 2s ease-in-out infinite`
- Cyan glow (from `index.css` `@keyframes autopilot-blink`)

When inactive: normal `.arcade-button` style (orange).

---

## Integration checklist

1. Call `useAutopilot` with `gameState`, `callbacksRef`, `autopilotEmail`.
2. Populate `autopilotCallbacksRef.current` every render with all 7 callbacks.
3. Pass `autopilotControlsRef` to `SessionReportModal` when autopilot is active.
4. Render `<PhantomHand pos={phantomPos} />` **outside** the main game div.
5. Add `data-autopilot-key` to all keypad digit buttons, submit button, email input,
   email send button, and Next Level button.
6. Pass `forceKeypadExpanded` to keep keypad open during autopilot typing.
