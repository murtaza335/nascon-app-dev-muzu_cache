// Public configuration only; never put tokens or DAY1_SALT in EXPO_PUBLIC_*.
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.195.242.35:8080'
).replace(/\/+$/, '');
