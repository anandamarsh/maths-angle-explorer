import {
  getEmbeddedStorageItem,
  removeEmbeddedStorageItem,
  setEmbeddedStorageItem,
} from "./embeddedStorage";

const STORAGE_KEY_PREFIX = "interactive-maths:";
const STORAGE_GET = "interactive-maths:storage:get";
const STORAGE_SET = "interactive-maths:storage:set";
const STORAGE_REMOVE = "interactive-maths:storage:remove";
const STORAGE_VALUE = "interactive-maths:storage:value";

type StorageGetMessage = {
  type: typeof STORAGE_GET;
  key: string;
  requestId: string;
};

type StorageSetMessage = {
  type: typeof STORAGE_SET;
  key: string;
  value: string;
};

type StorageRemoveMessage = {
  type: typeof STORAGE_REMOVE;
  key: string;
};

type StorageMessage = StorageGetMessage | StorageSetMessage | StorageRemoveMessage;

function isStorageMessage(data: unknown): data is StorageMessage {
  if (!data || typeof data !== "object") return false;

  const candidate = data as Partial<StorageMessage>;
  if (typeof candidate.type !== "string") return false;
  if (typeof candidate.key !== "string") return false;
  if (!candidate.key.startsWith(STORAGE_KEY_PREFIX)) return false;

  if (candidate.type === STORAGE_GET) {
    return typeof (candidate as Partial<StorageGetMessage>).requestId === "string";
  }

  if (candidate.type === STORAGE_SET) {
    return typeof (candidate as Partial<StorageSetMessage>).value === "string";
  }

  return candidate.type === STORAGE_REMOVE;
}

export function installEmbeddedStorageBridge() {
  function onMessage(event: MessageEvent) {
    if (!isStorageMessage(event.data)) return;

    const data = event.data;
    if (data.type === STORAGE_GET) {
      const source = event.source;
      if (!source || typeof source.postMessage !== "function") return;

      void getEmbeddedStorageItem(data.key).then((value) => {
        source.postMessage(
          {
            type: STORAGE_VALUE,
            key: data.key,
            requestId: data.requestId,
            value,
          },
          { targetOrigin: event.origin && event.origin !== "null" ? event.origin : "*" },
        );
      });
      return;
    }

    if (data.type === STORAGE_SET) {
      void setEmbeddedStorageItem(data.key, data.value);
      return;
    }

    void removeEmbeddedStorageItem(data.key);
  }

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
