# Game Loop

**File:** `src/screens/ArcadeAngleScreen.tsx`

This is the main game screen. It owns all game state and coordinates every subsystem.
It is self-contained — there is no shared `GameLayout` component; the layout is defined
inline. The screen is large (~1600+ lines) and includes both the state machine and all
SVG sub-components.

---

## Top-level screens

```ts
type Screen = "playing" | "won" | "gameover";
```

- `"playing"` — normal game in progress
- `"won"` — all levels cleared (shows celebration and session modal)
- `"gameover"` — reserved for future use

---

## Round phases

Within each level, gameplay cycles through three round types:

```ts
type GamePhase = "normal" | "platinum" | "monster";
```

| Phase | What happens |
|-------|-------------|
| `"normal"` | Standard play. Player drags cannon to aim then fires. Stars fill as correct answers accumulate. |
| `"platinum"` | Player must **type** the exact angle on the keypad (no drag aim). Announced before it begins. |
| `"monster"` | High-pressure multi-shot sequence. Same maths, increased urgency. Announced with a cinematic banner. |

Order within a level: normal rounds → platinum round → monster round → level complete.

---

## Intro phase animation

Every new question begins with a short intro animation sequence:

```ts
type IntroPhase = "origin" | "deploy" | "typing" | "done";
```

| Phase | What happens | Duration |
|-------|-------------|----------|
| `"origin"` | Cannon resets to start position | immediate |
| `"deploy"` | Target deploys to its position (animated) | `DEPLOY_MS` = 900ms |
| `"typing"` | Question text types in character by character | variable |
| `"done"` | Player can interact | — |

`introKey` is bumped to restart the animation for the same question (e.g. after a wrong answer reset).

---

## State variables

```ts
// Navigation
const [level, setLevel] = useState<1 | 2>(initialLevel);
const [unlockedLevel, setUnlockedLevel] = useState<1 | 2>(initialLevel);
const [screen, setScreen] = useState<"playing" | "won" | "gameover">("playing");

// Round
const [currentQ, setCurrentQ] = useState<AngleQuestion>(() => makeQuestion(initialLevel));
const [gamePhase, setGamePhase] = useState<"normal" | "monster" | "platinum">("normal");
const [eggsCollected, setEggsCollected] = useState(0);     // normal-round stars
const [monsterEggs, setMonsterEggs] = useState(0);          // monster-round stars

// Aiming
const [gazeAngle, setGazeAngle] = useState(() => currentQ.startAngleDeg ?? 0);
const [dragging, setDragging] = useState(false);
const [answer, setAnswer] = useState("");                    // keypad display value
const [revealedAngle, setRevealedAngle] = useState<number | null>(null); // shown after cheat

// Firing
const [isFiring, setIsFiring] = useState<{ t: number; hit: boolean; targetRadius: number } | null>(null);
const [shotT, setShotT] = useState(0);                      // 0→1 animation progress
const [explosion, setExplosion] = useState<{ x: number; y: number } | null>(null);

// Feedback
const [flash, setFlash] = useState<{ color: string; key: number } | null>(null);

// Announcements
const [monsterRoundName, setMonsterRoundName] = useState("");
const [showMonsterAnnounce, setShowMonsterAnnounce] = useState(false);

// Tutorial state
const [hasDiscoveredCannonDrag, setHasDiscoveredCannonDrag] = useState(false);
const [typedAimTutorialStage, setTypedAimTutorialStage] = useState<"hidden"|"step1"|"step2"|"done">("hidden");
const [hasSeenFirstFireTutorial, setHasSeenFirstFireTutorial] = useState(false);
const [firstFireTutorialReady, setFirstFireTutorialReady] = useState(false);
const [tutorialAngle, setTutorialAngle] = useState(0);
const [tutorialHintVisible, setTutorialHintVisible] = useState(false);
const [openingTutorialEnabled, setOpeningTutorialEnabled] = useState(true);

// Intro animation
const [introPhase, setIntroPhase] = useState<IntroPhase>("origin");
const [deployT, setDeployT] = useState(0);
const [panelVisible, setPanelVisible] = useState(false);
const [typeIdx, setTypeIdx] = useState(0);
const [introKey, setIntroKey] = useState(0);

// UI
const [minimized, setMinimized] = useState(false);          // keypad minimized
const [firePressed, setFirePressed] = useState(false);
const [glowKeys, setGlowKeys] = useState<string[]>([]);    // keypad flash highlight
const [showShareDrawer, setShowShareDrawer] = useState(false);
const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
const [isCompactViewport, setIsCompactViewport] = useState(...);
const [isTouchInput, setIsTouchInput] = useState(...);
const [isMobileLandscape, setIsMobileLandscape] = useState(...);
const [soundMuted, setSoundMuted] = useState(() => isMuted());

// Autopilot
const [autopilotMode, setAutopilotMode] = useState<"continuous" | "single-question">("continuous");
const [demoRetryPending, setDemoRetryPending] = useState(false);
const [cheatAnswerUnlocked, setCheatAnswerUnlocked] = useState(false);

// Session
const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
```

---

## Key refs (avoid stale closures)

```ts
const autopilotCallbacksRef = useRef<AutopilotCallbacks | null>(null);
const modalControlsRef = useRef<ModalAutopilotControls | null>(null);
const singleQuestionDemoRef = useRef(false);
const questionRef = useRef(currentQ);          // always-current question
questionRef.current = currentQ;
```

---

## Core functions

### `startNewQuestion(lv: 1 | 2, ph: GamePhase)`

```ts
function startNewQuestion(lv: 1 | 2, ph: GamePhase) {
  const q = makeQuestion(lv);
  setCurrentQ(q);
  setGazeAngle(q.startAngleDeg ?? 0);
  setAnswer("");
  setRevealedAngle(null);
  setIsFiring(null);
  setExplosion(null);
  setIntroPhase("origin");
  setIntroKey(k => k + 1);   // restarts intro animation
  startQuestionTimer();
}
```

### `handleFire()`

Called by the Fire button or autopilot. Evaluates the current aim angle against
the question's correct angle.

```ts
function handleFire() {
  if (introPhase !== "done") return;  // don't fire during intro
  if (isFiring) return;               // don't double-fire

  const q = questionRef.current;
  const correct = q.answer;
  const typedValue = parseFloat(answer);
  const isTyped = answer !== "";       // player typed an answer

  // Choose evaluation: typed answers use TYPED_TOL, dragged use ANGLE_HIT_TOL
  const hit = isTyped
    ? Math.abs(typedValue - correct) <= TYPED_TOL
    : angleDiffDeg(gazeAngle, correct) <= ANGLE_HIT_TOL;

  const targetRadius = L1_TARGET_RADIUS; // used for projectile animation
  setIsFiring({ t: 0, hit, targetRadius });
  playCannonFire();

  // After shot animation resolves:
  setTimeout(() => {
    setExplosion(hit ? clampedBeamEndpoint(correct) : null);
    if (hit) {
      playExplosion();
      setFlash({ color: "#22c55e", key: Date.now() });
      handleCorrect(q);
    } else {
      playWrong();
      setFlash({ color: "#ef4444", key: Date.now() });
      handleWrong(q);
    }
    setIsFiring(null);
  }, SHOT_TRAVEL_MS + HIT_RESOLVE_MS);
}
```

### `handleCorrect(q: AngleQuestion)`

Logs the attempt, awards a star, and advances to the next question or phase.

```ts
function handleCorrect(q: AngleQuestion) {
  if (!singleQuestionDemoRef.current) {
    logAttempt({ prompt: q.prompt, level, correctAnswer: q.answer,
                 childAnswer: parseFloat(answer) || Math.round(gazeAngle),
                 isCorrect: true, gamePhase, sectorArcs: q.sectorArcs, ... });
  }
  playCorrect();

  if (gamePhase === "normal") {
    const newEggs = eggsCollected + 1;
    setEggsCollected(newEggs);
    if (newEggs >= LEVEL_TARGET_COUNT) {
      // Transition to platinum round
      triggerPlatinumRound();
    } else {
      startNewQuestion(level, "normal");
    }
  } else if (gamePhase === "platinum") {
    triggerMonsterRound();
  } else {
    // monster round
    const newMonster = monsterEggs + 1;
    setMonsterEggs(newMonster);
    if (newMonster >= monsterTargetCount) {
      triggerLevelComplete();
    } else {
      startNewQuestion(level, "monster");
    }
  }
}
```

### `handleWrong(q: AngleQuestion)`

```ts
function handleWrong(q: AngleQuestion) {
  if (!singleQuestionDemoRef.current) {
    logAttempt({ ..., isCorrect: false, ... });
  }
  // Reset aim angle, increment miss counter
  setAnswer("");
  setGazeAngle(q.startAngleDeg ?? 0);
  setIntroKey(k => k + 1);  // replay intro animation for same question
}
```

### `triggerPlatinumRound()`

Announces the platinum round and then starts it:
```ts
function triggerPlatinumRound() {
  const name = pick(PLATINUM_ROUND_NAMES);
  setMonsterRoundName(name);
  setShowMonsterAnnounce(true);
  setTimeout(() => {
    setShowMonsterAnnounce(false);
    setGamePhase("platinum");
    startNewQuestion(level, "platinum");
  }, ROUND_ANNOUNCE_MS);
}
```

### `triggerMonsterRound()`

Same structure as platinum:
```ts
function triggerMonsterRound() {
  const name = pick(MONSTER_ROUND_NAMES);
  setMonsterRoundName(name);
  setShowMonsterAnnounce(true);
  setTimeout(() => {
    setShowMonsterAnnounce(false);
    setGamePhase("monster");
    startNewQuestion(level, "monster");
  }, ROUND_ANNOUNCE_MS);
}
```

### `triggerLevelComplete()`

Builds the session summary and shows the modal:
```ts
function triggerLevelComplete() {
  playLevelComplete();
  setUnlockedLevel(u => Math.min(u + 1, LEVEL_COUNT) as 1 | 2);
  const summary = buildSummary({
    playerName: "Explorer",
    level,
    normalEggs: eggsCollected,
    monsterEggs,
    levelCompleted: true,
    monsterRoundCompleted: true,
  });
  setSessionSummary(summary);
  // SessionReportModal appears when sessionSummary is non-null
}
```

### `handleNextLevel()`

Advances to the next level and resets state:
```ts
function handleNextLevel() {
  const next = (level + 1) as 1 | 2;
  setLevel(next);
  setGamePhase("normal");
  setEggsCollected(0);
  setMonsterEggs(0);
  setSessionSummary(null);
  continueSession();
  startNewQuestion(next, "normal");
}
```

### `handleRestart()`

Resets everything to Level 1:
```ts
function handleRestart() {
  setLevel(1);
  setUnlockedLevel(1);
  setGamePhase("normal");
  setEggsCollected(0);
  setMonsterEggs(0);
  setSessionSummary(null);
  startSession();
  shuffleMusic();
  startNewQuestion(1, "normal");
}
```

---

## Physical keyboard support

`useEffect` on `window.addEventListener("keydown")`:
- Digits `0–9`: append to `answer`
- `Backspace`: truncate `answer`
- `Enter`: call `handleFire()` (if `introPhase === "done"`)
- `.`: append decimal point (once)
- `-`: toggle negation

---

## Question text display

The text shown in the question box below the canvas depends on the round phase:

```ts
let questionText: string;
if (gamePhase === "normal")   questionText = currentQ.prompt;
if (gamePhase === "platinum") questionText = texts.levels[level].prompts.platinum;
if (gamePhase === "monster")  questionText = texts.rounds.monster.instruction;
```

In platinum/monster phases, the player must type the exact angle — drag aiming is
either hidden or ineffective (cannon still rotates but only keypad submission scores).

---

## Level background theming

Each level × phase combination has its own background colour scheme:

```ts
const LEVEL_BG = {
  "1-normal":   { bg: "#080e1c", glow: "#1e3a5f", tint: "transparent" },
  "1-monster":  { bg: "#0f0520", glow: "#5b21b6", tint: "rgba(109,40,217,0.08)" },
  "1-platinum": { bg: "#080b14", glow: "#94a3b8", tint: "rgba(148,163,184,0.07)" },
  "2-normal":   { bg: "#071510", glow: "#14532d", tint: "transparent" },
  "2-monster":  { bg: "#180a00", glow: "#92400e", tint: "rgba(234,88,12,0.1)" },
  "2-platinum": { bg: "#0a0c14", glow: "#94a3b8", tint: "rgba(148,163,184,0.07)" },
  // Level 3 follows the same pattern
};
```

The background updates instantly on phase change.

---

## Single-question demo mode

When the robot button is clicked without autopilot active, it triggers a
**single-question demo**: autopilot types one answer, then the game pauses and shows a
"Try It Yourself" button (`demoRetryPending = true`).

The button renders as a fixed overlay above everything. Clicking it resets
`demoRetryPending` and starts a new question.

---

## JSX structure

```tsx
return (
  <>
    {/* Main game container */}
    <div className="fixed inset-0 arcade-grid overflow-hidden">

      {/* Top bar: level buttons, stars, toolbar buttons */}
      <div className="absolute top-0 ...">
        <LevelButtons />
        <StarProgress stars={eggsCollected} />
        <RestartButton />
        <AudioButton />
        <AutopilotIcon />
        <ShareButton />
        <CommentsButton />
      </div>

      {/* Canvas area */}
      <div className="absolute inset-0 ...">
        <SVG viewBox="0 0 480 340">
          <CoordAxes />
          <SectorArcs />          {/* Level 2 */}
          <GazeBeamDrag />
          <TargetSprite />
          <CannonSprite />
          <ProjectileTracer />   {/* during firing */}
          <ExplosionAt />        {/* after hit */}
          <LiveAngleLabel />
        </SVG>
        <AngleTypeLabel />        {/* top-right pill: ACUTE / OBTUSE / etc. */}
        <SetTypeLabel />          {/* Level 2: COMPLEMENTARY / SUPPLEMENTARY / COMPLETE */}
        <FireButtonHint />        {/* first-fire tutorial */}
        {demoRetryPending && <TryYourselfOverlay />}
      </div>

      {/* Bottom: question box + numeric keypad */}
      <div className="absolute bottom-0 ...">
        <QuestionBox>{questionText}</QuestionBox>
        <NumericKeypad value={answer} onChange={setAnswer} onSubmit={handleFire} />
      </div>

      {/* Drawers */}
      <ShareDrawer />
      <CommentsDrawer />

      {/* Monster/Platinum announcement banner */}
      {showMonsterAnnounce && <RoundAnnounceBanner />}

      {/* Session complete modal */}
      {sessionSummary && <SessionReportModal ... />}
    </div>

    {/* Phantom hand — outside main div so it floats above z-index stack */}
    <PhantomHand pos={phantomPos} />
  </>
);
```

---

## Autopilot wiring

```ts
autopilotCallbacksRef.current = {
  setCalcValue: setAnswer,
  playKeyPress: playKeyClick,
  submitAnswer: handleFire,
  goNextLevel: handleNextLevel,
  playAgain: handleReportClose,
  emailModalControls: modalControlsRef,
  onAutopilotComplete: deactivateAutopilot,
};
```

This ref must be updated **every render**.
See `specs/autopilot.md` for the full autopilot system.
