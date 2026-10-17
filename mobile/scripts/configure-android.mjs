import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const mobileRoot = fileURLToPath(new URL('../', import.meta.url));
const androidRoot = path.join(mobileRoot, 'android');
const sdk = 'C:/Users/dell/AppData/Local/Android/Sdk';
const jdk = 'C:/Program Files/Microsoft/jdk-17.0.20.101-hotspot';

if (!existsSync(androidRoot)) {
  throw new Error('Generate Android first: npm run prebuild:android');
}
for (const directory of [sdk, jdk]) {
  if (!existsSync(directory)) throw new Error(`Required directory missing: ${directory}`);
}

function setProperty(filename, key, value) {
  const target = path.join(androidRoot, filename);
  const original = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const property = new RegExp(`^\\s*${escaped}\\s*[=:]`);
  const lines = original.split(/\r?\n/).filter((line) => !property.test(line));
  writeFileSync(target, `${lines.join('\n').trimEnd()}\n${key}=${value}\n`);
}

setProperty('local.properties', 'sdk.dir', sdk);
setProperty('gradle.properties', 'org.gradle.java.home', jdk);
setProperty('gradle/wrapper/gradle-wrapper.properties', 'networkTimeout', '120000');
// Consumer libraries reuse the app's AGP instead of fetching obsolete standalone
// build plugins. Spotless is used only inside the screens library's own repo.
const buildFile = path.join(androidRoot, 'build.gradle');
const marker = '// NaSCon Android consumer compatibility';
let gradle = readFileSync(buildFile, 'utf8');
const compatibility = `${marker}
subprojects { library ->
  library.buildscript.repositories {
    google()
    mavenCentral()
  }
  library.buildscript.configurations.configureEach {
    exclude group: 'com.diffplug.spotless'
    resolutionStrategy.force 'com.android.tools.build:gradle:8.11.0'
  }
  library.plugins.withId('com.android.library') {
    if (library.name == 'react-native-sqlite-storage') {
      library.android.namespace = 'org.pgsqlite'
    }
  }
}
`;
gradle = gradle.includes(marker)
  ? gradle.replace(/\/\/ NaSCon Android consumer compatibility[\s\S]*?\n}\n/, compatibility)
  : `${gradle}\n${compatibility}`;
writeFileSync(buildFile, gradle);
console.log('Configured Android SDK, Microsoft OpenJDK 17, and a 120-second Gradle download timeout.');
