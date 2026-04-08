import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";

const DEMO_TEST_SCALE = (() => {
  if (typeof window === "undefined") return 1;
  const raw = new URLSearchParams(window.location.search).get("demoTestScale");
  const parsed = raw ? Number.parseFloat(raw) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
})();

function scaleDemoMs(ms: number) {
  return Math.max(1, Math.round(ms * DEMO_TEST_SCALE));
}

export type RecordingPhase =
  | "idle"
  | "requesting"
  | "intro-prompt"
  | "intro"
  | "playing"
  | "outro"
  | "stopping";

interface Callbacks {
  onStartPlaying: () => void;
  prepareAudio: () => void;
  cleanupAudio: () => void;
}

export function useDemoRecorder(callbacksRef: React.RefObject<Callbacks>) {
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    callbacksRef.current?.cleanupAudio();
    recorderRef.current = null;
    chunksRef.current = [];
    setRecordingPhase("idle");
  }, [callbacksRef]);

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return;

    flushSync(() => {
      setRecordingPhase("intro-prompt");
    });

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
        // @ts-expect-error preferCurrentTab is Chrome-specific and not in all libdefs yet.
        preferCurrentTab: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        downloadBlob(blob);
        cleanup();
      };

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
        cleanup();
      });

      recorderRef.current = recorder;

      await new Promise((resolve) => window.setTimeout(resolve, scaleDemoMs(280)));

      callbacksRef.current?.prepareAudio();
      recorder.start(1000);
      setRecordingPhase("intro");
    } catch {
      cleanup();
    }
  }, [callbacksRef, cleanup]);

  const onIntroComplete = useCallback(() => {
    setRecordingPhase("playing");
    callbacksRef.current?.onStartPlaying();
  }, [callbacksRef]);

  const showOutro = useCallback(() => {
    setRecordingPhase("outro");
  }, []);

  const onOutroComplete = useCallback(() => {
    setRecordingPhase("stopping");
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    } else {
      cleanup();
    }
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = () => cleanup();
      recorderRef.current.stop();
    } else {
      cleanup();
    }
  }, [cleanup]);

  return {
    recordingPhase,
    isRecording: recordingPhase !== "idle",
    startRecording,
    onIntroComplete,
    showOutro,
    onOutroComplete,
    cancelRecording,
  };
}

function downloadBlob(blob: Blob) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, "-");
  const fileName = `angle-explorer-demo-${stamp}.webm`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
