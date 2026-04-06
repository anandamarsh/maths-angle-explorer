# Automated Testing Guidelines — Angle Explorer

> This document describes the autopilot / automated playthrough feature.
> It reads like a manual QA script but is executed programmatically by
> `useAutopilot.ts` and can be verified by `tests/autopilot.spec.ts`.

---

## Cheat Codes

| Code     | Action |
|----------|--------|
| `197879` | **Show Answer** — types the correct answer into the keypad display (one-off, does not start autopilot) |
| `198081` | **Toggle Autopilot** — activates or deactivates autopilot mode |

Type the digits consecutively on the keyboard. Non-digit keys reset the buffer.
When a code matches, `stopImmediatePropagation()` fires so the final digit is not processed by the game.

---

## Step 1 — Activate Autopilot

1. Game is open and in any play state.
2. User types `198081` on the keyboard.
3. **VERIFY:** A green blinking robot icon appears in the top-right toolbar.
4. **VERIFY:** Icon pulses in a fade-in → stay → fade-out cycle (~2 s period).

---

## Step 2 — Aiming Phase (autopilot rotates cannon)

1. Wait `500–900 ms` before starting (human "noticing" delay).
2. Interpolate cannon angle from current position to target angle over `900–1500 ms` using easeOutCubic.
3. Move phantom hand (green) to track the cannon beam endpoint as it sweeps.
4. 20% of the time, aim at a **wrong angle** (correct ± 15–30°).
5. Wait `600–1100 ms` (simulated reading/thinking time).

**VERIFY:** Cannon barrel visibly rotates toward the target angle.
**VERIFY:** Phantom hand tracks the beam endpoint during rotation.

---

## Step 3 — Answering Phase (autopilot types and submits)

1. Move phantom hand to the first digit button.
2. For each digit of the chosen answer:
   a. Move phantom hand to that digit button (`data-autopilot-key="<digit>"`).
   b. Dispatch `el.click()` — fires full `press()` handler (sound + display update).
   c. Wait `320–600 ms` before next digit.
3. For negative angles: click `±` button first (`data-autopilot-key="±"`).
4. Wait `400–700 ms` then move hand to submit/fire button.
5. Click fire button (`data-autopilot-key="submit"`).

**VERIFY:** Keypad display shows digits being typed one by one with tick sounds.
**VERIFY:** 20% of answers are incorrect (wrong answer submitted, counted in accuracy).
**VERIFY:** Shot animation fires.

---

## Step 4 — Feedback Phase

1. Shot animation plays (~400 ms travel + 1000 ms hit resolve).
2. Autopilot does nothing during this phase — the game timer handles progression.
3. On correct: egg earned, next question loads → back to Step 2.
4. On wrong: egg lost, same question repeats → back to Step 2.

**VERIFY:** Explosion appears on correct answer.
**VERIFY:** Egg counter updates.

---

## Step 5 — Round Transitions

**Normal → Monster Round (10 eggs collected):**
- Autopilot does nothing; game auto-transitions (ROUND_ANNOUNCE_MS = 4.2 s).
- **VERIFY:** Monster round announcement screen appears.
- After announcement, autopilot resumes aiming for new question.

**Monster → Platinum Round (10 monster eggs):**
- Same as above.
- **VERIFY:** Platinum round announcement screen appears.
- In Platinum round: cannon is hidden initially; autopilot still rotates it and types.

**All 3 rounds = Level Complete.**

---

## Step 6 — Level Complete

When all eggs are collected, game enters level complete and shows `SessionReportModal`.

1. Wait `2000–3200 ms` (simulated reading delay).
2. Move phantom hand to email input (`data-autopilot-key="email-input"`).
3. Click email input to focus; clear any existing value.
4. Type `AUTOPILOT_EMAIL` character by character (`8–15 ms` per character).
5. Wait `700–1100 ms` after last character.
6. Move phantom hand to send button (`data-autopilot-key="email-send"`).
7. Click send — dispatches report email with PDF attachment.
8. Wait `3600–5000 ms`.
9. **If level < 2:**
   - Move hand to **Next Level** button (`data-autopilot-key="next-level"`).
   - Click it — game advances to Level 2.
   - Autopilot resumes at Step 2 for Level 2.
10. **If level = 2 (final):**
    - Halt autopilot (robot icon disappears).
    - Leave the Level 2 modal visible for the user.

**VERIFY:** Email sent to `AUTOPILOT_EMAIL` (set via `VITE_AUTOPILOT_EMAIL` env var).
**VERIFY:** At Level 1 end, hand clicks "Next Level" and game advances.
**VERIFY:** At Level 2 end, robot icon disappears; modal stays on screen.
**VERIFY:** Level 2 report includes questions from both Level 1 and Level 2 (cumulative, via `continueSession()`).

---

## Step 7 — Cancel Autopilot

**Option A — click robot icon:**
1. Click the green robot icon in the toolbar.
2. **VERIFY:** Icon disappears.
3. **VERIFY:** Phantom hand disappears.
4. **VERIFY:** All scheduled timers are cancelled.
5. **VERIFY:** Game remains in current phase, ready for manual play.

**Option B — type `198081` again:**
1. Type `198081` on keyboard while autopilot is active.
2. Same verification as Option A.

---

## Timing Reference

| Action | Delay |
|--------|-------|
| Before starting aim | 500–900 ms |
| Cannon rotation duration | 900–1500 ms |
| After aim, before typing | 600–1100 ms |
| Between keypad digits | 320–600 ms |
| Before submitting answer | 400–700 ms |
| Before typing email | 2000–3200 ms |
| Between email characters | 8–15 ms |
| After last email char, before send | 700–1100 ms |
| After send, before Next Level | 3600–5000 ms |

All ranges are uniformly random to simulate human timing variation.

---

## Environment

Set `VITE_AUTOPILOT_EMAIL` in `.env.local` to the desired report recipient:

```
VITE_AUTOPILOT_EMAIL=parent@example.com
```

If not set, autopilot skips email sending and proceeds directly to Next Level.

---

## Implementing Autopilot in a New Game

1. Copy these files:
   - `src/hooks/useCheatCodes.ts`
   - `src/hooks/useAutopilot.ts`
   - `src/components/PhantomHand.tsx`
   - `src/components/AutopilotIcon.tsx`
2. Add `@keyframes autopilot-blink` to `index.css`.
3. Add `data-autopilot-key` attributes to interactive elements:
   - `data-autopilot-key="<digit>"` on each digit button (0–9)
   - `data-autopilot-key="±"` on the negative-sign toggle
   - `data-autopilot-key="submit"` on the fire/submit button
   - `data-autopilot-key="email-input"` on the email input in the report modal
   - `data-autopilot-key="email-send"` on the send button in the report modal
   - `data-autopilot-key="next-level"` on the Next Level / Play Again button
4. In your game screen component:
   - Create `autopilotCallbacksRef` with: `commitAimAngle`, `setCalcValue`, `submitAnswer`, `goNextLevel`, `playAgain`, `emailModalControls`, `onAutopilotComplete`.
   - Call `useAutopilot({ gameState, callbacksRef, svgRef, autopilotEmail })`.
   - Call `useCheatCodes({ "198081": toggle })`.
   - Render `<PhantomHand pos={phantomPos} />` as a fixed overlay.
   - Render `<AutopilotIcon onClick={deactivate} />` when `isAutopilot`.
5. In your report modal:
   - Accept `autopilotControlsRef` prop; on mount populate it with `{ appendChar, setEmail, triggerSend }`.
6. Set `VITE_AUTOPILOT_EMAIL` env var to desired recipient.
7. Run `tests/autopilot.spec.ts` to verify end-to-end.
