# Day 2 Backend API Contract

Binding for backend implementation and for both clients. Graded shapes (§1–§2) are copied from the Part II spec
character for character; **never rename, add required keys to, or reorder the meaning of these fields.**
Product endpoints (§3) are ours; the mobile app and the Guest Web Player code against them.

Base URL: `http://localhost:8080` (inside compose: `http://backend:8080`). JSON UTF-8. Body limit 1 MB → 413 `PAYLOAD_TOO_LARGE`.

## 1. Global conventions

### 1.1 Error envelope (every non-2xx)
```json
{ "error": { "code": "GUEST_WRITE_FORBIDDEN", "message": "Anonymous guest tokens cannot perform write mutations.", "details": { "guest_token": "guest_anon_tok_7721" } } }
```
`details` is always an object (`{}` when empty). 400 `VALIDATION_ERROR` carries `details.fields: [<field>, …]`.

### 1.2 Check order (all Day 2 routes)
`guest-bearer write guard (403 GUEST_WRITE_FORBIDDEN)` → `authentication (401, /api/v1 protected only)` → `400` → `404` →
`403 FORBIDDEN (RBAC)` → `409/402` → success. The co-stream and cart-merge endpoints have their own exact sequences (§2.3, §2.6).

### 1.3 DAY2 signature recipe
`signature = lowercase_hex(HMAC_SHA256(key=DAY2_SALT utf-8, msg = entity_id + "|" + canonical(sig_payload)))`

| Endpoint | entity_id | sig_payload (exact keys) |
|---|---|---|
| `POST /audit/v1/stream/key` | `stream_key` | `{action, player_id, status, stream_key}` |
| `POST /audit/v1/costream/session` | `session_id` | `{active_host, handoff_occurred, layout, participant_count, session_id, status}` |
| `GET /audit/v1/qr/{entity_id}` | `entity_id` | `{entity_id, short_url, target_route}` |
| `POST /audit/v1/guest/cart-merge` | `guest_token` | `{cart_merged, guest_token, registered_user_id, total_items, write_rejection_code}` |
| `POST /audit/v1/moderation/test` | `chat_room_id` | `{chat_room_id, flagged_count, kicked_users, queue_depth}` |

`active_host` may be `null` → canonical `null`. Implementation: `lib/signature.js#sign(day2Salt, id, canonical(payload))`.

### 1.4 Error codes used by Day 2 (Appendix B + Phase I)
| HTTP | code | Emitted by |
|---|---|---|
| 400 | `VALIDATION_ERROR` | all |
| 400 | `UNSUPPORTED_LAYOUT` | costream |
| 401 | `UNAUTHENTICATED` | `/api/v1` protected |
| 403 | `GUEST_WRITE_FORBIDDEN` | guest guard |
| 403 | `FORBIDDEN` | RBAC (host controls by non-host, etc.) |
| 404 | `PLAYER_NOT_FOUND` | stream key, costream, cart-merge, privacy, athletes |
| 404 | `STREAM_NOT_FOUND` | stream key revoke, costream controls, media hook |
| 404 | `QR_NOT_FOUND` | qr, export, `/q` |
| 404 | `VARIANT_NOT_FOUND` | cart-merge, guest cart |
| 404 | `MATCH_NOT_FOUND` / `ROUTE_NOT_FOUND` | public match reads / unknown path |
| 409 | `COSTREAM_SESSION_FULL` | costream create/join |
| 409 | `KEY_REVOKED` | revoke-again, media publish/read with revoked key |
| 409 | `GUEST_TOKEN_ALREADY_MERGED` | cart-merge |
| 409 | `OUT_OF_STOCK` | cart-merge, guest cart, checkout |
| 413 | `PAYLOAD_TOO_LARGE` | body > 1 MB |
| 429 | `RATE_LIMITED` | `/api/v1/*` limiter, chat flood on `/api/v1/chat` |
| 503 | `SERVICE_UNAVAILABLE` | `/health` |

## 2. Graded autograder interface

### API-D2-01 `GET /health`
200 `{"status":"ok"}` when DB, Redis, media API (`http://media:9997/v3/paths/list`, cached 2 s) and baseline are OK; else 503 `SERVICE_UNAVAILABLE`.

### API-D2-02 `POST /audit/v1/reset`
Request/response unchanged from Phase I. Additionally truncates every Day 2 table, clears in-process caches (QR,
status, DLQ depth, moderation windows), kicks all live media sessions, and seeds the Day 2 baseline (REQUIREMENTS §5).

### API-D2-03 `POST /audit/v1/stream/key`
Request
```json
{ "action": "rotate", "player_id": "player-alpha-1", "label": "OBS-Main-Desk", "stream_key_override": "sk_live_9f83a1b2c3d4e5f6" }
```
| Field | Rule | Error |
|---|---|---|
| `action` | required, `generate`/`rotate`/`revoke` | 400 |
| `player_id` | required string, must exist | 400 / 404 `PLAYER_NOT_FOUND` |
| `label` | optional string 1–64, default `"default"` | 400 |
| `stream_key_override` | optional non-empty string ≤ 128 | 400 |

Response 201 (`generate`) / 200 (`rotate`, `revoke`)
```json
{
  "player_id": "player-alpha-1",
  "label": "OBS-Main-Desk",
  "stream_key": "sk_live_9f83a1b2c3d4e5f6",
  "status": "active",
  "ingest_endpoints": {
    "rtmp": "rtmp://localhost:1935/live/sk_live_9f83a1b2c3d4e5f6",
    "webrtc": "http://localhost:8889/live/sk_live_9f83a1b2c3d4e5f6/whip"
  },
  "playback_url": "http://localhost:8888/live/sk_live_9f83a1b2c3d4e5f6/index.m3u8",
  "signature": "<64 hex>"
}
```
`revoke`: `"status": "revoked"`, `"ingest_endpoints": null`, `"playback_url": null`, `stream_key` = the revoked key,
`label` = that key's label. Errors: revoke with no key ever → 404 `STREAM_NOT_FOUND`; revoke when latest already revoked → 409 `KEY_REVOKED`.
URL hosts come from `PUBLIC_MEDIA_HOST` (default `localhost`) so the literal strings above hold on the grader.

### API-D2-04 `POST /audit/v1/costream/session`
Request
```json
{ "session_id": "cs-session-101", "host_player_id": "player-alpha-1",
  "participants": ["player-alpha-1","player-alpha-2","player-beta-1","player-beta-2"],
  "layout": "grid_4", "simulate_host_drop": true }
```
Exact check order: 400 schema → 404 `PLAYER_NOT_FOUND` → 400 host ∉ participants → 409 `COSTREAM_SESSION_FULL` (>4)
→ 400 `UNSUPPORTED_LAYOUT` → handoff.

| simulate_host_drop | len | active_host | handoff_occurred | participant_count | active_participants | status |
|---|---|---|---|---|---|---|
| false | n | host_player_id | false | n | participants | `active` |
| true | ≥ 2 | first of participants without host | true | n − 1 | participants without host | `active` |
| true | 1 | `null` | false | 0 | `[]` | `terminated` |

Response 201 (200 on identical replay)
```json
{
  "session_id": "cs-session-101",
  "status": "active",
  "active_host": "player-alpha-2",
  "handoff_occurred": true,
  "participant_count": 3,
  "active_participants": ["player-alpha-2","player-beta-1","player-beta-2"],
  "layout": "grid_4",
  "composite_playback_url": "http://localhost:8888/costream/cs-session-101/index.m3u8",
  "chat_room_id": "chat-cs-session-101",
  "signature": "<64 hex>"
}
```
`composite_playback_url` and `chat_room_id` are present also when `terminated` (derived from `session_id` only).

### API-D2-05 `GET /audit/v1/qr/{entity_id}[?inspect=true]`
Response 200
```json
{
  "entity_id": "match-m1",
  "entity_type": "match",
  "entity_status": "in_progress",
  "short_url": "http://localhost:8080/q/m1-live",
  "target_route": "/web/matches/match-m1/live",
  "deep_link_uri": "nascon://entity/match-m1",
  "scan_count": 1,
  "export_formats": {
    "svg": "http://localhost:8080/audit/v1/qr/match-m1/export.svg",
    "png": "http://localhost:8080/audit/v1/qr/match-m1/export.png",
    "pdf": "http://localhost:8080/audit/v1/qr/match-m1/export.pdf"
  },
  "signature": "<64 hex>"
}
```
| entity | `entity_type` | `entity_status` | `target_route` |
|---|---|---|---|
| match upcoming | match | upcoming | `/web/matches/{id}/preview` |
| match in_progress | match | in_progress | `/web/matches/{id}/live` |
| match completed | match | completed | `/web/matches/{id}/vod` |
| match postponed/cancelled/abandoned | match | that status | `/web/matches/{id}/notice?state={status}` |
| `player-*` | player | active | `/web/players/{id}` |
| `club-*` | club | active | `/web/clubs/{id}` |
| `cs-session-*` | costream | active / terminated | `/web/costream/{id}` |

Without `inspect=true` the scan counter increments before the response (value shown = after increment). Unknown → 404 `QR_NOT_FOUND`.
`deep_link_uri` is always `nascon://entity/{entity_id}`. Base for URLs: `PUBLIC_BASE_URL` (default `http://localhost:8080`).

### API-D2-06 `GET /audit/v1/qr/{entity_id}/export.{svg|png|pdf}`
| fmt | Content-Type | Body |
|---|---|---|
| svg | `image/svg+xml` | starts `<svg` (or `<?xml`), QR of `short_url`, `<title>` = short_url |
| png | `image/png` | 8-byte PNG magic, ≥ 4 px/module, 4-module quiet zone |
| pdf | `application/pdf` | starts `%PDF-`, A4 poster: vector QR + literal text `entity_id` and `short_url` |
Export does **not** count as a scan. Unknown entity → 404 `QR_NOT_FOUND`; other `fmt` → 404 `ROUTE_NOT_FOUND`.

### API-D2-07 `GET /q/{short_code}`
302 `Location: <target_route>` (relative path, e.g. `/web/matches/match-m1/live`), `Cache-Control: no-store`; increments
scan count + telemetry bucket. Unknown → 404 `QR_NOT_FOUND` (JSON envelope). Not rate limited.

### API-D2-08 `POST /audit/v1/guest/cart-merge`
Request
```json
{ "guest_token": "guest_anon_tok_7721", "registered_user_id": "player-alpha-1",
  "guest_cart": [ { "variant_id": "var-jersey-001-L", "quantity": 1 } ], "test_write_block": true }
```
Order: 400 → 404 `PLAYER_NOT_FOUND` → 404 `VARIANT_NOT_FOUND` (`details.variant_id`) → replay (200 stored) /
409 `GUEST_TOKEN_ALREADY_MERGED` (`details.guest_token`, `details.merged_user_id`) → 409 `OUT_OF_STOCK`
(`details.variant_id`, `details.requested`, `details.available`) → write-block probe → merge (one tx).

Response 200
```json
{
  "guest_token": "guest_anon_tok_7721",
  "write_block_verified": true,
  "write_rejection_code": 403,
  "cart_merged": true,
  "active_cart": {
    "user_id": "player-alpha-1", "currency": "PKR", "total_items": 1, "subtotal_minor": 450000,
    "items": [ { "variant_id": "var-jersey-001-L", "quantity": 1, "unit_price_minor": 450000 } ]
  },
  "signature": "<64 hex>"
}
```
**Direct write enforcement:** `Authorization: Bearer guest_anon_tok_7721` on `POST /api/v1/chat`, `POST /audit/v1/checkout`,
`POST /audit/v1/events` (and every other non-allow-listed write) → 403 `GUEST_WRITE_FORBIDDEN`, `details.guest_token`.

### API-D2-09 `POST /audit/v1/moderation/test`
Request
```json
{ "chat_room_id": "chat-cs-session-101",
  "incoming_messages": [ { "message_id": "msg-1", "sender": "user-guest-1", "text": "Clean sports commentary" } ],
  "check_dlq": true, "simulate_failed_notifications": 0 }
```
| Field | Rule |
|---|---|
| `chat_room_id` | required non-empty string (unknown rooms are created on the fly; no 404) |
| `incoming_messages` | required array 0–500 of `{message_id: string, sender: string, text: string ≤ 2000}` |
| `check_dlq` | optional bool, default true |
| `simulate_failed_notifications` | optional int 0–100, default 0 |

Response 200
```json
{
  "chat_room_id": "chat-cs-session-101",
  "filtered_messages": [
    { "message_id": "msg-1", "sender": "user-guest-1", "text": "Clean sports commentary", "flagged": false, "reason": null },
    { "message_id": "msg-2", "sender": "user-spammer", "text": "Watch this illegal stream *** now!", "flagged": true, "reason": "profanity_leetspeak" }
  ],
  "kicked_users": ["user-spammer"],
  "muted_users": ["user-flooder"],
  "dlq_status": { "queue_depth": 0, "undelivered_events": [] },
  "signature": "<64 hex>"
}
```
`undelivered_events[i]` = `{ "event_id": "dlq-000001", "topic": "notification.simulated", "target": "simulated-subscriber", "attempts": 3, "last_error": "simulated_delivery_failure", "dead_lettered_at": "2026-10-18T10:00:00Z" }`.

### API-D2-10 `GET /metrics`
200, `Content-Type: text/plain; version=0.0.4` (exact, no charset). Minimum body:
```
# HELP nascon_active_ws_connections Open WebSocket connections.
# TYPE nascon_active_ws_connections gauge
nascon_active_ws_connections 3
# HELP nascon_active_streams_total Live media paths currently publishing.
# TYPE nascon_active_streams_total gauge
nascon_active_streams_total 1
# HELP nascon_stream_bitrate_kbps Ingest bitrate across live streams (kbps).
# TYPE nascon_stream_bitrate_kbps gauge
nascon_stream_bitrate_kbps 2480
# HELP nascon_dlq_depth Notifications in the dead-letter queue.
# TYPE nascon_dlq_depth gauge
nascon_dlq_depth 0
# HELP nascon_qr_scans_total QR scans since reset.
# TYPE nascon_qr_scans_total counter
nascon_qr_scans_total 1
```
Optional extras (same file): per-stream `nascon_stream_bitrate_kbps{stream="live/<key-prefix>"}`, `nascon_http_requests_total{route,code}`,
`nascon_sse_connections`. Stream keys are never printed in full (first 12 chars).

### API-D2-11 `DELETE /audit/v1/privacy/user/{user_id}`
200 `{"user_id":"player-alpha-1","status":"anonymized","pii_retained":false,"tokens_wiped":true}`; unknown → 404 `PLAYER_NOT_FOUND`; idempotent.

## 3. Product API (`/api/v1/*`, consumed by mobile + guest web)
Auth header: `Authorization: Bearer <jwt | guest_anon_tok_…>`. **G** = guest token or no token allowed (read),
**M** = member JWT required, **H** = co-stream host (or admin). Rate limit 100 req / 10 s per IP (Phase I) except SSE/WS.

### 3.1 Auth & guest
| ID | Method & path | Auth | Request | 2xx response |
|---|---|---|---|---|
| API-D2-50 | `POST /api/v1/guest/session` | none | `{}` | 201 `{"guest_token":"guest_anon_tok_<16hex>","role":"guest","scopes":["stream:read","score:subscribe","guest_cart:stage"],"expires_at":"…Z"}` |
| API-D2-51 | `GET /api/v1/guest/cart` | guest | — | 200 `{"guest_token","items":[{variant_id,quantity,unit_price_minor}],"total_items","subtotal_minor","currency":"PKR"}` |
| API-D2-52 | `POST /api/v1/guest/cart/items` | guest | `{"variant_id","quantity"}` (adds; qty int 1–10) | 200 cart (as 51); 404 `VARIANT_NOT_FOUND`; 409 `OUT_OF_STOCK` |
| API-D2-53 | `DELETE /api/v1/guest/cart/items/{variant_id}` | guest | — | 200 cart |
| API-D2-54 | `POST /api/v1/guest/cart/merge` | M | `{"guest_token","return_to"?}` (server reads the staged guest cart) | 200 same body as API-D2-08 plus `"return_to"` echoed; same errors; same service function |
| API-D2-55 | `POST /api/v1/auth/register` | none | `{"email","password"(≥8),"display_name"}` | 201 same body as login; email already taken → 400 `VALIDATION_ERROR` `details.fields:["email"]` |
| — | `POST /api/v1/auth/login` | none | Phase I | Phase I |
| API-D2-56 | `GET /api/v1/cart` | M | — | 200 `active_cart` object (shape of API-D2-08 `active_cart`) |

### 3.2 Public reads (guest web player data)
| ID | Method & path | Auth | 200 response |
|---|---|---|---|
| API-D2-57 | `GET /api/v1/public/matches/{id}` | G | `{"match_id","status","home":{"team_id","name","badge_url","score"},"away":{…},"score_text":"1 - 0","pinned_product":{"product_id","name","variant_id","unit_price_minor","stock_available"}|null,"stream":{"status":"live|offline","hls_url","whep_url"}|null,"vod":[{vod_id,playback_url,duration_s}],"chat_room_id":"chat-match-<id>"}` ; 404 `MATCH_NOT_FOUND` |
| API-D2-58 | `GET /api/v1/public/players/{id}` | G | athlete profile (= API-D2-20 without `is_following`) |
| API-D2-59 | `GET /api/v1/public/clubs/{id}` | G | `{"club_id","name","badge_url","players":[…],"upcoming":[…],"live_matches":[…]}` |
| API-D2-61 | `GET /api/v1/public/costreams/{id}` | G | `{"session_id","status","layout","active_host","active_participants":[{player_id,name,muted,spotlight,hls_url,whep_url}],"composite_playback_url","chat_room_id"}`; 404 `STREAM_NOT_FOUND` |
| RT-D2-02 | `GET /api/v1/matches/{id}/stream` | G | SSE `text/event-stream`; events `score.updated`, `match.status_changed`, `overlay.updated`; heartbeat comment every 15 s |

### 3.3 Athletes & follow (FR-3.1)
| ID | Method & path | Auth | Response |
|---|---|---|---|
| API-D2-20 | `GET /api/v1/athletes/{player_id}` | G/M | `{"player_id","name","position","club":{club_id,name},"career":{"matches":n,"wins":n,"draws":n,"losses":n,"score_events":n},"upcoming_fixtures":[{match_id,scheduled_at,opponent}],"vods":[{vod_id,title,playback_url,recorded_at,duration_s}],"live":{"stream_key_prefix","hls_url"}|null,"follower_count":n,"is_following":bool}` |
| API-D2-21 | `PUT /api/v1/athletes/{player_id}/follow` | M | 200 `{"player_id","following":true,"follower_count":n}` (idempotent) |
| API-D2-22 | `DELETE /api/v1/athletes/{player_id}/follow` | M | 200 `{"player_id","following":false,"follower_count":n}` (idempotent) |

### 3.4 Streaming (FR-3.2)
| ID | Method & path | Auth | Notes |
|---|---|---|---|
| API-D2-31 | `POST /api/v1/streams/key` | M (player or admin; own player only) | same body/response/service as API-D2-03 (no override field) |
| API-D2-32 | `GET /api/v1/streams/me` | M | current key (masked except to owner) + status + endpoints |
| API-D2-33 | `GET /api/v1/streams/live` | G | `[{player_id, match_id|null, hls_url, whep_url, started_at}]` |
| API-D2-34 | `PUT /api/v1/streams/me/match` | M | `{"match_id"}` binds the live stream to a match (overlay source) |
| API-D2-35 | `GET /api/v1/vods?player_id=&match_id=` | G | VOD list |

### 3.5 Co-stream (FR-3.3)
| ID | Method & path | Auth | Body → response |
|---|---|---|---|
| API-D2-40 | `POST /api/v1/costreams` | M (player) | `{"session_id"?, "layout"}` → 201 session (shape API-D2-61) with caller as host |
| API-D2-41 | `POST /api/v1/costreams/{id}/invites` | H | `{"player_id"}` → 201 `{"invite_token":"<b64url payload>.<hmac>","expires_at"}` (HMAC DAY2_SALT, 10 min) |
| API-D2-42 | `POST /api/v1/costreams/{id}/join` | M | `{"invite_token"}` → 200 session + `{"publish":{"whip_url","rtmp_url"}}`; 409 `COSTREAM_SESSION_FULL`; 403 `FORBIDDEN` bad/expired token |
| API-D2-43 | `POST /api/v1/costreams/{id}/participants/{player_id}/{mute|unmute|spotlight|kick}` | H | 200 session; publishes `costream.participant_changed` |
| API-D2-44 | `POST /api/v1/costreams/{id}/leave` | M | 200 session (host leaving = handoff rule) |
| API-D2-45 | `POST /api/v1/chat` | M (guest → 403) | `{"chat_room_id","text","client_message_id"}` → 201 `{"message_id","chat_room_id","seq","sender","text","flagged","reason","sent_at"}`; flood/rate → 429 `RATE_LIMITED` (`details.reason`); idempotent on `client_message_id` |
| API-D2-46 | `GET /api/v1/chat/{chat_room_id}/messages?after_seq=0&limit=50` | G | `{"chat_room_id","messages":[…as 45…],"last_seq"}` |
| API-D2-47 | `POST /api/v1/notifications/test` | M (admin) | `{"topic","target_user_id","simulate_dlq":bool}` → 202 `{"notification_id"}` |

### 3.6 Internal (media server → backend; Docker network only, header `X-Media-Hook-Token: ${MEDIA_HOOK_TOKEN}`)
| ID | Path | Purpose |
|---|---|---|
| API-D2-30 | `POST /internal/media/auth` | MediaMTX `authHTTPAddress`. Body `{user,password,ip,action,path,protocol,id,query}`. 200 allow / 401 deny. `publish` on `live/{key}` needs active key; `publish` on `costream/{id}` only from compositor (`user=compositor`, `password=${MEDIA_HOOK_TOKEN}`); `read`/`playback` allowed unless key revoked. |
| API-D2-36 | `POST /internal/media/events` | `{event: ready|not_ready|segment_complete, path, segment_path?, duration_s?}` from media hooks → live state, handoff on host un-publish, VOD indexing |
| API-D2-37 | `GET /internal/costream/{id}/inputs` | compositor script reads current participants + layout (text lines) |

## 4. Realtime

### RT-D2-01 `ws://localhost:8080/ws/matches/{match_id}` (no auth; guest OK)
Server → client frames (JSON text):
```json
{ "type": "hello", "match_id": "match-m1", "score_text": "1 - 0", "status": "in_progress", "version": 3 }
{ "type": "score.updated", "match_id": "match-m1", "home_score": 2, "away_score": 0, "score_text": "2 - 0", "status": "in_progress", "version": 4, "event_id": "evt-9", "emitted_at": "…Z" }
{ "type": "match.status_changed", "match_id": "match-m1", "from": "in_progress", "to": "completed" }
{ "type": "overlay.updated", "match_id": "match-m1", "pinned_product": { … } | null, "badges": { "home": "…", "away": "…" } }
{ "type": "chat.message", "chat_room_id": "chat-match-match-m1", "message": { …API-D2-45 body… } }
```
Unknown match → close code 4404. Ping every 20 s; idle clients closed after 60 s without pong.

### RT-D2-03 `ws://localhost:8080/ws/costream/{session_id}`
Frames: `hello` (session snapshot), `costream.participant_changed`, `costream.host_changed` `{from,to,handoff_occurred:true}`,
`costream.terminated`, `chat.message`. A **host** connects with `?token=<jwt>`; its socket close (no reconnect within
1.0 s) triggers the host-drop handoff (FR-3.3-04).

### RT-D2-04 Existing `/api/v1/ws?token=<jwt>` (Phase I)
Gains topics `user:{user_id}` (notifications: `costream.invite`, `order.status_changed`) and `chat:{room_id}`.
