# Native Android Day 2 Specification

The root `day2/FRONTEND-CONTRACT.md` owns exact native routes, API IDs, test IDs, and manifest behavior. This document must not introduce a competing mobile contract.

## 1. Navigation and boot

Add a deep-link bootstrap before normal authenticated navigation:

- parse `nascon://entity/{id}`;
- parse `nascon://stream/{session_id}`;
- store pending destination while the app initializes;
- open the target screen directly;
- do not force the user through Login for public/read-only targets;
- show authentication only when a protected action is attempted.

Register a browsable Android intent filter for scheme `nascon` and verify both required commands from the PDF.

Use the existing React Navigation linking configuration plus `Linking.getInitialURL()`; no new navigation dependency is required. The main activity must use `android:launchMode="singleTask"` and include the exact browsable `nascon` intent filter from the root contract. HTTP App Link verification for `/q/*` is optional.

## 2. Public athlete profile

Add profile sections for career records, affiliation, upcoming fixtures, VOD archive, follow state, and follower count. Use server state for follow/unfollow and protect against duplicate taps.

## 3. Solo broadcast

Required states:

```text
idle → preparing → live → reconnecting → live
idle → preparing → failed
live → ended
live → revoked
```

Display current match/athlete context, stream status, playback URL when appropriate, dynamic score/badge/product metadata, and VOD availability.

## 4. Co-stream

Support create/join, participant grid, layout selection, host controls, chat, host handoff, reconnect, and clean termination. Participant updates must not reset the chat room or playback unnecessarily.

## 5. QR scanner

Implement permission, scan, parse, resolve, route, and failure states. The scanner must support match, player, club, and co-stream QR targets. If camera access is denied, provide an accessible explanation and a manual deep-link option.

The scanner may decode either `http(s)://…/q/{code}` or a `nascon://…` URI. For an HTTP short link, resolve it with a manual redirect request and map the relative `Location` to the in-app destination.

## 6. Notifications

Map notification types to routes:

| Event | Destination |
|---|---|
| Co-stream invite | Co-stream screen |
| Live score | Match live screen |
| Order transition | Order detail |
| Host/participant change | Co-stream screen |

Deduplicate repeated notifications and handle expired destinations.

## 7. Native states

Every Day 2 screen must implement loading, empty, error, offline/reconnecting, and success states. Use the existing plain-language error mapping and preserve the Phase I Keychain/session/offline rules.

## 8. Appium acceptance

- `nascon://entity/match-m1` foregrounds the app and opens match live within two seconds.
- `nascon://stream/cs-session-101` foregrounds the app and opens co-stream within two seconds.
- The app does not crash or stop at Login.
- Native and web clients can observe synchronized co-stream chat.

Required Appium test IDs include `match-live-screen`, `costream-screen`, `live-score-banner`, `chat-input-field`, `chat-send-btn`, and `chat-message-list`.

## 9. Guest mode and backend calls

On first launch without a member session, call `POST /api/v1/guest/session` and store the guest token in Keychain. Public reading is allowed in guest mode; joining, following, chat, and other writes open the login sheet. Use the existing configured base URL and the exact mobile endpoints in `day2/API-CONTRACT.md`.
