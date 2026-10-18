# Backend Contract Source of Truth

Frontend agents must treat these root Day 2 documents as authoritative:

- `day2/API-CONTRACT.md` — exact endpoint paths, request/response shapes, authentication, error codes, and realtime payloads.
- `day2/FRONTEND-CONTRACT.md` — exact web routes, DOM selectors, browser behavior, mobile deep links, screens, and client-consumed realtime frames.
- `day2/REQUIREMENTS.md` — requirement IDs, business rules, defaults, and open questions.
- `day2/QA-HARNESS.md` — exact Selenium, Appium, k6, CI, and report expectations.

If any document under `mobile/day2/` differs from those files, the root `day2/` files win. Update this package after the root contract changes; do not create a competing frontend interpretation.

## Binding frontend transport map

### Guest session and cart

Use the exact product APIs in `day2/API-CONTRACT.md`:

- `POST /api/v1/guest/session`
- `GET /api/v1/guest/cart`
- `POST /api/v1/guest/cart/items`
- `DELETE /api/v1/guest/cart/items/{variant_id}`
- `POST /api/v1/guest/cart/merge`
- `POST /api/v1/auth/register`
- existing `POST /api/v1/auth/login`
- `GET /api/v1/cart`

The web client stores its guest token in `localStorage.nascon_guest_token`. The native client stores its guest token in Keychain. The web client keeps the authenticated JWT in memory plus `sessionStorage`, per the root frontend contract.

### Public reads

- `GET /api/v1/public/matches/{id}`
- `GET /api/v1/public/players/{id}`
- `GET /api/v1/public/clubs/{id}`
- `GET /api/v1/public/costreams/{id}`
- `GET /api/v1/athletes/{player_id}`
- `GET /api/v1/vods?player_id=&match_id=`

### Realtime

- WebSocket match: `ws(s)://{location.host}/ws/matches/{id}`
- WebSocket co-stream: `ws(s)://{location.host}/ws/costream/{id}`
- SSE fallback/read path: `GET /api/v1/matches/{id}/stream`

Consume the exact frames documented in `day2/API-CONTRACT.md`, including `score.updated`, `match.status_changed`, `overlay.updated`, `chat.message`, participant/host changes, and notifications.

### Binding web implementation

The Guest Web Player is static HTML, vanilla JavaScript, and CSS served from `backend/src/web/`. There is no build step and no CDN dependency. URLs inside pages are relative. WebSocket URLs are built from `location.host`.

The page receives the current snapshot in:

```html
<script type="application/json" id="boot">…</script>
```

The initial score and merchandise must be visible from server-rendered/boot data without waiting for XHR.

### Binding mobile implementation

The Android manifest must include the `nascon` browsable intent filter and `android:launchMode="singleTask"`. React Navigation linking plus `Linking.getInitialURL()` is the preferred implementation; no new navigation dependency is required.

Public destinations open in guest mode before auth restore finishes. Joining, following, chatting, or other writes require member authentication.

The exact browser and native test IDs in `day2/FRONTEND-CONTRACT.md` are mandatory and must not be renamed.
