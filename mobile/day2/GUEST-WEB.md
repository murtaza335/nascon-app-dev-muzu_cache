# Guest Web Player Specification

The root `day2/FRONTEND-CONTRACT.md` and `day2/API-CONTRACT.md` are binding. This document is an implementation guide only.

The Guest Web Player is static HTML, vanilla JavaScript, and CSS served from `backend/src/web/`. There is no build step and no CDN dependency. Use relative URLs and derive WebSocket URLs from `location.host`.

## 1. Routes

Implement these routes on the API origin:

| Route | Purpose |
|---|---|
| `/web/matches/{id}/preview` | Upcoming match preview |
| `/web/matches/{id}/live` | Live playback, score, chat, merchandise |
| `/web/matches/{id}/vod` | Completed-stream playback |
| `/web/matches/{id}/notice?state={status}` | Postponed/cancelled/abandoned state |
| `/web/players/{id}` | Public athlete profile and VOD archive |
| `/web/clubs/{id}` | Public club view |
| `/web/costream/{id}` | Co-stream playback, participants, chat |

Unknown public entities render the contract's HTML 404 state with a plain-language message and a link home; do not replace it with a JSON-only page.

## 2. Initial load

Initial guest load must show the player and score without login. The progressive auth modal must not be visible until a protected action is attempted.

The backend embeds the current snapshot in `<script type="application/json" id="boot">`. Initial score and merchandise must be visible from that boot/server-rendered data without waiting for XHR.

The page must handle:

- loading;
- stream unavailable;
- unknown QR target;
- match state mutation;
- network offline;
- reconnecting;
- ended playback;
- no pinned merchandise;
- empty chat;
- delayed realtime connection.

## 3. Media player

Create a media adapter with explicit state:

```text
idle | loading | playing | paused | reconnecting | ended | failed | unsupported
```

The visual player container must always carry `data-testid="guest-video-player"`. The implementation must prefer real HLS/WebRTC URLs from the backend. A development fixture may render the container but must not be considered integrated.

The player must expose labeled controls for play/pause, mute, volume, fullscreen, and playback status. Autoplay policies must be handled without trapping keyboard users.

## 4. Score and realtime

The score banner must carry `data-testid="live-score-banner"` and update in place. Realtime events must be deduplicated by event ID/sequence where available. Reconnect must re-fetch authoritative match state.

## 5. Merchandise and guest cart

The pinned merchandise card must carry `data-testid="pinned-merch-card"`. The add button must carry `data-testid="add-to-guest-cart-btn"`; count must carry `data-testid="guest-cart-count"`.

The cart must:

- be scoped to the current guest token/session;
- support quantity feedback;
- reject invalid or unavailable items plainly;
- survive opening the auth modal;
- never imply reservation or purchase before server confirmation.

Use the exact calls: `POST /api/v1/guest/session`, `GET /api/v1/guest/cart`, `POST /api/v1/guest/cart/items`, `DELETE /api/v1/guest/cart/items/{variant_id}`, and `POST /api/v1/guest/cart/merge`. Store the web guest token as `localStorage.nascon_guest_token`.

## 6. Chat

Use:

- `data-testid="chat-message-list"`;
- `data-testid="chat-input-field"`;
- `data-testid="chat-send-btn"`.

Chat messages must be rendered from server events/results. A blocked guest message must not enter the message list. On `GUEST_WRITE_FORBIDDEN`, open the modal with the staged cart and current route preserved.

The list must announce new messages accessibly without stealing focus from the input.

Load history from `GET /api/v1/chat/{room}/messages`. Send through `POST /api/v1/chat`. A guest request must carry the guest bearer and must be rejected by the server with `403 GUEST_WRITE_FORBIDDEN` before the message is appended.

## 7. Progressive auth modal

The modal must carry `data-testid="progressive-auth-modal"` and:

- be a real modal dialog with focus management;
- explain why authentication is needed;
- offer login and registration entry points;
- preserve guest cart;
- preserve stream route and playback position;
- close safely without losing staged work;
- display merge success and merge failure states.

## 8. Accessibility and responsive behavior

Verify at 360 px mobile width, standard desktop width, keyboard-only use, zoom/text scaling, reduced motion, and dark/light contrast if supported. Every icon-only control needs an accessible name. Use visible focus indicators and semantic headings.

## 9. Required browser journeys

1. QR → live page → player and score, no login.
2. Guest chat attempt → server 403 → auth modal.
3. Add merchandise → count 1 → realtime score update.
4. QR route changes after match completion.
5. Co-stream page → participant grid → chat and host state.
6. Login from modal → cart merge → return to stream.

## 10. Exact DOM requirements

All nine mandatory selectors must be present in the initial HTML, not injected only after JavaScript runs:

- `guest-video-player`: visible `<video>`, `aria-label="Live match video"`, `controls`, `muted`, `playsinline`, `autoplay`;
- `live-score-banner`: `<div role="status" aria-live="polite">`;
- `pinned-merch-card`: includes `data-variant-id="var-jersey-001-L"` for the seeded fixture;
- `add-to-guest-cart-btn`: `<button type="button">`;
- `guest-cart-count`: integer text only;
- `chat-message-list`: scrollable `<ul role="log">`;
- `chat-input-field`: `<input type="text" aria-label="Chat message" maxlength="2000">`;
- `chat-send-btn`: `<button type="submit">`;
- `progressive-auth-modal`: hidden on load, then `<div role="dialog" aria-modal="true">` with focus management.

Also use the root contract's optional IDs where applicable: `auth-email`, `auth-password`, `auth-submit`, `auth-error`, `checkout-btn`, `open-in-app-link`, `stream-status`, and `costream-tile-{player_id}`.

## 11. Realtime and media behavior

Use `ws(s)://{location.host}/ws/matches/{id}` or `/ws/costream/{id}`. Reconnect at 0.5/1/2/4 seconds and poll the public match endpoint every two seconds while disconnected. Prefer WHEP via browser `RTCPeerConnection`; fall back to native HLS when supported, otherwise retain the visible player/poster and provide the contract's “open in app” recovery.
