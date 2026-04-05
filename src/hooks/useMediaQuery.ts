import { useEffect, useState } from "react";

export function useIsMobileLandscape() {
  const [is, setIs] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(
        "(hover: none) and (pointer: coarse) and (orientation: landscape)",
      ).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(
      "(hover: none) and (pointer: coarse) and (orientation: landscape)",
    );
    const handler = (e: MediaQueryListEvent) => setIs(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return is;
}

export function useIsCoarsePointer() {
  const [is, setIs] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none) and (pointer: coarse)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const handler = (e: MediaQueryListEvent) => setIs(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return is;
}
