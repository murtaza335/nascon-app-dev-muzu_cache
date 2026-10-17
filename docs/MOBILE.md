# Mobile setup and desk-check handoff

The existing Expo/React Native Android app in `mobile/` contains all 21 screen
designs as a mock-data UI preview. Do not initialize a second app or nested Git
repository. Functional service integration and native acceptance remain pending. Product behavior: [REQUIREMENTS](../REQUIREMENTS.md) sections 8-10;
structure: [ARCHITECTURE](../ARCHITECTURE.md) section 11; libraries: ADR-017.

## Setup and current commands

Follow [mobile/README.md](../mobile/README.md) for the exact Windows SDK/JDK,
prebuild, device, Metro and TypeScript commands. Run them inside `mobile/`.
Use `npm ci` to restore the lockfile. Add only approved dependencies with
`npx expo install`, recording exact installed versions under ADR-017.

The locked scaffold has Expo 54.0.37 / React Native 0.81.5 / React 19.1.0.
React Navigation is installed and wired. SQLite, Keychain, device connectivity
detection and sync remain unimplemented. Settings validates a server URL in memory.
Use Login → Explore screen designs → Settings → Screen Studio to inspect roles
and presentation states. All writes clearly report that integration is unavailable.
The current native setup script is machine-specific, and an Android build is
not verified by this documentation review. Native directories are generated and
ignored; configuration changes must be reproducible from tracked files.

- Backend target: `http://<backend laptop LAN IP>:8080` on a physical phone.
- Emulator default: `http://10.0.2.2:8080`.
- Same laptop over USB: `adb reverse tcp:8080 tcp:8080`, then use
  `http://localhost:8080`. Metro forwarding on 8081 is separate.
- Build-time default: `EXPO_PUBLIC_API_URL`. A runtime server-address setting
  reachable from Login remains required by MOB-01/MOB-10.
- Production routes: `/api/v1/*`; errors:
  `{error:{code,message,details:{}}}` with `details.fields` on validation failures.
  Use one plain-language error map; do not use the legacy `error_code` parser.
- SQLite stores cached data and queued actions; tokens belong only in Keychain
  backed by Android Keystore. AsyncStorage does not satisfy SQLite persistence.

## Screen implementation handoff

[mobile/SCREEN-PLAN.md](../mobile/SCREEN-PLAN.md) records the documentation review,
retained directory layout, screen inventory, role navigation, shared states and
integration questions. Implement the judged journeys with loading, empty, error,
success and offline states. This document does not claim any journey passes yet.

## Release delivery (pending verification)

The required artifact is `mobile/release/app-release.apk`, installable on Android
10 (API 29) or newer. Build a native APK that runs without Metro. Track repeatable
release HTTP configuration and signing in the Expo/native setup workflow; a
manual edit to ignored generated Android files will not survive prebuild.
Follow ADR-017's planned signing choice. Native module compatibility, Gradle cache
availability, release signing/build/copy and device installation remain unverified.
APK installation on the judging device is a human release action (root AGENTS).

## Offline desk-check checklist (spec section 8.4)

Run on the release APK with the backend reachable, using the demo accounts from
REQUIREMENTS DEL-08. Record device/API level, APK version and observed outcomes.
All boxes below are currently unchecked.

- [ ] Open Fixtures, Standings and Club profile online; verify SQLite persistence.
- [ ] Enable airplane mode; reopen those screens and see cached data plus Offline.
- [ ] As Organizer, queue a scoring action; see Pending with its stable action ID.
- [ ] As Manager, queue a roster action; see Pending in the API-17 action format.
- [ ] Force-close and reopen offline; pending work remains with the same IDs.
- [ ] Restore networking; automatic sync or the obvious Sync button sends APP-40.
- [ ] Applied/duplicate actions leave Pending; rejected results show a plain-language
  reason in sync history. Sending the same actions again does not repeat mutations.
- [ ] Expired sessions retain pending work; logout asks before discarding it.
- [ ] Switching users/tenants/servers cannot expose cached data or replay another
  scope's queue.

## Judge-task and accessibility rehearsal (spec section 8.6)

- [ ] A: Login, find standings, then open one match without assistance.
- [ ] B: Store, product/variant, cart, mock checkout, view/download receipt.
- [ ] C: Manager roster action, confirmation, result; repeat offline and sync.
- [ ] Match detail updates live; compensated events remain visible and struck out.
- [ ] Tenant branding, consistent spacing/fonts/buttons and strong score/Buy hierarchy.
- [ ] Body text at least 14 sp, font scaling, contrast at least 4.5:1, targets at
  least 48 dp, icon labels and status text in addition to color.
- [ ] Verify 360x640 dp, rotation, keyboard, scrolling and working back navigation.
- [ ] Every role sees appropriate actions; test ownership and tenant boundaries.
- [ ] Empty, error/retry, loading, success and offline states have helpful messages.
