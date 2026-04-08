import { useCallback, useEffect, useRef, useState } from "react";

export type AutopilotGamePhase = "aiming" | "feedback" | "levelComplete";

const T = {
  AIM_FIRST:   [500, 900]   as [number, number],
  KEY_BETWEEN: [320, 600]   as [number, number],
  PRE_SUBMIT:  [400, 700]   as [number, number],
  EMAIL_CLICK: [2000, 3200] as [number, number],
  EMAIL_CHAR:  [8, 15]      as [number, number],
  SEND_PAUSE:  [700, 1100]  as [number, number],
  END_PAUSE:   [3600, 5000] as [number, number],
} as const;

const WRONG_ANSWER_RATE = 0.2;
const MAX_WRONG_PER_STAGE = 2;

function rand([lo, hi]: [number, number]): number {
  return Math.round(lo + Math.random() * (hi - lo));
}

function wrongAnswer(correct: number): number {
  const offsets = [-30, -20, 15, 20, 30, -15];
  const offset = offsets[Math.floor(Math.random() * offsets.length)];
  return correct + offset;
}

function getKeyRect(key: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-autopilot-key="${key}"]`);
  return el ? el.getBoundingClientRect() : null;
}

export interface ModalAutopilotControls {
  appendChar: (ch: string) => void;
  setEmail: (v: string) => void;
  triggerSend: () => Promise<void>;
}

export interface AutopilotCallbacks {
  setCalcValue: (v: string) => void;
  playKeyPress: () => void;
  submitAnswer: () => void;
  goNextLevel: () => void;
  playAgain: () => void;
  emailModalControls: React.MutableRefObject<ModalAutopilotControls | null>;
  onAutopilotComplete?: () => void;
}

export interface PhantomPos {
  x: number;
  y: number;
  isClicking: boolean;
}

interface AutopilotGameState {
  phase: AutopilotGamePhase;
  correctAnswer: number;
  level: number;
  levelCount: number;
}

interface UseAutopilotArgs {
  gameState: AutopilotGameState;
  callbacksRef: React.RefObject<AutopilotCallbacks | null>;
  autopilotEmail: string;
  mode?: "continuous" | "single-question";
  wrongAnswerRate?: number;
  maxWrongPerStage?: number;
  timingScale?: number;
}

export function useAutopilot({
  gameState,
  callbacksRef,
  autopilotEmail,
  mode = "continuous",
  wrongAnswerRate = WRONG_ANSWER_RATE,
  maxWrongPerStage = MAX_WRONG_PER_STAGE,
  timingScale = 1,
}: UseAutopilotArgs) {
  const [isActive, setIsActive] = useState(false);
  const [phantomPos, setPhantomPos] = useState<PhantomPos | null>(null);

  const isActiveRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const stateRef = useRef(gameState);
  stateRef.current = gameState;
  const wrongCountRef = useRef(0);

  function clearTimers() {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }

  function after(ms: number, fn: () => void): void {
    const t = window.setTimeout(() => {
      if (!isActiveRef.current) return;
      fn();
    }, Math.max(1, Math.round(ms * timingScale)));
    timersRef.current.push(t);
  }

  function moveHand(x: number, y: number) {
    setPhantomPos({ x, y, isClicking: false });
  }

  function clickAt(x: number, y: number) {
    setPhantomPos({ x, y, isClicking: true });
    window.setTimeout(() => {
      if (!isActiveRef.current) return;
      setPhantomPos(prev => prev ? { ...prev, isClicking: false } : null);
    }, Math.max(1, Math.round(130 * timingScale)));
  }

  // ── Type answer directly on keypad ────────────────────────────────────────

  function scheduleAim() {
    const { correctAnswer } = stateRef.current;
    const canGoWrong =
      mode === "continuous" && wrongCountRef.current < maxWrongPerStage;
    const isWrong = canGoWrong && Math.random() < wrongAnswerRate;
    if (isWrong) wrongCountRef.current += 1;
    const targetAngle = isWrong ? wrongAnswer(correctAnswer) : correctAnswer;

    // Wait a brief "thinking" pause then go straight to typing
    scheduleTyping(targetAngle, rand(T.AIM_FIRST));
  }

  function scheduleTyping(targetAngle: number, startDelay: number) {
    const isNeg = targetAngle < 0;
    const digits = String(Math.round(Math.abs(targetAngle))).split("");
    let delay = startDelay;

    // Move hand toward first key
    after(delay - 300, () => {
      const firstKey = isNeg ? "±" : digits[0];
      const rect = getKeyRect(firstKey);
      if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    // Clear display just before typing starts (timed, not synchronous)
    after(delay - 100, () => {
      callbacksRef.current?.setCalcValue("");
    });

    // Negative sign — set value to "-0" directly
    if (isNeg) {
      after(delay, () => {
        const el = document.querySelector<HTMLElement>('[data-autopilot-key="±"]');
        if (el) {
          const rect = el.getBoundingClientRect();
          clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        callbacksRef.current?.playKeyPress();
        callbacksRef.current?.setCalcValue("-0");
      });
      delay += rand(T.KEY_BETWEEN);
    }

    // Digits — set the full accumulated value directly (no el.click stale closure)
    let built = "";
    for (const d of digits) {
      built = built === "" ? d : built + d;
      const td = delay;
      const typedValue = isNeg ? `-${built}` : built;
      const digit = d;
      after(td, () => {
        const el = document.querySelector<HTMLElement>(`[data-autopilot-key="${digit}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        callbacksRef.current?.playKeyPress();
        callbacksRef.current?.setCalcValue(typedValue);
      });
      delay += rand(T.KEY_BETWEEN);
    }

    // Move to submit button and fire
    delay += rand(T.PRE_SUBMIT);
    after(delay - 300, () => {
      const rect = getKeyRect("submit");
      if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    after(delay, () => {
      const rect = getKeyRect("submit");
      if (rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        clickAt(cx, cy);
      }
      window.setTimeout(() => {
        if (!isActiveRef.current) return;
        callbacksRef.current?.submitAnswer();
        setPhantomPos(null);
        if (mode === "single-question") {
          callbacksRef.current?.onAutopilotComplete?.();
          isActiveRef.current = false;
          setIsActive(false);
        }
      }, Math.max(1, Math.round(140 * timingScale)));
    });
  }

  function scheduleLevelEnd() {
    wrongCountRef.current = 0; // reset wrong count for the next stage
    const email = autopilotEmail;
    if (!email) {
      // No email configured — just wait and go to next level
      const delay = rand(T.END_PAUSE);
      after(delay, () => {
        const { level, levelCount } = stateRef.current;
        if (level < levelCount) {
          callbacksRef.current?.goNextLevel();
        } else {
          callbacksRef.current?.onAutopilotComplete?.();
          isActiveRef.current = false;
          setIsActive(false);
        }
      });
      return;
    }

    let delay = rand(T.EMAIL_CLICK);

    after(delay - 400, () => {
      const rect = getKeyRect("email-input");
      if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    after(delay, () => {
      const rect = getKeyRect("email-input");
      if (rect) clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
      callbacksRef.current?.emailModalControls?.current?.setEmail?.("");
    });
    delay += 300;

    for (const ch of email) {
      const cd = delay;
      const c = ch;
      after(cd, () => {
        const rect = getKeyRect("email-input");
        if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
        callbacksRef.current?.emailModalControls?.current?.appendChar?.(c);
      });
      delay += rand(T.EMAIL_CHAR);
    }

    delay += rand(T.SEND_PAUSE);
    after(delay - 400, () => {
      const rect = getKeyRect("email-send");
      if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    after(delay, () => {
      const rect = getKeyRect("email-send");
      if (rect) clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
      // Await the send, then wait 2 s, then proceed
      window.setTimeout(async () => {
        if (!isActiveRef.current) return;
        try {
          await (callbacksRef.current?.emailModalControls?.current?.triggerSend?.() ?? Promise.resolve());
        } catch { /* email errors don't block progression */ }
        await new Promise<void>(r => window.setTimeout(r, Math.max(1, Math.round(2000 * timingScale))));
        if (!isActiveRef.current) return;
        setPhantomPos(null);
        const { level, levelCount } = stateRef.current;
        if (level < levelCount) {
          const el = document.querySelector<HTMLElement>('[data-autopilot-key="next-level"]');
          if (el) {
            const rect2 = el.getBoundingClientRect();
            moveHand(rect2.left + rect2.width / 2, rect2.top + rect2.height / 2);
            await new Promise<void>(r => window.setTimeout(r, Math.max(1, Math.round(400 * timingScale))));
            if (!isActiveRef.current) return;
            clickAt(rect2.left + rect2.width / 2, rect2.top + rect2.height / 2);
            await new Promise<void>(r => window.setTimeout(r, Math.max(1, Math.round(140 * timingScale))));
            if (!isActiveRef.current) return;
            el.click();
            setPhantomPos(null);
          } else {
            callbacksRef.current?.goNextLevel();
          }
        } else {
          callbacksRef.current?.onAutopilotComplete?.();
          isActiveRef.current = false;
          setIsActive(false);
        }
      }, Math.max(1, Math.round(140 * timingScale)));
    });
  }

  // ── React to phase changes ────────────────────────────────────────────────

  useEffect(() => {
    if (!isActive) {
      clearTimers();
      setPhantomPos(null);
      return;
    }
    clearTimers();

    const { phase } = stateRef.current;

    switch (phase) {
      case "aiming":
        scheduleAim();
        break;
      case "feedback":
        setPhantomPos(null);
        break;
      case "levelComplete":
        scheduleLevelEnd();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, gameState.phase]);

  const activate = useCallback(() => {
    isActiveRef.current = true;
    setIsActive(true);
  }, []);

  const deactivate = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);
    clearTimers();
    setPhantomPos(null);
  }, []);

  useEffect(() => () => clearTimers(), []);


  return { isActive, activate, deactivate, phantomPos };
}
