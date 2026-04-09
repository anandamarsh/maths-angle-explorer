# maths-angle-explorer Embedded Storage Spec

## Role

Use parent-owned storage when embedded, with local `localStorage` as the
standalone and timeout fallback.

## Migrations

- `maths-angle-explorer:youtube-bubble-dismissed`
  -> `interactive-maths:youtubeBubbleDismissed`
- `reportName`
  -> `interactive-maths:reportName`
- `reportEmail`
  -> `interactive-maths:reportEmail`
- `lang`
  -> `interactive-maths:locale`

## Runtime Rules

- Read shared values through `postMessage` when framed.
- Cache shared values locally for fallback and standalone use.
- Promote legacy local values into the shared key on first load.
- Keep the parent page as the storage owner.

## Verification

- Dismiss the YouTube bubble in the iframe, reload, confirm it stays hidden.
- Enter report name/email in the iframe, then open distance calculator in the
  same parent shell and confirm the values are already filled.
- Change language in the iframe and confirm reload preserves the shared locale.
