const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = config => withAndroidManifest(config, mod => {
  const activity = mod.modResults.manifest.application[0].activity.find(item => item.$['android:name'] === '.MainActivity');
  if (!activity) throw new Error('Could not find Android MainActivity for the NaSCon deep-link filter.');
  activity['intent-filter'] = activity['intent-filter'] || [];
  const exists = activity['intent-filter'].some(filter => filter.data?.some(data => data.$?.['android:scheme'] === 'nascon'));
  if (!exists) activity['intent-filter'].push({
    action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
    category: [
      { $: { 'android:name': 'android.intent.category.DEFAULT' } },
      { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
    ],
    data: [{ $: { 'android:scheme': 'nascon' } }],
  });
  return mod;
});
