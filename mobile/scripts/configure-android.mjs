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
console.log('Configured Android SDK, Microsoft OpenJDK 17, and a 120-second Gradle download timeout.');
