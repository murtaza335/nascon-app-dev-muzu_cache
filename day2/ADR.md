# Day 2 Architecture Decision Records

Status: **Accepted** = within AGENTS §7 agent authority · **Needs approval** = new service/dependency/compose change;
a human must say yes (AGENTS §7). Recommended option first.

| ID | Decision | Status |
|---|---|---|
| D2-ADR-01 | Same monolith + worker; Day 2 code as new modules, no new backend process | Accepted |
| D2-ADR-02 | Media server = MediaMTX 1.9.1 in a wrapper image (`media/`), not LiveKit/SRS | **Needs approval** (new container) |
| D2-ADR-03 | Selenium Grid 4 hub + 2 Chrome + 1 Firefox nodes in the main compose | **Needs approval** (new containers; spec-mandated) |
| D2-ADR-04 | QR encoding without an npm dependency: port of Nayuki's MIT QR generator into `domain/qr/encoder.js`; PNG via `node:zlib`; PDF via our P1 hand-written PDF writer | Accepted (vendored MIT code, attribution header). Alternative `qrcode@1.5.4` = needs approval |
| D2-ADR-05 | Guest Web Player = static HTML/vanilla JS served by the backend; WHEP via native `RTCPeerConnection`; native HLS fallback; no hls.js | Accepted |
| D2-ADR-06 | Mobile libs: `react-native-video` (HLS), `react-native-webrtc` (WHIP publish + split view), `react-native-vision-camera` or `expo-camera` (QR scan) | **Needs approval** (ADR-017 list) — fallback without them: deep links + "Open in browser" + manual code entry + RTMP-from-OBS |
| D2-ADR-07 | Guest write guard is a global middleware evaluated before validation/auth | Accepted (Q-02) |
| D2-ADR-08 | In-process QR/status/DLQ-depth caches updated in after-commit hooks; `/audit` reads still reflect live state | Accepted (does not violate P1 ADR-004: no stale data, no Redis cache on `/audit`) |
| D2-ADR-09 | Follower count = `count(*)` over `follows` PK; no counter column | Accepted |
| D2-ADR-10 | Chat sequence via `chat_rooms.last_seq` row lock | Accepted |
| D2-ADR-11 | DLQ = Postgres table; retries in-process with bounded backoff; depth mirror in memory | Accepted |
| D2-ADR-12 | Compositor = FFmpeg run by MediaMTX `runOnDemand` (supervised, restart on change) | Accepted with D2-ADR-02 |
| D2-ADR-13 | Appium is not in compose; `scripts/appium-up.sh` (npm `appium@2` + `uiautomator2`) on Laptop 2 | Accepted (dev tool, not runtime) |
| D2-ADR-14 | Test-only Python deps (`selenium`, `pytest-xdist`, `Appium-Python-Client`, `pytest-timeout`) in `tests/requirements.txt` | Accepted (not runtime) |

## D2-ADR-02 Media server
**Context.** §1.1/§6.1 require a self-hosted server on 1935/8888/8889 with RTMP + WHIP ingest, HLS + WHEP playback,
recording, and key revocation within 2 s. The only images available offline here are `bluenviron/mediamtx:1.9.1`
and `livekit/livekit-server:v1.7.2`.
**Decision.** MediaMTX: one binary covers all four protocols on the exact ports, has an HTTP auth callback (key checks in our
backend), a control API (kick sessions → revocation), built-in recording and `runOnDemand` (supervised compositor).
LiveKit needs its own SDK for ingest (no plain RTMP/HLS without Egress/Ingress services = 2 more containers).
**Consequence.** Wrapper image so we have a shell for healthchecks/hooks and optional FFmpeg.

## D2-ADR-04 QR encoder
**Context.** Exports must be real, scannable QR codes in SVG/PNG/PDF. Adding `qrcode` pulls 3 transitive deps.
**Decision.** Port the Nayuki QR Code generator (MIT, ~500 lines, widely verified) into the pure domain; we only need
byte mode, ECC M. Unit tests decode our own output with a reference vector (known matrix for a short string) and
the Python suite decodes the PNG with `pyzbar` when available (skip otherwise).
**Fallback.** If the port is not green by 12:30, request approval for `qrcode@1.5.4` (exact pin).

## D2-ADR-07 Guard before validation
**Context.** §5.2 lists 403 after 404, but §5.7 "direct write enforcement" fires guest-bearer requests at
`/audit/v1/events` and `/audit/v1/checkout` whose bodies we cannot predict; a 400 there would fail the probe.
**Decision.** The guest token is an *authentication* fact; it is rejected first, like 401 would be.
