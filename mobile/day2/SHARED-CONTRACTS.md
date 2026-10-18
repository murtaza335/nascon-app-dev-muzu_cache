# Day 2 Frontend Integration Contracts

The root `day2/API-CONTRACT.md` and `day2/FRONTEND-CONTRACT.md` are binding. This file describes client organization only.

This document defines frontend expectations, not new backend API shapes. Exact JSON names and status codes must be copied from the Part II PDF and backend contract tests.

## 1. Client boundaries

Create separate adapters for:

- guest session;
- QR resolution;
- media playback/ingest;
- realtime events;
- guest cart;
- progressive authentication/cart merge;
- chat;
- notifications;
- native deep links.

Do not create a second set of endpoint names or payloads. Web and native adapters must use the exact paths, methods, and response shapes in the root API contract.

Adapters must be testable without rendering and must expose typed loading/success/error results.

## 2. Error mapping

At minimum map:

```text
GUEST_WRITE_FORBIDDEN
PLAYER_NOT_FOUND
STREAM_NOT_FOUND
QR_NOT_FOUND
VARIANT_NOT_FOUND
KEY_REVOKED
COSTREAM_SESSION_FULL
UNSUPPORTED_LAYOUT
GUEST_TOKEN_ALREADY_MERGED
OUT_OF_STOCK
RATE_LIMITED
UNAUTHENTICATED
FORBIDDEN
```

Never display raw stack traces, SQL, paths, or opaque status codes as the only explanation.

## 3. Realtime event handling

The shared event layer must:

- connect only when needed;
- expose connection state;
- reconnect with bounded backoff;
- deduplicate by event ID or sequence;
- refresh authoritative state after reconnect;
- stop listeners on unmount/logout;
- avoid duplicate subscriptions;
- preserve stream/chat context across host handoff.

## 4. Guest scope and privacy

Guest storage must be scoped by server and guest token. Do not mix guest carts across servers or authenticated users. Do not store IP addresses, full user-agent strings, or device fingerprints.

## 5. Media behavior

The media adapter must support HLS and WebRTC URLs without leaking revoked keys into logs. It must distinguish unavailable media from a normal paused/ended stream and provide a retry path.

## 6. Deep-link behavior

Deep links must be parsed centrally and converted into typed destinations. Unknown entities, malformed IDs, and expired sessions must produce recoverable screens. Public destinations can open unauthenticated; protected actions must invoke the normal auth flow.

## 7. Dependency review

Before adding a QR, media, notification, or WebRTC library:

- confirm it is allowed by root architecture;
- confirm Android compatibility with the current Expo/RN versions;
- confirm offline install/build behavior;
- document the exact version and rationale;
- test the release build, not only Metro.
