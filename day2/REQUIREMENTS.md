# Day 2 Requirements (Part II)

Source: Part II spec §3–§8 and Appendices A–C. IDs are the spec's own (FR-3.1 … NFR-9) plus our sub-IDs.
Priority: **P0** = graded by hidden vectors / probes (must be exact) · **P1** = graded at desk/viva or by the
Selenium/Appium/k6 harness · **P2** = product completeness, do after P0/P1 are green.

## 1. Requirement index

| ID | Title | Pri | Contract | Owner |
|---|---|---|---|---|
| D2-SYS-01 | Compose brings up Phase I + Phase II stack, both salts forwarded, all healthy < 120 s | P0 | §5.2, §7.3 | Backend-A |
| D2-SYS-02 | `GET /health` 200 `{"status":"ok"}` verifies DB, Redis, media server, baseline | P0 | API-D2-01 | Backend-A |
| D2-SYS-03 | `POST /audit/v1/reset` wipes P1+P2 state and seeds Day 2 defaults | P0 | API-D2-02 | Backend-A |
| D2-SYS-04 | `DAY2_SALT` HMAC signature on every signed P2 response/record (§5.3 recipe) | P0 | §5.3, App. A | Backend-A |
| D2-SYS-05 | Phase I regression: P1 unit tests + P1 audit vectors still pass, history descends from `DAY1_BASE_SHA` | P0 | §1.2 | all |
| FR-3.1 | Athlete profile + concurrency-safe follow graph | P2 (desk) | API-D2-20…22 | Backend-B |
| FR-3.2 | Solo streaming, rotating signed stream keys, overlays, recording → VOD | P0 (key API) / P1 (media) | API-D2-03, 30…35 | Backend-A |
| FR-3.3 | 4-way co-stream, host controls, unified chat, deterministic host handoff | P0 (session API) / P1 (media, chat) | API-D2-04, 40…47 | Backend-A |
| FR-4.1 | Dynamic cryptographic QR deep-links, SVG/PNG/PDF export, scan telemetry, hybrid routing | P0 | API-D2-05…07 | Backend-B |
| FR-4.2 | Zero-account guest experience + anonymous viewer token | P1 | API-D2-50, WEB-* | Backend-B + Web |
| FR-4.3 | Server-enforced read-only boundary (403 `GUEST_WRITE_FORBIDDEN`) | P0 | API-D2-08, BR-GUEST-* | Backend-B |
| FR-4.4 | Progressive registration + atomic idempotent cart merge | P0 | API-D2-08, 51…54 | Backend-B |
| FR-5.2 | Notification bus + bounded retry + persistent DLQ | P0 (probe) / P1 (bus) | API-D2-09, 60 | Backend-A |
| FR-5.3 | Synchronous chat moderation (leetspeak mask, flood/rate mute) | P0 | API-D2-09, 45 | Backend-A |
| NFR-1 | Score event → WS/SSE clients p95 < 500 ms (25-client probe) | P0 | RT-D2-01/02 | Backend-A |
| NFR-2 | 500 guest VUs + 50 chat VUs, 15 s, 0 % failures, p95 < 800 ms | P0 | `tests/k6_load.js` | Backend-A + QA |
| NFR-6 | `GET /metrics` Prometheus text with the 5 named metrics | P0 | API-D2-10 | Backend-A |
| NFR-8 | Guest Web Player WCAG 2.1 AA (contrast, keyboard, ARIA, 48 px) | P1 | FRONTEND §2 | Web |
| NFR-9 | Privacy: no IP/UA/fingerprint in scan analytics; erasure ≤ 1 s | P0 | API-D2-11 | Backend-B |
| QA-01 | Selenium Grid 4 hub + 3 nodes on 4444 (`ready`, ≥ 3 nodes), shm 1 GB, no VNC | P0 | §6.2.1 | QA |
| QA-02 | `tests/selenium/test_guest_grid.py` 3 required cases, `pytest -n 3` | P0 | §6.2.3 | QA + Web |
| QA-03 | Appium 2 on 4723 (`ready:true`), `tests/appium/test_mobile_deeplink.py`, cross-surface chat test | P1 | §6.3 | Mobile + QA |
| QA-04 | `tests/k6_load.js` = the exact spec profile | P0 | §6.4 | QA |
| QA-05 | `.github/workflows/autograde.yml` on push: contract probes, grid check, k6 smoke | P0 | §1.3 | QA |
| QA-06 | `tests/reports/` committed: `selenium-report.xml`, `appium-report.xml`, `k6-summary.json` | P0 | §1.3 | QA |
| QA-07 | `COVERAGE_DAY2.json` at root: 5 modules, each ≥ 85 % line coverage | P0 | §7.2 | QA |
| QA-08 | Root `TRACEABILITY.md` maps every P2 ID to files + tests | P0 | §3 | QA |
| WEB-01…09 | Guest Web Player pages + 9 `data-testid` elements | P0 (DOM) / P1 (UX) | FRONTEND §2 | Web |
| MOB-D2-01…06 | `nascon://` intent-filter, deep-link screens, QR scanner, broadcaster, co-stream split view, push notifications | P1 | FRONTEND §3 | Mobile |
| EC-1…EC-4 | Hidden complexity scenarios (§8) | P0 | see §6 | owners above |

## 2. Acceptance criteria (per functional requirement)

### D2-SYS (platform)
- **D2-SYS-01** `DAY1_SALT=x DAY2_SALT=y docker compose up -d --build` from a clean clone: postgres, redis, objectstore,
  backend, worker, media, selenium-hub, 3 browser nodes all `healthy`; ports 8080, 1935, 8888, 8889, 4444 (4442/4443)
  bound on the host. Compose forwards `DAY1_SALT: ${DAY1_SALT}` and `DAY2_SALT: ${DAY2_SALT}` to backend and worker.
- **D2-SYS-02** `/health` returns 200 `{"status":"ok"}` only when DB + Redis + media server API respond and the
  baseline is seeded; otherwise 503 `SERVICE_UNAVAILABLE`. Media check is cached ≤ 2 s so the probe stays cheap.
- **D2-SYS-03** After `POST /audit/v1/reset` (same request/response as Phase I) the Day 2 baseline in §5 exists and
  every Day 2 table is empty except seeded rows; DLQ depth 0; scan counts 0; no stream keys; no co-stream sessions.
- **D2-SYS-04** Signature = `hex(HMAC_SHA256(DAY2_SALT_utf8, entity_id + "|" + canonical(sig_payload)))`; canonical =
  Python `json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False)`. The exact `entity_id` /
  `sig_payload` per endpoint is in API-CONTRACT §1.3. Reuse `lib/canonical.js` + `lib/signature.js` (Phase I proven).
  Boot refuses to start without `DAY2_SALT` (same as `DAY1_SALT`).
- **D2-SYS-05** No Phase I file is deleted; Phase I contracts are unchanged except where §9 below says so.

### FR-3.1 Athlete identity & follow graph (P2)
- FR-3.1-01 `GET /api/v1/athletes/{player_id}` returns career record (matches played/won/drawn/lost, derived from the
  Phase I event logs on read), active club, upcoming fixtures, VOD list, `follower_count`, `is_following`, live stream if any.
- FR-3.1-02 Follow/unfollow are idempotent set operations on the `(follower_id, athlete_id)` primary key
  (`INSERT … ON CONFLICT DO NOTHING` / `DELETE`). `follower_count` is `count(*)` of that table — never a separate
  counter — so it cannot drift under a toggle burst. Guests → 403 `GUEST_WRITE_FORBIDDEN`.

### FR-3.2 Solo streaming & overlays
- FR-3.2-01 (P0) Stream key lifecycle via `POST /audit/v1/stream/key` exactly per API-D2-03.
- FR-3.2-02 (P1) Ingest RTMP `rtmp://localhost:1935/live/{key}` and WHIP `http://localhost:8889/live/{key}/whip`;
  playback HLS `http://localhost:8888/live/{key}/index.m3u8` and WHEP `…:8889/live/{key}/whep`. The media server
  authorizes every publish through the backend hook (API-D2-30): only an `active` key may publish (else 409
  `KEY_REVOKED` / 404 `STREAM_NOT_FOUND`, which the hook maps to a denial).
- FR-3.2-03 (P1) Revoke/rotate severs the old key's live ingest **within 2.0 s**: synchronous kick through the media
  server API after commit, plus a 1 s reconciler in the worker as a safety net.
- FR-3.2-04 (P1) Overlays: score, club badges and pinned merch are pushed as realtime metadata frames
  (RT-D2-01 `score.updated`, `overlay.updated`) and drawn by the player over the video. The media stream is never restarted.
- FR-3.2-05 (P1) Recording: the media server records every live path; on stream end the worker uploads segments to
  the object store and inserts a `vods` row (indexed by player and match) within 10 s. VODs listed on the athlete
  profile and `/web/matches/{id}/vod`.

### FR-3.3 Co-streaming
- FR-3.3-01 (P0) `POST /audit/v1/costream/session` exactly per API-D2-04 (validation order and handoff rules).
- FR-3.3-02 (P1) Host controls through `/api/v1/costreams/{id}/…`: signed invite tokens, mute, spotlight, kick.
- FR-3.3-03 (P1) One chat room `chat-{session_id}` per session; `seq` strictly increasing by 1 per room, assigned in
  the insert transaction under a row lock on `chat_rooms` (no gaps for accepted messages, no duplicates).
- FR-3.3-04 (P1) Real host drop (WebSocket close / media un-publish of the host): within 1.5 s the next participant
  in array order becomes `active_host`; zero participants → `terminated`. The composite URL and `chat_room_id` stay
  the same. Compositor processes are supervised by the media server (`runOnDemand`), so no zombie FFmpeg survives.

### FR-4.1 Dynamic QR
- FR-4.1-01 (P0) `GET /audit/v1/qr/{entity_id}` per API-D2-05; `?inspect=true` never increments.
- FR-4.1-02 (P0) `short_url` is stable forever for an entity; `target_route` and `signature` are recomputed from
  live state on every read (EC-2).
- FR-4.1-03 (P0) Exports SVG/PNG/PDF per API-D2-06 encode the `short_url` as a real, scannable QR (ECC M).
- FR-4.1-04 (P0) `GET /q/{short_code}` → 302 with `Location: <target_route>` (relative path, so it works from inside
  the Selenium containers as well), increments scan telemetry.
- FR-4.1-05 (P0, NFR-9) Telemetry rows hold only `(entity_id, bucket_hour_utc, device_family, count)`; device family
  = `mobile|desktop` from a UA regex evaluated in memory and discarded. No IP, cookie, UA or fingerprint is stored or logged
  for `/q` and `/audit/v1/qr` (request logger skips UA/IP on these paths).
- FR-4.1-06 (P1) Hybrid routing: the web page offers "Open in app" (`nascon://entity/{id}`); Android intent-filter
  opens the native screen. QR for any `match-*`, `player-*`, `club-*`, `cs-session-*` is created lazily on first
  resolve (deterministic short code) if the entity exists.

### FR-4.2 / FR-4.3 Guest access and read-only boundary
- FR-4.2-01 Opening any `/web/*` route needs no login, no install prompt, no credential dialog on load.
- FR-4.2-02 `POST /api/v1/guest/session` issues `guest_anon_tok_<16 hex>` (TTL 2 h, role `guest`, scopes
  `["stream:read","score:subscribe","guest_cart:stage"]`).
- FR-4.3-01 (P0) **BR-GUEST-01**: any request whose `Authorization` is `Bearer guest_…` and whose method is
  POST/PUT/PATCH/DELETE on any `/api/v1/*` or `/audit/v1/*` route **except the allow-list** gets 403
  `GUEST_WRITE_FORBIDDEN` with `details.guest_token`. Checked **before** body validation, 404 and 401 (it is an
  authentication-layer decision; the grader's direct-write probes may send minimal bodies).
  Allow-list: `POST /api/v1/guest/session`, `POST|DELETE /api/v1/guest/cart/items…`, `POST /audit/v1/guest/cart-merge`
  (token is in the body there, not the header).
- FR-4.3-02 (P0) Probes that must return 403: `POST /api/v1/chat`, `POST /audit/v1/checkout`, `POST /audit/v1/events`
  with `Authorization: Bearer guest_anon_tok_7721`. Also follow, roster, score, checkout on `/api/v1`.
- FR-4.3-03 Guest tokens may read: public match/score/stream/QR/product reads, chat history, WS/SSE subscriptions.

### FR-4.4 Progressive registration & cart merge
- FR-4.4-01 Guest stages items with `POST /api/v1/guest/cart/items` (server cart keyed by guest token, mirrored in
  `localStorage` for instant UI). Login/registration prompt only on Checkout / Send Chat / Follow.
- FR-4.4-02 (P0) Merge per API-D2-08: atomic (one transaction + advisory lock on `guest_token`), quantities summed per
  `variant_id`, 409 `OUT_OF_STOCK` when a merged line exceeds available stock (no partial merge), replay of the identical
  request → 200 same cart, different user/payload after merge → 409 `GUEST_TOKEN_ALREADY_MERGED`. Merge never creates
  inventory reservations (reservation stays at checkout), so a replay cannot double-reserve (EC-4).
- FR-4.4-03 (P1) After merge the client returns to the exact playback position (`return_to` + `t` seconds kept in
  `sessionStorage`, FRONTEND §2.4).
- FR-4.4-04 `POST /api/v1/auth/register` creates a `viewer` account and returns the same body as login.

### FR-5.2 Notification bus & DLQ
- FR-5.2-01 Score updates, co-stream invites and order status transitions are published on the bus (WS/SSE).
- FR-5.2-02 Failed delivery → retry with exponential backoff, **max 3 attempts total**, then one row in `notification_dlq`
  (persistent, survives restart, cleared only by reset). `simulate_dlq: true` forces the failure path.
- FR-5.2-03 (P0) DLQ inspectable via API-D2-09 `dlq_status`; depth = row count (no separate counter → no corruption, EC-3).

### FR-5.3 Moderation (pure domain function `domain/moderation`)
- See BR-MOD-01…07 below. Same function serves `/audit/v1/moderation/test` and `/api/v1/chat`.

### NFRs
- **NFR-1** `ws://localhost:8080/ws/matches/{match_id}` (no auth, guest allowed) and SSE
  `GET /api/v1/matches/{match_id}/stream` (guest token or JWT, or none) receive `score.updated` within 500 ms p95 of the
  `POST /audit/v1/events` response for 25 concurrent clients. Publish happens in the after-commit hook, before responding.
- **NFR-2** k6 profile (§6.4) green on the grader box: 0 failed requests, p95 < 800 ms. Hot paths
  (`qr inspect`, `moderation/test` without kicks) do no DB write and at most one indexed read (in-process caches, §7 of ARCHITECTURE).
- **NFR-6** `/metrics` header exactly `Content-Type: text/plain; version=0.0.4` (no charset appended), with `# HELP`/`# TYPE`
  lines and the 5 required metric names (API-D2-10).
- **NFR-8** Guest web: text contrast ≥ 4.5:1, all controls reachable by Tab and activated by Enter/Space, visible focus,
  `aria-label` on media controls and icon buttons, modal is `role="dialog" aria-modal="true"` with focus trap + Esc,
  every interactive element ≥ 48×48 CSS px.
- **NFR-9** Erasure endpoint completes in one transaction < 1 s (API-D2-11).

## 3. Business rules

### Stream keys (BR-SK)
- BR-SK-01 `action` ∈ {generate, rotate, revoke}; `player_id` must exist (404 `PLAYER_NOT_FOUND`); `label` 1–64 chars, default `"default"`.
- BR-SK-02 One active key per player. `generate` → 201, revokes any previous active key of that player. `rotate` → 200,
  revokes prior key(s) (works also when none exists). `revoke` → 200; no key ever issued for the player → 404
  `STREAM_NOT_FOUND`; latest key already revoked → 409 `KEY_REVOKED` *(our default, Q-04)*.
- BR-SK-03 `stream_key_override` is used verbatim when present (any non-empty string ≤ 128 chars); otherwise
  `sk_live_` + 16 lowercase hex from `crypto.randomBytes(8)`. An override that names a revoked key re-activates it
  for that player (the spec says "must use this exact string").
- BR-SK-04 Ingest/playback with a revoked key → media hook denies; API surfaces 409 `KEY_REVOKED`.
- BR-SK-05 Signature: full 4-key payload `{action, player_id, status, stream_key}` (the grader accepts it; Appendix A Vector 2 is legacy).

### Co-stream (BR-CS) — order is binding
1. 400 `VALIDATION_ERROR`: `session_id` string, `host_player_id` string, `participants` non-empty array of unique
   strings, `simulate_host_drop` boolean (default false), `layout` ∈ {solo, grid_2, grid_4, spotlight} (default grid_4).
   All failing fields collected in `details.fields`.
2. 404 `PLAYER_NOT_FOUND` for the first unknown id (host first, then participants in order; `details.player_id`).
3. 400 `VALIDATION_ERROR` (`details.fields: ["host_player_id"]`) when host ∉ participants.
4. 409 `COSTREAM_SESSION_FULL` when `len(participants) > 4`.
5. 400 `UNSUPPORTED_LAYOUT` when `solo` and effective count > 1, or `grid_2` and effective count > 2
   (effective = after the host drop).
6. Handoff exactly per spec §5.5 (three branches).
- BR-CS-07 Replay: same `session_id` + byte-identical canonical request → 200 + stored body. Same `session_id`,
  different request → re-initialise the session with the new state and return 201 *(our default, Q-05)*.
- BR-CS-08 Session creation also registers the QR mapping for `cs-session-*` ids and creates chat room `chat-{session_id}`.

### QR (BR-QR)
- BR-QR-01 Entity type from id prefix: `match-` → match, `player-` → player, `club-` → club, `cs-session-` → costream.
  The entity must exist in its table; else 404 `QR_NOT_FOUND` (also for unknown short codes).
- BR-QR-02 Route rules exactly as spec §5.6. `entity_status`: match = derived status (from events, P1 projection);
  player/club = `"active"`; costream = session status (`active|terminated`).
- BR-QR-03 Seeded short codes: `m1-live` (match-m1), `p-alpha-1` (player-alpha-1), `c-alpha-1` (club-alpha-1).
  Lazily created codes: first 10 chars of base32(HMAC(DAY2_SALT, "qr|" + entity_id)) lowercased — stable, unguessable.
- BR-QR-04 `scan_count` = total scans (`/audit/v1/qr` without `inspect=true` + `/q/{code}`), incremented atomically
  (`UPDATE … SET scan_count = scan_count + 1 RETURNING`). Response shows the post-increment value.
- BR-QR-05 Match status set extended with `postponed`, `cancelled`, `abandoned` via new lifecycle event types
  (ARCHITECTURE §5.3); `upcoming` stays the default.

### Guest & cart (BR-GUEST, BR-CART)
- BR-GUEST-01 see FR-4.3-01. Applies even if the guest token is unknown/expired/erased (still a guest → still 403).
- BR-CART-01 Validation: `guest_token` non-empty string starting `guest_`; `registered_user_id` string;
  `guest_cart` 1–10 items `{variant_id: string, quantity: int ≥ 1}` (strict JSON integers); `test_write_block` bool default true.
- BR-CART-02 Order: 400 → 404 `PLAYER_NOT_FOUND` (id in `players` **or** `users`) → 404 `VARIANT_NOT_FOUND`
  (first unknown, `details.variant_id`) → **merge-state check** (replay → 200 stored; other payload/user → 409
  `GUEST_TOKEN_ALREADY_MERGED`) → 409 `OUT_OF_STOCK` (`details.variant_id`) → write-block probe → merge.
  Replay is checked before stock so a replay never fails on stock it already counted (EC-4).
- BR-CART-03 Duplicate `variant_id` lines inside one `guest_cart` are summed before checks.
- BR-CART-04 Available stock = `variants.stock − active reservations` (P1 inventory view). Merge fails as a whole on 409.
- BR-CART-05 `items` sorted by `variant_id`; `unit_price_minor` from the catalogue (current price schedule);
  `subtotal_minor = Σ qty × unit`; `currency: "PKR"`; `total_items = Σ qty`.
- BR-CART-06 `test_write_block: true` → the service calls the real guard function with the guest token on a
  synthetic `POST /api/v1/chat` request and records `write_block_verified: true, write_rejection_code: 403`.
  `false` → `write_block_verified: false, write_rejection_code: null` *(Q-06)*.

### Moderation (BR-MOD) — pure function, deterministic
- BR-MOD-01 Normalise a token: NFKC, lowercase, remove zero-width chars (U+200B–U+200D, U+2060, U+FEFF), map
  `@→a 0→o 1→i !→i 3→e $→s`, strip `_ . - *` and other non-alphanumerics. Because `!` is also punctuation, a token is
  tested in two variants (`!→i` and `!→removed`) — e.g. `s!c@m` → `sicam`/`scam`.
- BR-MOD-02 Dictionary (minimum, extendable in `domain/moderation/lexicon.js`): badword, porn, scam, fuck, shit,
  bitch, asshole, idiotspam. A token is profane when a variant equals a word or equals word + {s, es, ed, er, ing}.
- BR-MOD-03 Profane tokens are replaced by `***` keeping the token's trailing sentence punctuation
  (`b@d_w0rd,` → `***,`). Message kept with `flagged: true, reason: "profanity_leetspeak"`; sender → `kicked_users`.
- BR-MOD-04 Flood (§5.8 rule 3, binding for the probe): `/(.)\1{3,}/iu` (≥ 4 identical chars, case-insensitive) OR
  `/[!?]{3,}/` (≥ 3 consecutive `!`/`?`). Message is **dropped** from `filtered_messages`; sender → `muted_users`.
  Flood is evaluated **before** profanity (a flooding profane message is dropped and the sender only muted).
- BR-MOD-05 Rate limit: > 3 messages from one sender within 2 s → 4th+ dropped, sender → `muted_users`
  (`reason: "rate_limit_exceeded"` in the stored moderation record). In the audit probe all messages of one request
  share one timestamp; across requests the window is **not** applied on the audit probe (keeps it deterministic
  and k6-safe) but **is** applied on `/api/v1/chat` (429 `RATE_LIMITED` to the sender + mute record).
- BR-MOD-06 `kicked_users` / `muted_users`: deduplicated, in order of first violation within the request.
- BR-MOD-07 Moderation actions persist idempotently: `INSERT … ON CONFLICT (chat_room_id, user_id, action) DO NOTHING`,
  rows inserted in sorted key order (no deadlocks under 10 concurrent threads, EC-3), each row signed with DAY2_SALT.
- BR-MOD-08 `flagged_count` (signature) = number of messages with `flagged: true` in `filtered_messages`
  (dropped flood messages are not in the list, so not counted) *(Q-07)*.

### DLQ (BR-DLQ)
- BR-DLQ-01 `simulate_failed_notifications` optional int 0–100 (else 400). N > 0 → N notifications are dispatched through
  the real retry path against a transport forced to fail; each makes 3 attempts (backoff `DLQ_BACKOFF_MS·2^n`, default
  5 ms → 5, 10 ms) and lands in the DLQ. Then `dlq_status` is read.
- BR-DLQ-02 `queue_depth` = rows in `notification_dlq`; `undelivered_events` = those rows oldest first
  `{event_id, topic, target, attempts, last_error, dead_lettered_at}`. Both present whatever `check_dlq` is *(Q-08)*.

### Privacy (BR-PRIV)
- BR-PRIV-01 `DELETE /audit/v1/privacy/user/{user_id}`: id in `users` or `players` else 404 `PLAYER_NOT_FOUND`.
- BR-PRIV-02 In one transaction: user email → `erased-<sha256(id)[:12]>@invalid`, display name → `"Erased User"`,
  password hash nulled, `token_version += 1` (all JWTs dead); player display name → `"Anonymized Player"` only when the
  id is a player id; guest tokens merged into or issued for that user → `wiped` and unlinked; chat messages by the user →
  sender pseudonymised; follows by the user deleted. Repeat call → same 200 body (idempotent).

## 4. Response time / determinism rules
- Timestamps `YYYY-MM-DDTHH:MM:SSZ` (P1 rule). Money integer paisa. Arrays in documented order.
- `/audit/v1/*` is never cached and never rate-limited (P1 ADR-004, §6.4 note).

## 5. Day 2 baseline (added by reset; Phase I baseline unchanged)
| Entity | Values |
|---|---|
| player `player-beta-2` | club `club-beta-1`, name "Bilal Beta", position `df` |
| match `match-m1` | sport `football` (seed only), league `league-alpha-1`, home `club-alpha-1`, away `club-alpha-2`, status `in_progress`, score 1–0 — produced by seeded signed events `match_init` → `match_start` → one home `score` (DAY1_SALT signatures, so `/audit/v1/score/match-m1` stays consistent) |
| QR mappings | `match-m1` → `m1-live`, `player-alpha-1` → `p-alpha-1`, `club-alpha-1` → `c-alpha-1`, all `scan_count: 0` |
| guest token | `guest_anon_tok_7721`, role guest, valid (expires +24 h after reset), unmerged |
| member cart | `player-alpha-1` → empty (`items: []`) |
| chat room | `chat-cs-session-101` pre-created (k6 posts to it before any session exists) |
| pinned merch | `match-m1.pinned_product_id = prod-jersey-001` (overlay + `pinned-merch-card`) |
| DLQ | empty (depth 0) |

## 6. Hidden complexity scenarios (§8) — required behaviour
| # | Scenario | Our mechanism | Test |
|---|---|---|---|
| EC-1 | Host drop mid-broadcast | BR-CS rule 6; composite URL and chat id derived from `session_id` only, never from host; compositor restarts under media supervision | `test_costream_api.py::test_host_drop_*`, unit `handoff.test.js` |
| EC-2 | QR target mutation post-print | target computed per read from live status; signature recomputed; short_url stored once | `test_qr_api.py::test_target_mutation_*` |
| EC-3 | 10 concurrent moderator kicks | pure evaluation + `ON CONFLICT DO NOTHING` sorted inserts; DLQ depth = `count(*)` | `test_moderation_api.py::test_concurrent_kick_race` (10 threads) |
| EC-4 | Cart merge replay on network switch | advisory lock + stored merge receipt checked before stock; merge never reserves | `test_cart_merge_api.py::test_replay_*` |

## 7. Out of scope / explicitly not done
- iOS build (spec allows Android **or** iOS; we ship Android).
- Real SFU (LiveKit). We use MediaMTX + FFmpeg composition (spec allows either).

## 8. Open questions (raise in writing with organizers early; our default applies until answered)
| Q | Question | Our default |
|---|---|---|
| Q-01 | How does the grader move `match-m1` to `postponed`/`cancelled`/`abandoned` via `/audit/v1/events`? | Accept event types `match_postponed`, `match_cancelled`, `match_abandoned` (aliases `match_postpone`, `match_cancel`, `match_abandon`) and `status_change` with `payload.status` |
| Q-02 | Is the guest-bearer 403 evaluated before body validation? | Yes, first (FR-4.3-01) |
| Q-03 | `entity_status` for player/club QR | `"active"` |
| Q-04 | Revoking an already-revoked key | 409 `KEY_REVOKED` (never issued → 404 `STREAM_NOT_FOUND`) |
| Q-05 | Same `session_id`, different body | re-initialise, 201 |
| Q-06 | `write_rejection_code` when `test_write_block:false` | `null`, `write_block_verified:false` |
| Q-07 | `flagged_count` includes dropped flood messages? | No (only flagged messages in `filtered_messages`) |
| Q-08 | `dlq_status` when `check_dlq:false` | still returned |
| Q-09 | Does `[!?]{3,}` include mixed `!?!`? | Yes |
| Q-10 | FR-4.4 "capped by stock" vs §5.7 "409 OUT_OF_STOCK" | 409 everywhere (the audit contract is explicit) |
| Q-11 | Status code for first-time cart merge | 200 (spec shows only 200) |

## 9. Conflicts found and how we resolved them
| Conflict | Resolution |
|---|---|
| Spec §6.2.1 compose sample uses `container_name`; AGENTS §3 + `ci.yml` forbid it | Omit `container_name` (no probe depends on names; service names `selenium-hub`, `backend` are what the network uses). |
| Spec sample tags `selenium/*:4.25.0`; this machine only has 4.24.0 cached and cannot pull | Compose uses `${SELENIUM_TAG:-4.25.0}`; local runs export `SELENIUM_TAG=4.24.0`. |
| Spec workflow triggers on push to `main`; repo branch is `master` | `autograde.yml` triggers on `main` **and** `master`. |
| P1 rule "/health must not depend on MinIO" vs P2 §5.1 "/health verifies Media Server" | Health checks the media server (not the object store). Media check cached 2 s; documented in ARCHITECTURE §9. |
| FR-3.3 flood rule (non-alnum ≥4, any ≥5, kick+mute) vs §5.8 probe rule (any ≥4, `!!!`/`???`, mute only) | §5.8 is the binding audit contract → BR-MOD-04/05. |
| FR-4.4 "capped by stock" vs §5.7 409 | Q-10. |
| AGENTS push windows (Day 1) | Replaced by Day 2 windows in `day2/README.md`; AGENTS gets a pointer. |
