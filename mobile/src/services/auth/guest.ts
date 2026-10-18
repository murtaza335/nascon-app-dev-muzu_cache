import * as Keychain from 'react-native-keychain';

type GuestSession = { guest_token: string; expires_at: string };
const service = (server: string) => `com.nascon.sports.guest.${encodeURIComponent(server)}`;

/** Guest credentials are isolated from member credentials and never persisted outside Keychain. */
export async function guestToken(server: string): Promise<string> {
  const key = service(server);
  const saved = await Keychain.getGenericPassword({ service: key });
  if (saved) {
    try {
      const value = JSON.parse(saved.password) as GuestSession;
      if (value.guest_token && Date.parse(value.expires_at) > Date.now()) return value.guest_token;
    } catch { /* Replace malformed secure data. */ }
  }
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
  let value: GuestSession;
  try {
    const response = await fetch(`${server}/api/v1/guest/session`, { method: 'POST', signal: controller.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) throw new Error('Guest session unavailable');
    value = await response.json() as GuestSession;
  } finally { clearTimeout(timer); }
  if (!value.guest_token || !value.expires_at) throw new Error('Invalid guest session response');
  await Keychain.setGenericPassword('guest', JSON.stringify(value), { service: key });
  return value.guest_token;
}
