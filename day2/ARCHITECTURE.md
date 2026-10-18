# Day 2 Architecture

Extends the Phase I design (root `ARCHITECTURE.md`): same layering `routes → services → domain | repos | lib`,
same error catalogue, same `/audit` + `/api` sharing one service per behaviour, single API instance (P1 ADR-013).

## 1. Topology (`docker-compose.yml`, one file, grader runs it as-is)
```
                    host ports
 backend  :8080  ── Express API + /web + /q + /metrics + WS (/ws/matches, /ws/costream, /api/v1/ws)
 media    :1935 RTMP · :8888 HLS · :8889 WebRTC WHIP/WHEP (+ :8189/udp ICE) · :9997 API (internal only)
 selenium-hub :4444 (+4442/4443) ── node-chrome-1, node-chrome-2, node-firefox (shm 1gb, VNC off, 2 sessions each)
 postgres, redis, objectstore (P1, internal), worker (P1 + media reconciler + VOD uploader + DLQ retries)
```
| Service | Image | Healthcheck | New? |
|---|---|---|---|
| backend | `nascon-backend:local` (build `./backend`) | `wget /health` | env: + `DAY2_SALT`, `PUBLIC_BASE_URL`, `PUBLIC_MEDIA_HOST`, `MEDIA_API_URL`, `MEDIA_HOOK_TOKEN` |
| worker | same | heartbeat file | env: + `DAY2_SALT`, `MEDIA_API_URL`, recordings volume (ro) |
| media | `nascon-media:local` (build `./media`: `FROM node:22-alpine` + `COPY --from=bluenviron/mediamtx:1.9.1 /mediamtx` + `apk add ffmpeg` when `WITH_FFMPEG=true`) | `wget -qO- 127.0.0.1:9997/v3/paths/list` | **yes** (approval: D2-ADR-02) |
| selenium-hub | `selenium/hub:${SELENIUM_TAG:-4.25.0}` | `curl -sf 127.0.0.1:4444/status \| grep -q '"ready": true'` | **yes** |
| node-chrome-1/2 | `selenium/node-chrome:${SELENIUM_TAG:-4.25.0}` | `curl -sf 127.0.0.1:5555/status` | **yes**; `extra_hosts: ["host.docker.internal:host-gateway"]` |
| node-firefox | `selenium/node-firefox:${SELENIUM_TAG:-4.25.0}` | same | **yes** |

Why a wrapper media image: the upstream `bluenviron/mediamtx` image is `FROM scratch` (no shell → no healthcheck,
no hook commands). Multi-stage copy keeps the exact binary and gives us `wget` (hooks + healthcheck) and FFmpeg
(composition). Locally (no registry access) build with `MEDIA_WITH_FFMPEG=false`; composition then falls back to
client-side tiles (FRONTEND §2.6).

Startup budget (120 s): postgres ~5 s, backend ~10 s, media ~2 s, selenium hub+nodes ~25–40 s. `backend` must **not**
depend on selenium; `/health` depends on media (spec) so `backend` gets `depends_on: media: service_healthy`.

## 2. Backend modules (new files)
```
backend/src/
  domain/                         pure, unit-tested, counted in COVERAGE_DAY2.json
    streaming/streamKey.js        validate request, decide transition (generate/rotate/revoke), build response + sig payload
    costream/session.js           validation order, handoff state machine, layout capacity
    costream/inviteToken.js       sign/verify invite tokens (salt injected)
    qr/route.js                   entity type from id, target_route from status, short-code derivation
    qr/encoder.js                 QR matrix (byte mode, ECC M, v1–10) — vendored/ported, see D2-ADR-04
    qr/render.js                  matrix → SVG string, PNG buffer (node:zlib in service layer), PDF ops
    guest/cartMerge.js            validate, sum lines, stock check, merge, receipt + sig payload
    guest/guard.js                isGuestBearer(header), isAllowListed(method, path)
    moderation/normalize.js       leetspeak normalisation, variants
    moderation/lexicon.js         dictionary
    moderation/engine.js          evaluate(messages, {now, windowState}) → filtered/kicked/muted/records
    notify/retry.js               backoff schedule, attempt decision (max 3)
    observability/metrics.js      render Prometheus text from a snapshot object
    privacy/erase.js              anonymised field values
  services/
    streaming.js costream.js qr.js guest.js cart.js chat.js moderation.js notify.js dlq.js
    metrics.js privacy.js athletes.js media.js (media API client: kick, list paths, bitrate)
  repos/  streamKeys.js costreams.js qr.js guestTokens.js carts.js chat.js moderation.js dlq.js follows.js vods.js
  routes/audit/  streamKey.js costream.js qr.js guest.js moderation.js privacy.js
  routes/        qrShort.js (/q), metrics.js (/metrics), web.js (/web/*), internalMedia.js (/internal/*)
  routes/api/    guest.js cart.js chat.js athletes.js streams.js costreams.js public.js notifications.js sse.js
  http/middleware/guestWriteGuard.js   mounted FIRST after jsonBody on /api/v1 and /audit/v1
  realtime/ws.js                       + upgrade paths /ws/matches/:id, /ws/costream/:id (anonymous)
  web/                                 static guest player: index templates, css/app.css, js/{player,whep,chat,cart,auth,errors}.js
  migrations/002_day2.sql
media/  Dockerfile  mediamtx.yml  compose.sh (FFmpeg xstack compositor run by runOnDemand)
```
`http/app.js` order: requestId → jsonBody → **guestWriteGuard** → health, metrics, `/q`, `/web`, `/internal`
→ `/audit/v1` routers → `/api/v1` (rateLimit → public → guest-or-member authenticate → protected) → 404 → errors.
`authenticate` gains a guest branch: `Bearer guest_…` + read method → `req.principal = {role:'guest', guest_token}`;
routes marked G accept it, M routes reject with 401 (writes never reach there: the guard already 403'd).

## 3. Data (migration `002_day2.sql`, forward-only; P1 tables untouched except noted)
```sql
-- P1 changes
ALTER TABLE users ADD COLUMN token_version integer NOT NULL DEFAULT 0, ADD COLUMN erased_at timestamptz;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;            -- erasure
-- streaming
CREATE TABLE stream_keys (stream_key text PRIMARY KEY, player_id text NOT NULL REFERENCES players(player_id),
  label text NOT NULL, status text NOT NULL CHECK (status IN ('active','revoked')), match_id text,
  live boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
  signature text NOT NULL);
CREATE UNIQUE INDEX stream_keys_one_active ON stream_keys(player_id) WHERE status = 'active';
CREATE TABLE vods (vod_id text PRIMARY KEY, stream_key text, player_id text, match_id text, session_id text,
  object_key text NOT NULL, duration_s integer, recorded_at timestamptz NOT NULL);
CREATE INDEX vods_player_idx ON vods(player_id); CREATE INDEX vods_match_idx ON vods(match_id);
-- co-stream
CREATE TABLE costream_sessions (session_id text PRIMARY KEY, host_player_id text NOT NULL, active_host text,
  participants jsonb NOT NULL, active_participants jsonb NOT NULL, layout text NOT NULL, status text NOT NULL,
  handoff_occurred boolean NOT NULL, request_hash text NOT NULL, response jsonb NOT NULL, match_id text,
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE costream_participant_state (session_id text, player_id text, muted boolean DEFAULT false,
  spotlight boolean DEFAULT false, kicked boolean DEFAULT false, PRIMARY KEY (session_id, player_id));
-- QR
CREATE TABLE qr_codes (entity_id text PRIMARY KEY, short_code text NOT NULL UNIQUE, entity_type text NOT NULL,
  scan_count bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE qr_scan_buckets (entity_id text, bucket_hour timestamptz, device_family text CHECK (device_family IN ('mobile','desktop')),
  scans bigint NOT NULL DEFAULT 0, PRIMARY KEY (entity_id, bucket_hour, device_family));   -- no IP / UA / cookie columns, by design
-- guest + cart
CREATE TABLE guest_tokens (guest_token text PRIMARY KEY, status text NOT NULL CHECK (status IN ('active','merged','wiped')),
  linked_user_id text, merged_request_hash text, merge_receipt jsonb, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE guest_cart_items (guest_token text REFERENCES guest_tokens ON DELETE CASCADE, variant_id text REFERENCES variants,
  quantity integer NOT NULL CHECK (quantity > 0), PRIMARY KEY (guest_token, variant_id));
CREATE TABLE carts (user_id text PRIMARY KEY, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE cart_items (user_id text REFERENCES carts ON DELETE CASCADE, variant_id text REFERENCES variants,
  quantity integer NOT NULL CHECK (quantity > 0), PRIMARY KEY (user_id, variant_id));
-- chat + moderation
CREATE TABLE chat_rooms (chat_room_id text PRIMARY KEY, last_seq bigint NOT NULL DEFAULT 0);
CREATE TABLE chat_messages (chat_room_id text REFERENCES chat_rooms, seq bigint, message_id text NOT NULL,
  client_message_id text, sender text NOT NULL, text text NOT NULL, flagged boolean NOT NULL, reason text,
  sent_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (chat_room_id, seq), UNIQUE (chat_room_id, client_message_id));
CREATE TABLE moderation_actions (chat_room_id text, user_id text, action text CHECK (action IN ('kick','mute')),
  reason text NOT NULL, signature text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_room_id, user_id, action));
-- notifications
CREATE TABLE notification_dlq (dlq_id bigserial PRIMARY KEY, event_id text NOT NULL UNIQUE, topic text NOT NULL,
  target text NOT NULL, payload jsonb NOT NULL, attempts integer NOT NULL, last_error text NOT NULL,
  dead_lettered_at timestamptz NOT NULL DEFAULT now());
-- social
CREATE TABLE follows (follower_id text NOT NULL, athlete_id text NOT NULL REFERENCES players(player_id),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (follower_id, athlete_id));
CREATE INDEX follows_athlete_idx ON follows(athlete_id);
```
`services/reset.js` `TABLES` list gains every table above (TRUNCATE … RESTART IDENTITY). Seeding lives in
`seed/day2.js`, called from `seedBaseline` (so `/health`'s `baseline_version` bump to `p2-1` covers it).

### 3.1 Match lifecycle extension (Q-01)
`domain/scoring/eventRules.js` + `projection.js`: new event types `match_postponed`, `match_cancelled`, `match_abandoned`
(+ aliases normalised in the route, and `status_change` with `payload.status`). Allowed from `upcoming` or `in_progress`;
terminal (later events → 409 `ILLEGAL_TRANSITION`). Phase I vectors don't send them, so Phase I behaviour is unchanged.

## 4. Media pipeline (FR-3.2, FR-3.3)
- `media/mediamtx.yml`: `authMethod: http`, `authHTTPAddress: http://backend:8080/internal/media/auth`,
  `api: yes` (`:9997`, internal), `hls: yes` (`:8888`, `hlsVariant: lowLatency`, segment 1 s), `webrtc: yes` (`:8889`,
  `webrtcLocalUDPAddress: :8189`, `webrtcAdditionalHosts` from env for LAN), `rtmp: yes` (`:1935`), `record: yes`
  (`fmp4`, `/recordings/%path/%Y-%m-%d_%H-%M-%S-%f`, segment 10 s).
- Hooks (`runOnReady`, `runOnNotReady`, `runOnRecordSegmentComplete`) → `wget --post-data` to `/internal/media/events`.
- Path `~^costream/(.+)$`: `runOnDemand: /compose.sh $G1`, `runOnDemandRestart: yes`, `runOnDemandCloseAfter: 10s`.
  `compose.sh` reads `/internal/costream/{id}/inputs`, builds an FFmpeg `xstack`/`overlay` graph for the layout, publishes
  `rtsp://127.0.0.1:8554/costream/{id}`, and exits when the input list changes (poll 1 s) → MediaMTX restarts it. MediaMTX
  owns the child, so no orphan/zombie FFmpeg (EC-1). When FFmpeg is absent, `compose.sh` exits 1 and web/mobile show tiles.
- Revocation (FR-3.2-03): `services/streaming.revoke` commits, then calls `media.kickPath('live/'+key)` (GET
  `/v3/paths/get/…` → kick `rtmpconns`/`webrtcsessions`/`rtspsessions` by source id) with a 1 s timeout; worker
  reconciler every 1 s kicks any ready `live/*` path whose key is not active. Measured target < 2 s.
- VOD (FR-3.2-05): on `not_ready` the worker uploads the path's segments from the shared `recordings` volume to the
  object store (`vods/{stream_key}/…`), inserts `vods`, publishes `vod.ready`. Playback through the backend
  (`/web/vod/{vod_id}/…` proxy) or MediaMTX playback server.
- Bitrate/active streams (NFR-6): `services/media.js` polls `/v3/paths/list` every 2 s → `{ready_count, bytesReceived}` →
  kbps = Δbytes·8/Δt/1000. Snapshot held in memory; `/metrics` never waits on the media server.

## 5. Guest boundary (FR-4.3)
`guestWriteGuard(req)`: `^Bearer\s+(guest_[^\s]*)$` on `Authorization` AND method ∈ {POST, PUT, PATCH, DELETE}
AND not allow-listed → `AppError(E.GUEST_WRITE_FORBIDDEN, {guest_token})`. Pure predicate in `domain/guest/guard.js`
(unit-tested over every write route in the route table — a test enumerates `app._router` writes and asserts 403).
The cart-merge probe's `test_write_block` calls the same predicate + the error factory, then records 403.

## 6. Moderation & chat (FR-5.3, FR-3.3-03)
- `domain/moderation/engine.evaluate(messages, opts)` is pure: order per message = rate window → flood → profanity → clean.
- `/audit/v1/moderation/test`: evaluate → if kicks/mutes, one transaction inserting sorted `moderation_actions`
  rows `ON CONFLICT DO NOTHING` → DLQ simulate (if N>0) → read depth (in-memory mirror, §7) → sign → 200. No chat rows persisted.
- `/api/v1/chat`: evaluate single message with the sender's real 2 s window (in-memory Map per room+sender, pruned) →
  blocked → 429 + mute; else `UPDATE chat_rooms SET last_seq = last_seq + 1 … RETURNING` + insert in one tx → publish
  `chat.message` to `chat:{room}` (WS costream/match sockets + `/api/v1/ws`) after commit.

## 7. Performance design (NFR-1, NFR-2)
- k6 load ≈ 500 VUs × (1 req / ~0.1 s) ⇒ up to ~4–5 k req/s on `GET /audit/v1/qr/match-m1?inspect=true` + ~250 req/s moderation.
- **QR inspect hot path: zero DB round-trips.** In-process caches: `qrCache` (entity_id → short_code, type, scan_count)
  and `statusCache` (match_id → status), both filled on first read and **updated synchronously in the same after-commit
  hook that publishes score/status events** (single API instance, ADR-013), so a read right after `POST /audit/v1/events`
  sees the new status (EC-2). Signature HMAC per request (~2 µs). Reset clears both caches.
- Response serialisation: pre-built JSON template per entity, only `scan_count`/`signature` vary.
- Moderation hot path (clean messages, `check_dlq:false`): no DB; DLQ depth from an in-memory mirror updated after each
  DLQ insert commit and reloaded from `count(*)` at boot and reset.
- Node: `UV_THREADPOOL_SIZE=8`, keep-alive 65 s, `server.maxConnections` unlimited, pg pool 20, Express `etag` off,
  request logging sampled (1 %) on `/audit/v1/qr` and `/metrics`.
- NFR-1: after-commit hook publishes to the in-process WS hub (no Redis hop) → typical < 20 ms.
- If k6 p95 still > 800 ms on the grader box: enable Node `cluster` for 2 workers? **No** — breaks single-instance
  caches; instead precompute and reduce allocations. (Documented to prevent a risky late change.)

## 8. Configuration (new env; all have defaults except `DAY2_SALT`)
| Var | Default | Used by |
|---|---|---|
| `DAY2_SALT` | — (boot fails if empty) | backend, worker |
| `PUBLIC_BASE_URL` | `http://localhost:8080` | QR `short_url`, export URLs |
| `PUBLIC_MEDIA_HOST` | `localhost` | ingest/playback URLs in responses |
| `MEDIA_API_URL` | `http://media:9997` | backend, worker |
| `MEDIA_HOOK_TOKEN` | `media-hook-dev` (internal network only) | backend, media |
| `DLQ_BACKOFF_MS` | `5` | notify retry |
| `GUEST_TOKEN_TTL_SECONDS` | `7200` | guest session |
| `SELENIUM_TAG` | `4.25.0` | compose |
| `MEDIA_WITH_FFMPEG` | `true` | media build arg |
| `MEDIA_WEBRTC_HOSTS` | `` | LAN IP for phones (desk) |
`config.js` stays the only reader of `process.env`; `.env.example` gets placeholders (never the real salt).

## 9. Health
`/health` = DB ping + Redis ping + baseline `p2-1` + media API reachable (memoised 2 s, timeout 500 ms). Spec §5.1/§5.2.

## 10. Known limitations / risks
| Risk | Mitigation |
|---|---|
| Cannot pull images locally (`selenium:4.25.0`, `alpine` apk for FFmpeg) | `SELENIUM_TAG=4.24.0`, `MEDIA_WITH_FFMPEG=false` locally; CI (`autograde.yml`) verifies the defaults on GitHub |
| 3 browser nodes + stack on 8 GB runner | shm 1 GB, VNC off, 2 sessions/node, no `node-edge` |
| WebRTC from inside containers needs UDP ICE | publish `8189/udp`; `MEDIA_WEBRTC_HOSTS` for LAN; HLS always works |
| Appium needs a device; GitHub runner has none | Appium runs on Laptop 2 (`scripts/appium-up.sh`); CI job only reports skipped device tests honestly |
