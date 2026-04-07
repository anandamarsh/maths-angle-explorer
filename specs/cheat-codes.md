# Cheat Code System

**File:** `src/hooks/useCheatCodes.ts`

---

## How it works

A global `keydown` listener (capture phase) accumulates digit keypresses into a
rolling buffer (max 12 characters). When the buffer ends with a registered code string,
the handler fires and the buffer resets.

Non-digit keys (except modifier keys) reset the buffer.

```ts
const BUFFER_MAX = 12;
const PASSTHROUGH_KEYS = new Set([
  "Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "NumLock",
]);

export function useCheatCodes(handlers: Record<string, () => void>): void
```

`handlers` is a map from code string → callback. The hook uses a ref so the handler
map is always current without re-attaching the listener.

The listener uses `{ capture: true }` priority and calls `e.stopImmediatePropagation()`
when a code fires — preventing the triggering digit from reaching other listeners
(e.g. the keypad).

---

## Standard codes

| Code | Action |
|------|--------|
| `198081` | Toggle continuous autopilot on/off |
| `197879` | Submit the correct answer immediately (aiming phase only) |

### `197879` — show answer implementation

```ts
"197879": () => {
  const correct = String(questionRef.current.answer);
  setAnswer(correct);
  setCheatAnswerUnlocked(true);  // reveals the angle in the scene
  requestAnimationFrame(() => handleFire());
}
```

`cheatAnswerUnlocked=true` causes the scene to show `revealedAngle` (the correct angle
highlighted in green) before firing. The cannon also animates to the correct angle.

### `198081` — toggle autopilot implementation

```ts
"198081": () => {
  singleQuestionDemoRef.current = false;
  if (isAutopilot && autopilotMode === "continuous") {
    deactivateAutopilot();
  } else {
    if (isAutopilot) deactivateAutopilot();
    setAutopilotMode("continuous");
    setAnswer("");
    activateAutopilot();
  }
}
```

---

## Adding game-specific codes

```ts
useCheatCodes({
  "197879": () => { /* show answer */ },
  "198081": () => { /* toggle autopilot */ },
  "111222": () => { /* custom shortcut */ },
});
```

Codes are any string of digits up to 12 characters.
Shorter codes fire more easily — avoid codes that are substrings of other registered codes.
