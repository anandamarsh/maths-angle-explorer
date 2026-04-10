type EmbeddedAnalyticsPayload = Record<string, unknown>;

type EmbeddedAnalyticsMessage = {
  type: "see-maths:analytics-event";
  eventName: string;
  payload: EmbeddedAnalyticsPayload;
};

function canPostToParent() {
  return typeof window !== "undefined" && window.parent && window.parent !== window;
}

export function sendEmbeddedAnalyticsEvent(eventName: string, payload: EmbeddedAnalyticsPayload = {}) {
  if (!canPostToParent() || !eventName.trim()) {
    return;
  }

  const message: EmbeddedAnalyticsMessage = {
    type: "see-maths:analytics-event",
    eventName: eventName.trim(),
    payload,
  };

  try {
    window.parent.postMessage(message, "*");
  } catch {
    // Analytics must never affect gameplay.
  }
}
