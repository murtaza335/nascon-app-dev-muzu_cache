> **Superseded where conflicting (2026-10-17).** This starter guide predates the NaSCon '26 Part I spec. The canonical sources are [`REQUIREMENTS.md`](../REQUIREMENTS.md), [`ARCHITECTURE.md`](../ARCHITECTURE.md), [`ADR.md`](../ADR.md) and [`AGENTS.md`](../AGENTS.md). Key overrides: API port **8080** (not 3000); error body `{"error":{"code","message","details":{}}}`; mobile storage is SQLite + Keystore (not AsyncStorage). See `docs/CHANGELOG.md`.

# Mobile (React Native, Android, physical phone)

## 1. Create the app on the day

From the **repo root**:

```bash
rm mobile/.gitkeep
npx @react-native-community/cli@latest init <AppName> --directory mobile --skip-git-init
```

> **CRITICAL: do not initialize a git repository inside `mobile/`.** The React Native code must be tracked by the root repository to be graded. A nested `.git` turns `mobile/` into an untracked or gitlink entry and the grader sees nothing.

Verify:

```bash
find . -name .git -not -path './.git' -prune     # must print nothing
git status                                        # must list files under mobile/
```

If a nested `.git` appeared anyway: `rm -rf mobile/.git`, then `git rm --cached mobile` if it was added as a gitlink, then `git add mobile`.

Commit the lockfile (`mobile/package-lock.json` or `yarn.lock`) and `mobile/android/gradle/wrapper/gradle-wrapper.jar`. Then:

```bash
cd mobile && npx react-native doctor
```

## 2. Warm the Gradle cache at home (before the event)

The campus allowlist covers pypi.org, registry.npmjs.org, pub.dev and repo.maven.apache.org only. **dl.google.com (Android Gradle Plugin, AndroidX) and plugins.gradle.org may be blocked**, so the first Gradle build must happen at home.

```bash
cd /tmp && npx @react-native-community/cli@latest init WarmUp --skip-git-init
cd WarmUp
npm i @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs \
      react-native-screens react-native-safe-area-context react-native-gesture-handler \
      @react-native-async-storage/async-storage axios
cd android
./gradlew assembleDebug
./gradlew assembleDebug --offline     # must succeed: proves the cache is complete
ls ~/.gradle/wrapper/dists            # must exist
```

Use the **same React Native version** on the day as for the warm-up (pin it: `--version <x.y.z>`), or the Gradle/AGP versions will differ and the cache will miss. Also keep the npm cache (`~/.npm`) warm; registry.npmjs.org is allowed, but it is slow on a shared network.

## 3. Phone setup

1. Settings, About phone: tap Build number 7 times; Developer options: enable **USB debugging**.
2. Plug in with a data cable and set the USB mode to File Transfer.
3. `adb devices` must show `<serial>  device`.
   - `unauthorized`: accept the RSA prompt on the phone (revoke authorisations and replug if it does not appear).
   - `no permissions`: add a udev rule (`SUBSYSTEM=="usb", ATTR{idVendor}=="<vendor>", MODE="0666", GROUP="plugdev"` in `/etc/udev/rules.d/51-android.rules`), then `sudo udevadm control --reload-rules` and replug.

## 4. Reaching the backend

**Backend on the same laptop as the phone (recommended):**

```bash
adb reverse tcp:3000 tcp:3000    # API
adb reverse tcp:8081 tcp:8081    # Metro
```

Base URL: `http://localhost:3000`. Re-run `adb reverse` after every replug.

**Backend on a different laptop:** use that laptop's IP on the shared hotspot (`hostname -I` there), e.g. `http://192.168.43.17:3000`. Check from the phone's browser that `http://<ip>:3000/health` loads before debugging the app.

Keep **one** base-URL constant, e.g. `mobile/src/config.js`:

```js
export const API_BASE_URL = 'http://localhost:3000';
```

## 5. Cleartext HTTP

Debug builds allow `http://`. Release builds block it: add `android:usesCleartextTraffic="true"` to `<application>` in `android/app/src/main/AndroidManifest.xml` if you ship a release APK that talks to a plain-HTTP backend.

## 6. Error handling

The backend always returns `{ error_code, message, details? }`. The API client should parse it once and throw a typed error; the UI shows `message` and can switch on `error_code`:

```js
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.code = data?.error_code || 'NETWORK_ERROR';
    err.details = data?.details || [];
    err.status = res.status;
    throw err;
  }
  return data;
}
```

Show `details[].issue` next to the matching form field for `VALIDATION_ERROR`.

## 7. Appium (optional)

```bash
npm i -g appium@2
appium driver install uiautomator2
appium                                  # terminal 1, listens on :4723
cd mobile/android && ./gradlew assembleDebug
APP_PATH=mobile/android/app/build/outputs/apk/debug/app-debug.apk \
  .venv/bin/pytest tests/e2e-mobile     # from the repo root; skipped if Appium is not running
```

## 8. RAM

- Use the **physical phone, never the emulator** (an emulator costs 2-4 GB).
- In `~/.gradle/gradle.properties`: `org.gradle.jvmargs=-Xmx2g` (and optionally `org.gradle.workers.max=2`).
- **Unset or lower `_JAVA_OPTIONS`** (`unset _JAVA_OPTIONS`): `-Xmx6G` applies to every JVM, including the Gradle daemon and Kotlin compiler, and overrides `org.gradle.jvmargs`.
- Raise inotify watches if Metro reports `ENOSPC`: `echo fs.inotify.max_user_watches=524288 | sudo tee /etc/sysctl.d/99-inotify.conf && sudo sysctl --system`.
