import { useEffect, useRef } from "react";

const BUFFER_MAX = 12;
const PASSTHROUGH_KEYS = new Set([
  "Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "NumLock",
]);

interface UseCheatCodesResult {
  processCheatKey: (key: string) => boolean;
  resetCheatBuffer: () => void;
}

export function useCheatCodes(
  handlers: Record<string, () => void>,
): UseCheatCodesResult {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const bufferRef = useRef("");

  function processCheatKey(key: string): boolean {
    if (key >= "0" && key <= "9") {
      bufferRef.current = (bufferRef.current + key).slice(-BUFFER_MAX);
      for (const code of Object.keys(handlersRef.current)) {
        if (bufferRef.current.endsWith(code)) {
          bufferRef.current = "";
          handlersRef.current[code]();
          return true;
        }
      }
    } else if (!PASSTHROUGH_KEYS.has(key)) {
      bufferRef.current = "";
    }
    return false;
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const matched = processCheatKey(e.key);
      if (matched) {
        e.stopImmediatePropagation();
      }
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  return {
    processCheatKey,
    resetCheatBuffer: () => {
      bufferRef.current = "";
    },
  };
}
