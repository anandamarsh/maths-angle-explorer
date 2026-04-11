const demoModeStorageKey = "maths-angle-explorer:demo-mode";

export type DemoConfig = {
  enabled: boolean;
  targetStars: number;
  showAnswers: boolean;
};

function readStoredDemoMode() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(demoModeStorageKey) === "on";
  } catch {
    return false;
  }
}

export function getDemoConfig(): DemoConfig {
  if (typeof window === "undefined") {
    return { enabled: false, targetStars: 2, showAnswers: false };
  }

  const search = new URLSearchParams(window.location.search);
  const raw = search.get("demo");
  const enabled = raw === "1" ? true : raw === "0" ? false : readStoredDemoMode();

  try {
    if (raw === "1") {
      window.localStorage.setItem(demoModeStorageKey, "on");
    } else if (raw === "0") {
      window.localStorage.removeItem(demoModeStorageKey);
    }
  } catch {
    // Ignore storage failures.
  }

  return {
    enabled,
    targetStars: 2,
    showAnswers: enabled,
  };
}
