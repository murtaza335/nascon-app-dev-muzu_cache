# Day 2 Frontend Requirements

This file translates the binding Part II PDF into frontend acceptance criteria. It does not alter the PDF contract.

## 1. Deliverables

### D2-FE-01 Guest Web Player

Serve a responsive, zero-install, zero-account web experience from the API origin at `/web/*`.

It must support live match playback, co-stream playback, score updates, pinned merchandise, guest cart staging, moderated chat display, and progressive authentication.

### D2-FE-02 Native Android client

Extend the Phase I Android app with solo broadcast, co-stream participation, public athlete/VOD views, QR scanning, Android deep links, and real-time notification entry points.

### D2-FE-03 Cross-surface operation

The native app and Guest Web Player must be able to participate in the same co-stream context and observe synchronized chat and live state.

## 2. Functional requirements

### FR-3.1 Public Athlete Identity and Social Graph

The frontend must provide a public athlete profile showing:

- career match records;
- active club affiliations;
- upcoming fixtures;
- indexed completed-stream/VOD archive;
- follow/unfollow state;
- follower count;
- loading, failure, and retry behavior.

Follow and unfollow must be treated as server-confirmed idempotent operations. The UI must prevent duplicate in-flight toggles and reconcile the returned state rather than incrementing counts optimistically forever.

### FR-3.2 Solo Streaming and Dynamic Overlays

Native streaming UI must support:

- starting and stopping a stream;
- stream state: idle, preparing, live, reconnecting, ended, failed, revoked;
- WebRTC WHIP or RTMP ingest status;
- HLS or WebRTC playback status;
- rotating/revoked stream-key errors;
- live score overlay;
- club badge overlay;
- pinned merchandise overlay;
- recording/VOD availability after termination.

Overlays must update through realtime metadata without restarting the media stream.

### FR-3.3 Four-way Co-streaming

Native and web UI must support up to four participants and layouts:

- `solo`;
- `grid_2`;
- `grid_4`;
- `spotlight`.

The UI must display:

- participants and connection state;
- active host;
- participant count;
- host handoff indicator;
- unified chat room;
- composite playback;
- host-only mute, spotlight, and kick controls.

If the primary host disconnects, the UI must update to the server-selected active host without resetting the chat room or treating the session as a new stream.

### FR-4.1 Dynamic QR Deep Links

The frontend must support QR targets for matches, clubs, players, and co-stream sessions.

Match routes must follow current state:

- upcoming → `/web/matches/{id}/preview`;
- in progress → `/web/matches/{id}/live`;
- completed → `/web/matches/{id}/vod`;
- postponed/cancelled/abandoned → `/web/matches/{id}/notice?state={status}`.

Other targets:

- player → `/web/players/{id}`;
- club → `/web/clubs/{id}`;
- co-stream → `/web/costream/{id}`.

Native targets:

- `nascon://entity/{entity_id}`;
- `nascon://stream/{session_id}`.

The web client must handle route mutation after a QR poster was printed. The short URL may remain stable while the resolved target changes.

### FR-4.2 Zero-account guest experience

The initial guest page must:

- open without login;
- avoid installation prompts;
- avoid credential dialogs;
- provide playback, score, cart staging, and read-only content immediately;
- create/use a short-lived anonymous guest session supplied by the server.

### FR-4.3 Server-enforced read-only boundary

The frontend must correctly handle `403 GUEST_WRITE_FORBIDDEN` for guest attempts to:

- post chat;
- follow an athlete;
- checkout directly;
- mutate scores;
- mutate roster state.

For chat and checkout, the UI must open progressive authentication while preserving the staged cart and current stream context. It must not append blocked chat locally or show an order as paid.

### FR-4.4 Progressive registration and cart merge

The frontend must:

- stage guest cart items;
- display quantity and item count;
- invoke authentication only on protected actions;
- submit the guest token and cart for atomic merge;
- handle successful merge;
- handle exact-request idempotent replay;
- handle `GUEST_TOKEN_ALREADY_MERGED`;
- handle `OUT_OF_STOCK`;
- handle `VARIANT_NOT_FOUND`;
- return to the exact stream context and nearest available playback timestamp.

### FR-5.2 Notifications and DLQ-facing behavior

Frontend must consume/display realtime events for:

- score updates;
- co-stream invitations;
- order status changes;
- participant/host changes;
- chat updates where applicable.

Failed delivery is backend-owned. The frontend must display reconnecting, unavailable, and delayed-notification states without duplicating events.

### FR-5.3 Chat moderation

The web and native chat views must display server-filtered messages. Masked profanity must appear as `***`. Flood-rejected messages must not appear in the broadcast list. The client must show a plain-language moderation or rate-limit message when its own message is rejected.

## 3. Non-functional requirements

### NFR-1 realtime score latency

The live score banner must update within 500 ms of the server event under the specified test conditions.

### NFR-2 load compatibility

The frontend must remain functional under the specified guest-viewer and chat-poster load. Avoid unnecessary polling, unbounded reconnect loops, and per-render network requests.

### NFR-6 observability compatibility

The UI must expose enough client state to diagnose connection, playback, and stream failures. Backend Prometheus metrics are not a frontend substitute for visible recovery states.

### NFR-8 accessibility

Guest Web Player must meet WCAG 2.1 AA expectations from the PDF:

- contrast at least 4.5:1;
- full keyboard navigation;
- semantic ARIA labels for media controls;
- 48 × 48 CSS-pixel touch targets.

### NFR-9 privacy

The frontend must not send or persist IP addresses, full user-agent strings, cookies, or device fingerprints as QR telemetry. It must support the server's privacy-erasure outcome without retaining personal data in local caches.

## 4. Required DOM contract

These selectors are binding:

```text
[data-testid="guest-video-player"]
[data-testid="live-score-banner"]
[data-testid="pinned-merch-card"]
[data-testid="add-to-guest-cart-btn"]
[data-testid="guest-cart-count"]
[data-testid="chat-message-list"]
[data-testid="chat-input-field"]
[data-testid="chat-send-btn"]
[data-testid="progressive-auth-modal"]
```

## 5. Phase I regression requirements

Do not regress:

- login and session restore;
- role-aware navigation;
- fixtures, standings, clubs, match detail;
- store, cart, checkout, receipt, and orders;
- roster management;
- scoring and compensation;
- offline queue persistence and sync;
- logout and server switching;
- Android build and APK generation.
