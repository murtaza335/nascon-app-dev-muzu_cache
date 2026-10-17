# NaSCon Sports Mobile

Android app using authenticated `/api/v1` APIs. Mobile mock datasets, local login,
simulated results and Screen Studio are removed. The competition's server mock
payment gateway remains the only payment provider.

## Run

From `mobile/`: `npm ci`, `npm run prebuild:android`, then `npm start`.
Use the configured Microsoft JDK 17. Keychain, SQLite, NetInfo and the changed PDF
adapter require a fresh native build; Expo Go is unsupported. `npm run android`
builds/installs on a development device. Judging-device installation is human-only.

Start the backend using root Docker instructions. Login > Settings sets its address:
- Emulator: `http://10.0.2.2:8080` (default).
- Phone: `http://<laptop LAN IP>:8080` on the same network.
- USB: `adb reverse tcp:8080 tcp:8080`, then `http://127.0.0.1:8080`.

Use an account provisioned on that backend (competition accounts: root README).
Empty server data produces empty screens, never synthetic fallback records.

## Behavior

Fixtures, standings, clubs/players, sport choices, products and orders come from
the server. APP-03 supplies tenant-scoped discovery. Tokens live in Keychain;
SQLite stores real cached reads, cart and API-17 outbox envelopes under a
server/user/selected-tenant scope. Scoring/roster work persists before APP-40
submission. Reconnection and a 30-second foreground interval retry pending work;
Sync now shows individual outcomes. Checkout preserves its order ID across
ambiguous failures. PDF receipts come from the server.

Account and Settings provide sign-out: token, cart and current account cache are
cleared, with a choice to retain/discard pending work. Other accounts, tenants and
servers cannot read/replay it. Light/dark/device themes use restrained accents.
Unsupported P2 simulations are absent from navigation.

## Checks and structure

`npm run typecheck`; `npm test`; `npx expo export --platform android --max-workers 1 --output-dir dist-api-check`.
Native acceptance: [desk check](../docs/MOBILE.md).

`src/app/AppContext.tsx` owns lifecycle; `services/api` owns transport/models/commands;
`services/auth/session.ts` wraps Keychain; `services/storage/storage.ts` wraps SQLite;
`types/models.ts` defines display models. No runtime dependencies were added.
