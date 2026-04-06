import { useCallback, useEffect, useRef, useState } from "react";

// SVG constants (match ArcadeAngleScreen)
const SVG_W = 480;
const SVG_H = 340;
const CX = 240;
const CY = 170;
const BEAM_LEN = 150;
const AIM_STEPS = 40;

export type AutopilotGamePhase = "aiming" | "feedback" | "levelComplete";

const T = {
  AIM_FIRST:    [500, 900]   as [number, number],
  AIM_DURATION: [900, 1500]  as [number, number],
  READ_DELAY:   [600, 1100]  as [number, number],
  KEY_BETWEEN:  [320, 600]   as [number, number],
  PRE_SUBMIT:   [400, 700]   as [number, number],
  EMAIL_CLICK:  [2000, 3200] as [number, number],
  EMAIL_CHAR:   [8, 15]      as [number, number],
  SEND_PAUSE:   [700, 1100]  as [number, number],
  END_PAUSE:    [3600, 5000] as [number, number],
} as const;

const WRONG_ANSWER_RATE = 0.2;

function rand([lo, hi]: [number, number]): number {
  return Math.round(lo + Math.random() * (hi - lo));
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function wrongAngle(correct: number): number {
  const offsets = [-30, -20, 15, 20, 30, -15];
  const offset = offsets[Math.floor(Math.random() * offsets.length)];
  return correct + offset;
}

function getKeyRect(key: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-autopilot-key="${key}"]`);
  return el ? el.getBoundingClientRect() : null;
}

// Use the SVG's own CTM so viewBox letterboxing / transforms are accounted for.
// This is the same approach as ArcadeAngleScreen's toSVGPoint (inverse direction).
function angleToScreenXY(angleDeg: number, svgEl: SVGSVGElement): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const svgX = CX + BEAM_LEN * Math.cos(rad);
  const svgY = CY - BEAM_LEN * Math.sin(rad); // math convention → SVG y-axis
  const ctm = svgEl.getScreenCTM();
  if (ctm) {
    const pt = svgEl.createSVGPoint();
    pt.x = svgX;
    pt.y = svgY;
    const screen = pt.matrixTransform(ctm);
    return { x: screen.x, y: screen.y };
  }
  // Fallback (no CTM): naive rect scaling
  const rect = svgEl.getBoundingClientRect();
  return {
    x: rect.left + svgX * (rect.width / SVG_W),
    y: rect.top + svgY * (rect.height / SVG_H),
  };
}

export interface ModalAutopilotControls {
  appendChar: (ch: string) => void;
  setEmail: (v: string) => void;
  triggerSend: () => void;
}

export interface AutopilotCallbacks {
  commitAimAngle: (angle: number) => void;
  setCalcValue: (v: string) => void;
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
  currentGazeAngle: number;
  level: number;
  levelCount: number;
}

interface UseAutopilotArgs {
  gameState: AutopilotGameState;
  callbacksRef: React.RefObject<AutopilotCallbacks | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  autopilotEmail: string;
}

export function useAutopilot({
  gameState,
  callbacksRef,
  svgRef,
  autopilotEmail,
}: UseAutopilotArgs) {
  const [isActive, setIsActive] = useState(false);
  const [phantomPos, setPhantomPos] = useState<PhantomPos | null>(null);

  const isActiveRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  function clearTimers() {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }

  function after(ms: number, fn: () => void): void {
    const t = window.setTimeout(() => {
      if (!isActiveRef.current) return;
      fn();
    }, ms);
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
    }, 130);
  }

  // ── Cannon rotation animation ─────────────────────────────────────────────

  function scheduleAim() {
    const { correctAnswer, currentGazeAngle } = stateRef.current;
    const isWrong = Math.random() < WRONG_ANSWER_RATE;
    const targetAngle = isWrong ? wrongAngle(correctAnswer) : correctAnswer;
    const aimDuration = rand(T.AIM_DURATION);
    const startAngle = currentGazeAngle;

    let delay = rand(T.AIM_FIRST);

    // Animate cannon from current angle to target over AIM_STEPS increments
    for (let i = 1; i <= AIM_STEPS; i++) {
      const stepDelay = delay + (i / AIM_STEPS) * aimDuration;
      const stepI = i;
      after(stepDelay, () => {
        const progress = stepI / AIM_STEPS;
        const eased = easeOutCubic(progress);
        const angle = startAngle + (targetAngle - startAngle) * eased;
        callbacksRef.current?.commitAimAngle(angle);
        // Move phantom hand to beam endpoint
        const svgEl = svgRef.current;
        if (svgEl) {
          const pos = angleToScreenXY(angle, svgEl);
          moveHand(pos.x, pos.y);
        }
      });
    }

    delay += aimDuration + rand(T.READ_DELAY);

    // Now type the answer in the keypad
    scheduleTyping(targetAngle, delay);
  }

  function scheduleTyping(targetAngle: number, startDelay: number) {
    // For L2, the answer is the delta from startAngle — but correctAnswer is already the delta
    // The keypad shows the typed number (not the absolute angle for L2)
    // We use correctAnswer directly as what to type
    const { correctAnswer } = stateRef.current;
    // If targeting a wrong angle, compute the corresponding typed value
    // Actually, we already chose the targetAngle above. For typing, we should type
    // what matches the targetAngle as typed answer.
    // For simplicity, type the rounded integer of the targetAngle
    // (for L1: same as angle; for L2: same as correctAnswer delta if correct, or offset if wrong)
    void correctAnswer; // used via targetAngle

    // Clear keypad display before typing (human behaviour)
    callbacksRef.current?.setCalcValue("");

    const digits = String(Math.round(Math.abs(targetAngle))).split("");
    let delay = startDelay;

    // Move hand toward keypad area first
    after(delay - 300, () => {
      const rect = getKeyRect(digits[0]);
      if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });

    // Handle negative sign for L1 if needed
    if (targetAngle < 0) {
      after(delay, () => {
        const el = document.querySelector<HTMLElement>('[data-autopilot-key="±"]');
        if (el) {
          const rect = el.getBoundingClientRect();
          clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
          el.click();
        }
      });
      delay += rand(T.KEY_BETWEEN);
    }

    for (const d of digits) {
      const td = delay;
      const digit = d;
      after(td, () => {
        const el = document.querySelector<HTMLElement>(`[data-autopilot-key="${digit}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
          el.click();
        }
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
      }, 140);
    });
  }

  function scheduleLevelEnd() {
    const email = autopilotEmail;
    if (!email) {
      // No email configured — just wait and go to next level
      const delay = rand(T.END_PAUSE);
      after(delay, () => {
        const { level, levelCount } = stateRef.current;
        if (level < levelCount) {
          callbacksRef.current?.goNextLevel();
        } else {
          isActiveRef.current = false;
          setIsActive(false);
          callbacksRef.current?.onAutopilotComplete?.();
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
      window.setTimeout(() => {
        if (!isActiveRef.current) return;
        callbacksRef.current?.emailModalControls?.current?.triggerSend?.();
        setPhantomPos(null);
      }, 140);
    });

    delay += rand(T.END_PAUSE);
    after(delay - 400, () => {
      const { level, levelCount } = stateRef.current;
      if (level < levelCount) {
        const rect = getKeyRect("next-level");
        if (rect) moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    });
    after(delay, () => {
      const { level, levelCount } = stateRef.current;
      if (level < levelCount) {
        const el = document.querySelector<HTMLElement>('[data-autopilot-key="next-level"]');
        if (el) {
          const rect = el.getBoundingClientRect();
          clickAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
          window.setTimeout(() => {
            if (!isActiveRef.current) return;
            el.click();
            setPhantomPos(null);
          }, 140);
        } else {
          callbacksRef.current?.goNextLevel();
        }
      } else {
        isActiveRef.current = false;
        setIsActive(false);
        callbacksRef.current?.onAutopilotComplete?.();
      }
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
