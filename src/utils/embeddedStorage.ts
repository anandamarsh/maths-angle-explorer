import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

const STORAGE_GET = "interactive-maths:storage:get";
const STORAGE_SET = "interactive-maths:storage:set";
const STORAGE_REMOVE = "interactive-maths:storage:remove";
const STORAGE_VALUE = "interactive-maths:storage:value";
const TIMEOUT_MS = 250;

type StorageOptions = {
  legacyKeys?: string[];
};

type PersistentStringOptions = StorageOptions & {
  removeWhen?: (value: string) => boolean;
};

function canUseDom() {
  return typeof window !== "undefined";
}

function isEmbedded() {
  return canUseDom() && window.parent !== window;
}

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `storage-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readLocalStorageValue(key: string): string | null {
  if (!canUseDom()) return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageValue(key: string, value: string) {
  if (!canUseDom()) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore local fallback storage failures.
  }
}

function removeLocalStorageValue(key: string) {
  if (!canUseDom()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore local fallback storage failures.
  }
}

function readLocalWithLegacyFallback(key: string, legacyKeys: string[]) {
  const primaryValue = readLocalStorageValue(key);
  if (primaryValue != null) return primaryValue;

  for (const legacyKey of legacyKeys) {
    const legacyValue = readLocalStorageValue(legacyKey);
    if (legacyValue != null) return legacyValue;
  }

  return null;
}

async function requestParentValue(key: string, requestId: string): Promise<string | null> {
  return await new Promise((resolve) => {
    let settled = false;

    function finish(value: string | null) {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
      resolve(value);
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== STORAGE_VALUE) return;
      if (data.key !== key) return;
      if (data.requestId !== requestId) return;
      finish(typeof data.value === "string" ? data.value : null);
    }

    const timeoutId = window.setTimeout(() => finish(null), TIMEOUT_MS);
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: STORAGE_GET, key, requestId }, "*");
  });
}

export async function getEmbeddedStorageItem(key: string, options: StorageOptions = {}) {
  const legacyKeys = options.legacyKeys ?? [];
  const localValue = readLocalWithLegacyFallback(key, legacyKeys);

  if (!isEmbedded()) {
    if (localValue != null && readLocalStorageValue(key) == null) {
      writeLocalStorageValue(key, localValue);
    }
    return localValue;
  }

  const parentValue = await requestParentValue(key, createRequestId());
  if (parentValue != null) {
    writeLocalStorageValue(key, parentValue);
    return parentValue;
  }

  if (localValue != null) {
    await setEmbeddedStorageItem(key, localValue);
    return localValue;
  }

  return null;
}

export async function setEmbeddedStorageItem(key: string, value: string) {
  if (isEmbedded()) {
    window.parent.postMessage({ type: STORAGE_SET, key, value }, "*");
  }
  writeLocalStorageValue(key, value);
}

export async function removeEmbeddedStorageItem(key: string) {
  if (isEmbedded()) {
    window.parent.postMessage({ type: STORAGE_REMOVE, key }, "*");
  }
  removeLocalStorageValue(key);
}

export function usePersistentString(
  key: string,
  defaultValue: string,
  options: PersistentStringOptions = {},
): [string, Dispatch<SetStateAction<string>>, boolean] {
  const legacyKeysKey = (options.legacyKeys ?? []).join("\u0000");
  const legacyKeys = useMemo(() => options.legacyKeys ?? [], [legacyKeysKey]);
  const removeWhen = options.removeWhen;
  const [value, setValueState] = useState(
    () => readLocalWithLegacyFallback(key, legacyKeys) ?? defaultValue,
  );
  const [loaded, setLoaded] = useState(() => !canUseDom() || !isEmbedded());

  useEffect(() => {
    let cancelled = false;

    void getEmbeddedStorageItem(key, { legacyKeys }).then((storedValue) => {
      if (cancelled) return;
      setValueState(storedValue ?? defaultValue);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [defaultValue, key, legacyKeys]);

  const setValue = useCallback<Dispatch<SetStateAction<string>>>((nextValue) => {
    setValueState((currentValue) => {
      const resolvedValue =
        typeof nextValue === "function"
          ? nextValue(currentValue)
          : nextValue;

      if (removeWhen?.(resolvedValue)) {
        void removeEmbeddedStorageItem(key);
      } else {
        void setEmbeddedStorageItem(key, resolvedValue);
      }

      for (const legacyKey of legacyKeys) {
        removeLocalStorageValue(legacyKey);
      }

      return resolvedValue;
    });
  }, [key, legacyKeys, removeWhen]);

  return [value, setValue, loaded];
}

export function usePersistentBoolean(
  key: string,
  defaultValue: boolean,
  options: StorageOptions = {},
): [boolean, Dispatch<SetStateAction<boolean>>, boolean] {
  const legacyKeysKey = (options.legacyKeys ?? []).join("\u0000");
  const legacyKeys = useMemo(() => options.legacyKeys ?? [], [legacyKeysKey]);
  const [rawValue, setRawValue, loaded] = usePersistentString(
    key,
    defaultValue ? "true" : "false",
    { legacyKeys },
  );
  const value = rawValue === "true";

  const setValue = useCallback<Dispatch<SetStateAction<boolean>>>((nextValue) => {
    setRawValue((currentValue) => {
      const currentBoolean = currentValue === "true";
      const resolvedValue =
        typeof nextValue === "function"
          ? nextValue(currentBoolean)
          : nextValue;
      return resolvedValue ? "true" : "false";
    });
  }, [setRawValue]);

  return [value, setValue, loaded];
}
