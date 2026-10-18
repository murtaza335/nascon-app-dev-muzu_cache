# Sportron Mobile

Android app using authenticated `/api/v1` APIs. Mobile mock datasets, local login,
simulated results and Screen Studio are removed. The competition's server mock
payment gateway remains the only payment provider.

## Run

From `mobile/`: `npm ci`, `npm run prebuild:android`, then `npm start`.
Use the configured Microsoft JDK 17. Keychain, SQLite, NetInfo and the changed PDF
adapter require a fresh native build; Expo Go is unsupported. `npm run android`
builds/installs on a development device. Judging-device installation is human-only.

Start the backend using root Docker instructions. Login > Settings sets its address:
- Default backend (emulator and phone): `http://10.195.242.35:8080`.
- Override with `EXPO_PUBLIC_API_URL` at build time or the address in Settings.
- Saved localhost/emulator defaults migrate on startup; sign in again after switching.
  Custom addresses and pending work scoped to the previous server are retained.
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

## Replacement UI (2026-10-18)

`src/` is the active, self-contained redesign. `src1/` preserves the previous source
unchanged and is excluded by TypeScript. Do not point imports into the archive.
The new light-first mineral/forest theme includes Dark and Device settings.
All 21 core screens and the existing management/order screens use real API data.

After the folder replacement, restart Metro with `npx expo start --clear` if its
watcher still displays the old UI or reports missing modules. The existing approved
native modules are retained; no dependency installation is added by this redesign.
Server settings are preserved on restart; set the laptop LAN address on a phone.

Checks: `npm run typecheck` passes; `npm test` reports 18 passed, 0 failed.
Live backend checkout/roster/realtime/offline acceptance remains pending.

Android Hermes export also passed (885 modules); native captures were rejected as
stale/black while the phone was dozing. Full details: [verification](qa-redesign/VERIFICATION.md).

## Task-oriented UI update
The active redesign opens Home, with direct Fixtures, Standings, Store and Club
navigation. Home exposes authorized scoring/roster tools. Fixtures support search
and date grouping; standings expand statistics within phone width; club, match and
sync screens group content into tabs. Roster/scoring changes guide selection,
details and review. Product and checkout screens keep their main action visible.
Shared component implementations live in actions/display/feedback/forms/layout;
feature-specific components remain inside their feature. The API runtime is retained.
Current checks and native evidence: [verification](qa-redesign/VERIFICATION.md).

Latest second-redesign checks: 20 tests, strict TypeScript and Android Hermes export pass. Pixel native captures cover light/dark, 360x640 with enlarged text and landscape; backend journeys, TalkBack and other-role native workflow acceptance remain pending. Display/theme settings were restored.

## Sportron branding
The display name and Expo slug are Sportron/sportron. Android application ID and
secure/local storage identifiers are retained, preserving the existing workspace.
Light mode combines pale content with dark forest headers and featured panels;
dark mode remains available. Copy is shorter and related headings/content are grouped.
Offline debug build and development-device update succeeded; the launcher label is
Sportron. Current evidence: [Sportron verification](qa-redesign/SPORTRON.md).
