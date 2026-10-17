// ADR-017: the API is plain http:// on the LAN / emulator host, so release builds must allow cleartext traffic.
const { withAndroidManifest } = require('@expo/config-plugins');
module.exports = config => withAndroidManifest(config, mod => {
  mod.modResults.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
  return mod;
});
