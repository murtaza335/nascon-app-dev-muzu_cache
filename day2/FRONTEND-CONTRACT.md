# Day 2 Frontend Contract (Guest Web Player + Mobile)

20 % of Part II marks, but the Selenium (§6.2) and Appium (§6.3) probes are automated: the selectors and deep links
below are **binding**. Data comes only from the endpoints in [`API-CONTRACT.md`](API-CONTRACT.md).

## 1. Guest Web Player — routes
Served by the backend on port 8080 (static HTML + vanilla JS + CSS from `backend/src/web/`, no build step, no CDN,
works offline inside the grader network). All URLs inside pages are **relative** and the WebSocket URL is built from
`location.host`, so the same page works at `http://localhost:8080`, `http://backend:8080` and `http://host.docker.internal:8080`.

| Route | Page | Must show |
|---|---|---|
| `/web/matches/{id}/live` | Live player | all 9 test ids (§2.2), live video, score banner, pinned merch, chat |
| `/web/matches/{id}/preview` | Upcoming | teams, kickoff time, pinned merch, "Remind me" (auth-gated), countdown |
| `/web/matches/{id}/vod` | Replay | VOD player (or "Replay processing" state), final score |
| `/web/matches/{id}/notice?state=postponed|cancelled|abandoned` | Notice | plain-language status message, link to club |
| `/web/players/{id}` | Athlete | profile, career record, VODs, Follow (auth-gated), "Open in app" |
| `/web/clubs/{id}` | Club | badge, squad, upcoming + live matches |
| `/web/costream/{id}` | Co-stream | all 9 test ids (video = composite or tile grid per layout), unified chat |

Unknown entity → page with "We couldn't find that match" + link home (HTTP 404, still HTML). No login wall, install
prompt or credential dialog appears on load (FR-4.2-01). "Open in app" link = `nascon://entity/{id}` (never auto-fired).

## 2. Live page DOM contract

### 2.1 Layout (mobile-first, one column < 768 px, video + side panel ≥ 768 px)
```
┌────────────────────────────── header: club badges · live-score-banner · LIVE pill ──┐
│ guest-video-player (16:9)                                                            │
│   overlay layer: score chip, badges, pinned merch chip (from WS overlay frames)       │
├───────────────────────────────┬──────────────────────────────────────────────────────┤
│ pinned-merch-card             │ chat-message-list (aria-live="polite")              │
│  Jersey L · PKR 4,500         │ …                                                   │
│  [add-to-guest-cart-btn]      │ [chat-input-field........] [chat-send-btn]          │
│  Cart: guest-cart-count       │                                                     │
└───────────────────────────────┴──────────────────────────────────────────────────────┘
progressive-auth-modal (hidden until a protected action)
```

### 2.2 Mandatory `data-testid` (exact strings, all present in the initial HTML, not injected later)
| data-testid | Element | Behaviour (verified by Selenium) |
|---|---|---|
| `guest-video-player` | `<video>` | visible on load (≥ 1×1 px, not `display:none`), `aria-label="Live match video"`, `controls`, `muted`, `playsinline`, `autoplay`. Source: WHEP (`RTCPeerConnection`, no library) → fallback native HLS `src` → poster "Stream starting soon". Visible even with no stream. |
| `live-score-banner` | `<div>` with `role="status" aria-live="polite"` | text exactly `"{home} - {away}"` e.g. `1 - 0`, filled from the server-rendered HTML (no wait for JS); updated from WS `score.updated` within 500 ms, no reload |
| `pinned-merch-card` | `<div>` | shows `prod-jersey-001` name, variant `var-jersey-001-L`, price; has `data-variant-id="var-jersey-001-L"` |
| `add-to-guest-cart-btn` | `<button type="button">` | adds `var-jersey-001-L` qty 1: optimistic `guest-cart-count += 1`, then `POST /api/v1/guest/cart/items` (rolls back + toast on error) |
| `guest-cart-count` | `<span>` | integer text only (`"0"` → `"1"`); initial value from `localStorage`/server cart, `"0"` for a fresh session |
| `chat-message-list` | `<ul>` (scrollable, `role="log"`) | renders history (`GET /api/v1/chat/{room}/messages`) + WS `chat.message`; masked words already `***` from the server |
| `chat-input-field` | `<input type="text">` | `aria-label="Chat message"`, maxlength 2000 |
| `chat-send-btn` | `<button type="submit">` | guest: `POST /api/v1/chat` with guest bearer → 403 `GUEST_WRITE_FORBIDDEN` → message **not** appended, input kept, `progressive-auth-modal` shown. Member: append on 201 by `seq`. |
| `progressive-auth-modal` | `<div role="dialog" aria-modal="true" aria-labelledby>` | `hidden` attribute on load (Selenium asserts not visible). Opens on guest chat send / checkout / follow. Tabs: Log in · Create account. Keeps staged cart. Esc / Close button closes; focus trapped; focus returns to the trigger. |

Extra (non-mandatory) test ids we add for our own tests: `auth-email`, `auth-password`, `auth-submit`, `auth-error`,
`checkout-btn`, `open-in-app-link`, `stream-status`, `costream-tile-{player_id}`.

### 2.3 Data & realtime flow
1. Server renders the page with the current snapshot embedded (`<script type="application/json" id="boot">` from
   API-D2-57/61) → banner and merch visible without waiting for XHR (Test 1: ≤ 3 s).
2. JS: guest token = `localStorage.nascon_guest_token` or `POST /api/v1/guest/session`.
3. Open `ws(s)://{location.host}/ws/matches/{id}` (or `/ws/costream/{id}`); on `score.updated` set banner text;
   on close: reconnect with backoff 0.5/1/2/4 s, and poll `GET /api/v1/public/matches/{id}` every 2 s while disconnected.
4. Video: try WHEP `POST {whep_url}` SDP offer; on failure set `video.src = hls_url` if `canPlayType('application/vnd.apple.mpegurl')`;
   otherwise keep poster + "Stream unavailable in this browser — open in app" text. (Selenium only checks visibility.)

### 2.4 Progressive auth & resume (FR-4.4-03)
- Before opening the modal store `sessionStorage.nascon_resume = {"return_to": location.pathname, "t": video.currentTime, "pending": {"type":"chat","text":"…"}}`.
- Login (`POST /api/v1/auth/login`) or register (`POST /api/v1/auth/register`) → JWT kept in memory + `sessionStorage`
  (web only; mobile uses Keychain) → `POST /api/v1/guest/cart/merge {guest_token, return_to}` → set
  `guest-cart-count` from `active_cart.total_items` → seek video to `t` → re-send the pending chat as member.
- Errors in plain language (map in `web/js/errors.js`, same wording as `mobile/src/.../errorMessages.ts`):
  `INVALID_CREDENTIALS` "That email and password don't match.", `OUT_OF_STOCK` "Only {available} left — we kept the rest in your cart.",
  `GUEST_TOKEN_ALREADY_MERGED` "Your cart was already moved to your account.", network "You're offline — we'll retry."

### 2.5 Accessibility (NFR-8, checked by Selenium DOM inspection)
- Colours from tokens with ≥ 4.5:1 text contrast in both themes (dark `#0B0F14` bg / `#F5F7FA` text; accent `#FFB020` only on dark text).
- Every `button`, `a`, `input` ≥ 48×48 CSS px (`min-height:48px; min-width:48px`), visible `:focus-visible` ring 3 px.
- Tab order: video → banner → merch → add → chat input → send; Enter submits chat; Space/Enter activates buttons.
- `<html lang="en">`, one `<h1>` per page, landmarks `header/main/aside`, `aria-label` on every icon-only control,
  status never by colour alone (LIVE pill has text).
- Our Selenium suite asserts: computed contrast of banner/body text, `getBoundingClientRect()` ≥ 48 for interactive
  elements, `aria-label` on video, modal `role=dialog`.

### 2.6 Co-stream page
`/web/costream/{id}`: same 9 ids. `guest-video-player` plays `composite_playback_url`; when the composite is not live,
a CSS grid (`grid_2`, `grid_4`, `spotlight`, `solo`) of per-participant `<video data-testid="costream-tile-{id}">` is shown
**inside** the `guest-video-player` container's sibling — the mandatory `<video>` stays visible. Chat room
`chat-{session_id}`; `pinned-merch-card` shows the match's pinned product or the default `prod-jersey-001`.
`live-score-banner` shows the linked match score or `"0 - 0"`.

## 3. Mobile app (React Native, Android)

### 3.1 Deep links (P0 for Appium)
`AndroidManifest.xml` main activity gains (exactly, plus `android:launchMode="singleTask"`):
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="nascon" />
</intent-filter>
```
Plus an `android:autoVerify="true"` App Link filter for `http://localhost:8080/q/*` *(optional, desk only)*.

| URI | Screen | Login required? |
|---|---|---|
| `nascon://entity/match-{x}` | MatchLive `{matchId}` | **No** — opens as guest if no session (Appium: foreground ≤ 2 s, never stops on Login) |
| `nascon://entity/player-{x}` | PlayerProfile | No |
| `nascon://entity/club-{x}` | ClubProfile | No |
| `nascon://entity/cs-session-{x}` and `nascon://stream/cs-session-{x}` | CoStreamView `{sessionId}` | No (viewing); join requires login |
| anything else | Home + toast "That link isn't supported" | No |

Implementation: `@react-navigation/native` `linking` config (no new dependency) + `Linking.getInitialURL()` for cold start;
the navigator renders the target screen **before** auth restore finishes (guest mode by default).

### 3.2 New / changed screens (each implements loading · empty · error · success · offline, P1 AGENTS §8)
| Screen | Data | Notes |
|---|---|---|
| MatchLive | API-D2-57 + RT-D2-01 | video (WebView-free: `react-native-video` HLS — needs approval, fallback "Open in browser" button to `/web/matches/{id}/live`), score banner, pinned merch, chat |
| QRScanner | camera | decodes `http(s)://…/q/{code}` or `nascon://…` → navigates in-app (resolves `/q` with `fetch(…, {redirect:'manual'})` and maps `Location`). Needs camera lib (D2-ADR-06). Fallback: paste/enter code field. |
| GoLive (broadcaster) | API-D2-31/32 | shows key status, rotate/revoke, RTMP URL for OBS with copy; in-app WHIP publish if `react-native-webrtc` approved |
| CoStreamView | API-D2-61 + RT-D2-03 | split view by layout (2×2 / 1×2 / spotlight), host controls (mute/spotlight/kick) when caller is host, unified chat |
| CoStreamInvite | API-D2-41/42 | host picks squad member → invite; invitee accepts from notification |
| AthleteProfile (extend PlayerProfile) | API-D2-20…22 | follow/unfollow (optimistic, reconciles to server `follower_count`), VOD list |
| Notifications | RT-D2-04 `user:{id}` | in-app banner + list; Android local notification when backgrounded (Notifee/expo-notifications needs approval; fallback in-app only) |

Accessibility for all new screens: tap targets ≥ 48 dp, `accessibilityLabel` on icons, no colour-only state, plain-language errors.
Testability: every Appium-touched element has `testID` = the same names as the web where applicable
(`live-score-banner`, `chat-input-field`, `chat-send-btn`, `chat-message-list`) plus `match-live-screen`, `costream-screen`.

### 3.3 Mobile ↔ backend rules
- Guest mode: on first launch without a session the app calls `POST /api/v1/guest/session` and stores the guest token in the Keychain;
  writes trigger the login sheet, then `POST /api/v1/guest/cart/merge`.
- Base URL from settings (existing `config/env.ts`); emulator `10.0.2.2:8080`, device = Laptop 1 LAN IP.
- Realtime: `ws://{host}/ws/matches/{id}` and `/ws/costream/{id}`; reconnect with backoff; offline banner when NetInfo says offline.
