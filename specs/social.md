# Social Sharing, Comments & Video

**Files:** `src/components/Social.jsx`, `src/screens/ArcadeAngleScreen.tsx`

---

## Share and comments

Angle Explorer keeps the existing two social surfaces:
- Share launcher opens native share when available, otherwise a share drawer with
  `react-share` buttons.
- Comments launcher opens the embedded DiscussIt drawer.

The helper functions live in `src/components/Social.jsx`:

```tsx
export function SocialShare(): JSX.Element
export function SocialComments(): JSX.Element
export function openCommentsComposer(): void
```

---

## YouTube walkthrough launcher

The launcher cluster also includes a YouTube icon button when `public/manifest.json`
contains a valid `videoUrl`.

Behaviour:
- The launcher button matches the `see-maths` YouTube treatment: transparent background,
  yellow circular border, centered YouTube logo.
- The screen fetches `/manifest.json` on mount, reads `videoUrl`, and converts it to a
  YouTube embed URL.
- Supported URL forms include `youtu.be`, standard YouTube watch URLs, and Shorts URLs.

### First-time speech bubble

The speech bubble should be positioned relative to the YouTube icon so the full bubble
stays visible inside the viewport.

Placement rule:
- If there is enough space above the icon, the bubble may render above it.
- If there is not enough space above, the bubble should render below it.
- The chosen position should prevent the bubble from being clipped off-screen.
- The pointer tail should flip to the edge that faces the icon.

Angle Explorer note:
- In the current layouts, the launcher sits near the bottom-left edge.
- The bubble therefore renders above the icon in this project so it stays visible.

Bubble content:
- leading circular YouTube icon inside the bubble
- copy comes from i18n key `social.youtubePrompt`
  - English source text: `First time? Look at a video on how to play.`
- dismiss action comes from i18n key `social.youtubeDismiss`
  - English source text: `Don't show again`

Dismissal rules:
- Clicking the dismiss action hides the bubble.
- Bubble dismissal is persisted in `localStorage` under:

```ts
"maths-angle-explorer:youtube-bubble-dismissed"
```

- The YouTube icon remains visible after dismissal.

### Video modal

Pressing the YouTube icon opens a centered modal player.

Modal rules:
- Width: `80vw`
- Height: `80vh`
- Centered with `transform: translate(-50%, -50%)`
- Contains an embedded YouTube `<iframe>`
- Includes a top-right close button with:
  - red circular background
  - white Material UI `Close` icon
- The close button circle is positioned so its centre aligns with the modal corner
- Clicking the darkened backdrop also closes the modal
- The iframe uses the embed URL derived from `manifest.json` `videoUrl`

---

## Styling rules

The YouTube CTA uses dedicated CSS classes in `src/index.css`:

```css
.social-video-cta
.social-video-button
.social-video-bubble
.social-video-bubble.is-above
.social-video-bubble.is-below
.social-video-modal
.social-video-modal-close
```

Shared visual rules:
- Bubble width is fixed at `310px` on mobile and desktop.
- The button uses the same yellow-ring YouTube treatment as `see-maths`.
- The bubble uses the same visual style as `see-maths`, with tail direction changing
  to match placement.
