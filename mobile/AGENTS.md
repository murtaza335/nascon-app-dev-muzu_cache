# Repository Guidelines

## Scope and Organization

Work inside `mobile/`; the backend, Docker configuration, shared documentation,
and root tests belong to other team members. This app is part of the existing
root Git repository. Never create a nested `.git` directory here.

The root `App.tsx` re-exports `src/app/App.tsx`. Feature folders reserve screen
and domain responsibilities, while services reserve HTTP, secure authentication
storage, SQLite persistence, realtime, and offline synchronization boundaries.
Feature directories contain production API screens. HTTP, Keychain sessions, SQLite cache/outbox and connectivity are implemented. Shared
components, navigation, hooks, types, and theme each have separate source folders.

Read `SCREEN-PLAN.md` before screen work. Keep feature screens in
`src/features/<feature>/`; keep shared infrastructure in `src/services/`.
The root REQUIREMENTS owns behavior and ARCHITECTURE section 11 owns this layout.
Shared documentation may be updated when required by the root documentation
matrix; coordinate backend code changes with its owner.

## Development Commands

Run all Expo commands from this directory. Add Expo packages and plugins with
`npx expo install <package>` so versions follow the installed SDK. Restore a
locked checkout with `npm ci`. Use `npm run typecheck` for the strict TypeScript
check; use `npm test` for service and navigation tests.

The root dependency policy still applies: install only approved libraries from
ADR-017, and record exact installed versions. Expo installation does not waive
approval for other new runtime dependencies. Native modules require an Android
development/release build; verify their compatibility before relying on them.

Use `npm run prebuild:android` to generate native Android files and configure
local paths. `npm run android:configure` reapplies the Android SDK and Microsoft
OpenJDK 17 paths. `npm run android:device` lists devices, verifies an online
device, and forwards port 8081. `npm run android` builds and launches on a device;
`npm start` starts Metro alone. After failed builds, use `npm run android:stop`
before retrying. Do not substitute another JDK for the configured Microsoft 17.

## Configuration and Delivery

Generated native directories are ignored; preserve reproducible local changes
in the setup script or Expo configuration. The public backend URL lives in
`src/config/env.ts` and reads `EXPO_PUBLIC_API_URL`. Use port 8080 from the
competition contract, with the backend laptop's LAN IP for a phone. Keep tokens
and the server signing salt out of public environment variables. The eventual
Android submission belongs at `release/app-release.apk`; the mobile ignore file
explicitly permits this required artifact.
