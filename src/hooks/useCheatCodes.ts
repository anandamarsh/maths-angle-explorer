import { useEffect, useRef } from "react";

const BUFFER_MAX = 12;
const PASSTHROUGH_KEYS = new Set([
  "Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "NumLock",
]);

export function useCheatCodes(handlers: Record<string, () => void>): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const bufferRef = useRef("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") {
        bufferRef.current = (bufferRef.current + e.key).slice(-BUFFER_MAX);
        for (const code of Object.keys(handlersRef.current)) {
          if (bufferRef.current.endsWith(code)) {
            bufferRef.current = "";
            e.stopImmediatePropagation();
            handlersRef.current[code]();
            return;
          }
        }
      } else if (!PASSTHROUGH_KEYS.has(e.key)) {
        bufferRef.current = "";
      }
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}
