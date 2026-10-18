# Mobile setup and desk-check handoff

See [mobile setup](../mobile/README.md) for real-API setup and native commands.
Current backend: `http://10.195.242.35:8080` (default). Settings and
`EXPO_PUBLIC_API_URL` can override it; restart Metro after build-time changes.

Keychain, SQLite, NetInfo and APP-03 discovery are wired; preview data/controls
are removed. Server mock payments remain mandated by the competition.

## Verification (2026-10-17)

TypeScript, 15 mobile tests, 89 authorization tests and 4 APP-03 service tests, Android prebuild and
single-worker Hermes export pass. Full compose is blocked by the configured
MinIO image pull. Native Gradle compilation exhausted host memory. Native layout,
PDF viewer/save, TalkBack, rotation, system appearance and force-close/reconnect
remain unverified. No judging-device installation performed.

## Required native acceptance

1. Sign in against the backend; open fixtures, standings and match timeline.
2. Check light/dark/device themes at 360x640, enlarged fonts and rotation.
3. Test Account/Settings sign-out. Verify user/tenant/server cache, cart and queue isolation.
4. Cache reads, enable airplane mode, queue score/roster work, force-close/reopen,
   reconnect and inspect each server outcome in Sync status.
5. Place an order, open/download its PDF, verify response-loss retries reuse its
   order ID, and test order fulfillment as a manager.
6. Human release: enable demo seeding as desired, build/install judging APK,
   deliver `mobile/release/app-release.apk` after acceptance.

Android 10/API29+, 48dp tap targets, system scaling and readable errors remain
requirements. Full stack stays blocked until MinIO/worker and cold-start checks pass.
