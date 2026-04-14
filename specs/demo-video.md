# Demo Video Recording

**Files:**
- `src/hooks/useDemoRecorder.ts` — recording state machine + `MediaRecorder`
- `src/components/DemoIntroOverlay.tsx` — intro/outro/holding overlays
- `public/intro.html` — editable standalone intro template used by the recorder
- `public/outro.html` — editable standalone outro template used by the recorder
- `public/seemaths-icon.svg` — SeeMaths brand mark used by the outro template
- Integration in `src/screens/ArcadeAngleScreen.tsx`

---

## What it does

Records a complete teacher-facing demo video of Angle Explorer being played by
autopilot, bookended by intro and outro slides. The recording captures the
current browser tab via `getDisplayMedia()` so it includes the game visuals,
normal in-game SFX, and a dedicated recording-only soundtrack layer.

This follows the same family pattern as `maths-game-template`:
- editable intro/outro HTML in `public/`
- dark holding screen before capture permission is granted
- intro starts only after recording actually begins
- autoplayed demo gameplay
- timed outro
- automatic `.webm` download at the end

---

## Reusable template rules

Other games in this repo family should copy these rules:
- Keep intro and outro content in standalone editable HTML files under `public/`.
- Switch to a plain dark holding screen before calling `getDisplayMedia()`.
- Do not start intro timers while the browser permission dialog is unresolved.
- Keep the intro as a two-phase sequence inside one `intro.html` file.
- Fade from intro into autoplayed gameplay, then show a timed outro before
  stopping the recording.
- Keep the in-game mute icon visually muted while any recording-only soundtrack
  runs on a separate audio path.
- Hide the video-record button while recording is active.
- Use demo-safe autopilot data, including a fixed teacher email address where
  the session report modal requires one.

---

## Recording flow

### 1. Trigger

A video-record button appears only in localhost dev mode, beside the existing
screenshot camera button.

### 2. Tab capture permission

Immediately after the record button is pressed:
- the app switches to a plain fullscreen dark holding screen
- then calls `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`
- `preferCurrentTab: true` is requested when supported

While the permission dialog is open:
- the holding screen remains visible indefinitely
- intro timing does not begin
- autopilot does not begin

If capture is denied or cancelled:
- recording setup aborts cleanly
- the app returns to the live game screen

### 3. Intro slide

After capture permission is granted and `MediaRecorder` has actually started,
the app shows `public/intro.html` in a fullscreen iframe overlay.

Angle Explorer intro content:
- Game icon: `/favicon.svg`
- Game title: `Angle Explorer`
- Subtitle: `Angles, Aiming & Missing Angle Reasoning`
- Panel 1:
  - `Stage 2-3 — NSW Curriculum`
  - `MA2-16MG / MA3-16MG`
- Panel 2:
  - explainer text describing the cannon, live angle readout, and missing-angle
    questions in teacher-facing language

Timing:
- total intro exposure: 10 seconds
- panel 1: 4 seconds
- panel 2: 6 seconds
- then fade into gameplay

Layout rules:
- `public/intro.html` is the authoritative editable source
- both intro phases live inside that one HTML file
- panel 2 fully replaces panel 1 content rather than stacking underneath it
- the description remains left-aligned inside a centered readable block

### 4. Autopilot gameplay

After the intro fades:
1. The game resets to Level 1.
2. The visible mute button stays in its muted state.
3. A dedicated recording-only soundtrack starts and is not controlled by the
   normal mute button.
4. Normal in-game SFX still play and are captured in the recording.
5. Autopilot activates in continuous mode.
6. The recording runs through both playable levels.
7. While recording, the report modal email field is filled with
   `teacher@myschool.com`.
8. The demo uses the repo’s shortened autopilot stage length so the recording
   stays concise.
9. When autopilot completes the final level, the outro begins automatically.

### 5. Outro slide

The app loads `public/outro.html` directly in a fullscreen overlay and shows:
- `Play this and more games at`
- SeeMaths icon
- visible site text for `www.seemaths.com`

Timing:
- hold for 5 seconds
- fade out on an opaque dark background
- stop recording only after the outro finishes, without exposing the last game
  frame underneath

### 6. Download

After the outro completes, recording stops automatically and downloads a WebM
file named:

`angle-explorer-demo-{timestamp}.webm`

---

## Required sequence

1. User presses the record-video button.
2. The app switches to a plain dark holding screen.
3. The browser capture prompt appears.
4. While permission is unresolved, the holding screen stays up and autoplay does
   not start.
5. If capture is denied or cancelled, the app returns to the game with no
   recording.
6. After permission is granted, recording starts.
7. The 10-second intro begins only after recording has actually started.
8. `public/intro.html` shows panel 1 for 4 seconds, then panel 2 for 6 seconds.
9. The intro fades out.
10. Autopilot gameplay runs through Level 1 and Level 2.
11. The report modal is handled automatically with the demo email address.
12. The outro holds for 5 seconds, then fades.
13. Recording stops only after the outro finishes.

---

## Technical details

### MediaRecorder configuration

```ts
const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
  ? "video/webm;codecs=vp9,opus"
  : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
    ? "video/webm;codecs=vp8,opus"
    : "video/webm";

new MediaRecorder(stream, {
  mimeType,
  videoBitsPerSecond: 5_000_000,
});
```

### Audio capture

`getDisplayMedia({ audio: true })` captures tab audio. During recording:
- the normal background-music mute state remains visually muted
- in-game SFX still sound and are captured
- a separate recording soundtrack is mixed into the tab audio independently of
  the in-game mute button

### Auto-stop

The recorder session spans:

`holding screen -> intro -> gameplay -> outro`

Autopilot completion triggers the outro. Outro completion triggers
`recorder.stop()`, which then downloads the file in the `onstop` handler.

### Stream cleanup

If the user stops sharing from browser UI, or if recording ends normally:
- all stream tracks are stopped
- refs are cleaned up
- recorder state returns to idle

---

## UI integration

### Video record button

- localhost dev only
- appears next to the screenshot button
- hidden while recording is active

### Screenshot tools

- localhost dev only
- the existing camera button still downloads the full SVG scene as a PNG
- a second button appears beside it with a dotted square camera icon
- pressing that button toggles a square snip overlay on top of the scene
- the overlay starts centred, can be dragged, and can be resized while staying a
  square
- a floating camera button on the selection’s top-right corner downloads exactly
  the selected square crop as a PNG

### Recording indicator

While recording is active, a small pulsing red dot appears in the top-left
corner so the developer can see that capture is live.

### Toolbar state during recording

- the standard mute button remains visible and should look muted
- the screenshot button remains available
- the video-record button is hidden while recording is active

---

## Future: YouTube upload

The feature is designed so a later iteration can upload the recorded WebM to
YouTube automatically:

1. add `YOUTUBE_CLIENT_ID`
2. offer an `Upload to YouTube` action after recording completes
3. run OAuth 2.0 with Google
4. upload with YouTube Data API v3
5. prefill title and description from the game metadata

This is not implemented in the current version. The current flow only downloads
the `.webm` file locally.
