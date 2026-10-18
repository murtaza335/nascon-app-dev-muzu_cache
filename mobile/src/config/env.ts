// Public configuration only. Settings can override the backend default.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.195.242.35:8080').replace(/\/+$/, '');

// Upgrade old development defaults without replacing explicitly configured servers.
export function restoreServerUrl(savedUrl: string): string {
  const url = savedUrl.replace(/\/+$/, '');
  return ['http://10.0.2.2:8080', 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://172.15.59.213:8080'].includes(url)
    ? API_BASE_URL : savedUrl;
}
