# NaSCon Sports Mobile

Expo + React Native + strict TypeScript starter. This folder belongs to the existing
root Git repository; do not initialize a nested repository. Only a placeholder
screen is implemented.

The documentation review and next screen inventory are in
[`SCREEN-PLAN.md`](SCREEN-PLAN.md). The existing feature/service layout is retained;
screen design and functional implementation are the next phase. Canonical
structure: [`ARCHITECTURE.md` section 11](../ARCHITECTURE.md#11-client-architecture-mobile-adr-017).

Locked scaffold versions: Expo **54.0.37**, React Native **0.81.5**, React
**19.1.0**, TypeScript **5.9.3**. Navigation, SQLite, Keychain and NetInfo are
planned dependencies, not installed capabilities. Use the ADR-017 choices and
root dependency approval policy when adding them.

SDK 54 was selected explicitly to reuse this Windows machine's existing
Gradle 8.14.3 / JDK 17 setup. The wrapper has been verified offline with Microsoft
JDK 17; a full APK build is still unverified. The competition does not mandate an Expo version.
Changing SDK versions requires regenerating Android with
`npx expo prebuild --clean --platform android --no-install`, followed by
`node scripts/configure-android.mjs`. Ordinary development does not require
repeating a clean prebuild.

## Structure

```text
App.tsx                  entry re-export
src/app/                 app root and future providers
src/navigation/          future role-aware navigation
src/features/
  auth/ home/            login and role-aware home
  fixtures/ matches/     fixtures, live score, timeline, pinned products
  standings/ clubs/      league tables and club profiles
  store/                 catalogue, cart, checkout, receipts
  roster/ scoring/       manager and organizer actions
  sync/ settings/        queue status and backend configuration
src/components/          shared UI
src/theme/               shared colors, spacing, typography
src/hooks/ src/types/    shared hooks and types
src/config/              public environment configuration
src/services/
  api/                   HTTP transport and error mapping
  auth/                  future Keystore/Keychain token storage
  storage/               future SQLite cache and migrations
  sync/                  future persistent queue and conflict handling
  realtime/              future live subscriptions
assets/                  images and fonts
scripts/                 Windows Android configuration and USB setup
release/                 final app-release.apk delivery location
```

Empty folders are tracked with `.gitkeep`. They reserve responsibility boundaries;
they do not implement the requirements yet. Navigation, SQLite, secure storage,
and sync dependencies can be added under ADR-017 when implementing those features.

## Windows commands

Always run these from `C:/Users/dell/nascon-app-dev-muzu_cache/mobile`.
Use `npx expo install <package>` for Expo/React Native dependencies and plugins.
For an existing checkout with a lockfile, `npm ci` restores the pinned dependencies.
Do not use plain `npm install` to add Expo packages.

```powershell
# Generate Android and apply local paths; repeat after regenerating native files.
npm run prebuild:android

# Verify the phone and forward Metro's USB port.
npm run android:device

# Build/install a debug app on the selected device and start Metro.
npm run android

# Start only Metro.
npm start

# Static check.
npm run typecheck

# After a failed build, stop existing Gradle daemons before retrying.
npm run android:stop
```

`npm run android:configure` reapplies these exact values:

```properties
# android/local.properties
sdk.dir=C:/Users/dell/AppData/Local/Android/Sdk
# android/gradle.properties
org.gradle.java.home=C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot
```

Native folders are generated locally and ignored by Git. The tracked configuration
script restores machine-specific settings after prebuild. No global Java or SDK
settings are modified. If multiple devices are connected, use
`npm run android:device -- -Serial YOUR_DEVICE_ID`.

The configuration script also sets `networkTimeout=120000` in
`android/gradle/wrapper/gradle-wrapper.properties` to allow slower Gradle downloads.
If Metro uses port 8082 because 8081 is occupied, use
`npm run android:device -- -Port 8082` and
`npx expo run:android --device --port 8082`.

These native setup paths are specific to the current Windows machine. A new
checkout on another machine must adapt them; this is not a verified portable
Android build workflow yet.

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to your backend
teammate's LAN address on port **8080**. Restart Metro after changing it. The
default `10.0.2.2` is for an Android emulator. If the backend runs on this Windows
machine, `adb reverse tcp:8080 tcp:8080` also permits `http://localhost:8080` over
USB. Metro forwarding on 8081 does not forward the backend.

## Later implementation

Follow specification sections 8.2-8.6 for screens and judging, section 5.14 for
offline queue contracts, and NFR-4/NFR-5 for persistence and secure token storage.
Use the actual backend contract; the root repo's generic port-3000 examples are
starter documentation. The public API URL is build configuration, not secret
storage. Never put tokens or `DAY1_SALT` in an Expo public environment variable.

`EXPO_PUBLIC_API_URL` currently supplies only the startup default. The in-app
server address control required by MOB-01/MOB-10 is still to be implemented.
Use `/api/v1` contracts from REQUIREMENTS section 8.2 and parse errors as
`{error:{code,message,details:{}}}`; validation fields are in `details.fields`.

The required final artifact is `release/app-release.apk` (Android 10/API 29 or
newer). This scaffold includes no APK and makes no claim of offline functionality.
This path is explicitly unignored so a later APK can be committed. Release signing
and APK generation remain separate delivery steps.

Scaffold template: [Expo create-expo-app documentation](https://docs.expo.dev/more/create-expo/).
