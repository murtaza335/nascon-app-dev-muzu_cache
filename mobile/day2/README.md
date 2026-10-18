# Day 2 Frontend Documentation

This directory is the operational source for implementing the Part II frontend requirements.

Binding source: `C:\Users\dell\Downloads\NaSCon26_Part_II_Spec_clean (1).pdf`.

The Day 2 frontend has two deliverables:

1. A zero-account Guest Web Player served at `/web/*`.
2. Native Android additions for live streaming, co-streaming, QR deep links, and notifications.

The PDF is authoritative for routes, selectors, status behavior, timing, accessibility, and test expectations. Existing Phase I mobile requirements remain regression requirements unless this directory explicitly says otherwise.

The partner-owned root `day2/` directory is the contract authority for frontend integration. Read `day2/API-CONTRACT.md` and `day2/FRONTEND-CONTRACT.md` before implementing a client. If this directory differs, root `day2/` wins.

## Current development backend

The current mobile development default is `http://10.195.242.35:8080`. Override it with `EXPO_PUBLIC_API_URL` when needed. The root Day 2 grader contract remains `http://localhost:8080`; do not replace grader URLs in the root `day2/` documents with the LAN address.

## Reading order

1. `AGENTS.md` — local execution rules and definition of done.
2. `REQUIREMENTS.md` — every frontend requirement and acceptance criterion.
3. `BACKEND-SOURCE-OF-TRUTH.md` — root backend contract map and precedence rules.
4. `GUEST-WEB.md` — Guest Web Player routes, states, DOM, and interactions.
5. `NATIVE-MOBILE.md` — Android screens, deep links, scanner, streaming, and notifications.
6. `SHARED-CONTRACTS.md` — typed client models and backend integration boundaries.
7. `TEST-PLAN.md` — Selenium, Appium, cross-surface, accessibility, and regression verification.
8. `IMPLEMENTATION-PLAN.md` — execution order for the Day 2 window.
9. `CHECKLIST.md` — final freeze checklist.

## Scope boundary

This directory specifies frontend work. Backend, media-server, QR-signing, HMAC, guest authorization, chat moderation, DLQ, metrics, and infrastructure are integration dependencies owned by the backend track. Frontend work must consume those contracts and must not replace server enforcement with UI hiding.

## Current baseline

The existing `mobile/src` application is the Phase I authenticated client. Day 2 work must preserve its Phase I journeys while adding the Part II surfaces described here. Do not delete existing league, match, roster, scoring, store, offline-sync, or session behavior during the Day 2 implementation.

## Definition of frontend completion

Frontend is complete only when the Guest Web Player passes the exact Selenium selectors and flows, the Android app passes the Appium deep-link checks, the native and web surfaces demonstrate synchronized stream/chat behavior, accessibility requirements are verified, and the APK plus test reports are available before the Day 2 freeze.

## Day 2 native dependency decision

The user approved the three native capabilities listed in D2-ADR-06. The mobile lockfile pins `expo-camera@17.0.10` (Expo SDK 54), `react-native-video@6.19.1` (HLS playback), `react-native-webrtc@124.0.6` (WHIP capture/publish), and `@config-plugins/react-native-webrtc@13.0.0` (SDK 54 prebuild integration). Camera permission text and the `nascon` Android scheme are configured in `app.json`. These modules require a rebuilt native Android app; Expo Go is not a valid runtime for WebRTC. No push-notification package was approved or added; notifications use the existing authenticated in-app WebSocket topic.
