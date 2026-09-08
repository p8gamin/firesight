/**
 * FireSight backend configuration.
 *
 * The frontend talks ONLY to the FireSight FastAPI backend — never to the
 * upstream data providers it aggregates.
 *
 * Base URL resolution (first match wins):
 *
 * 1. `EXPO_PUBLIC_API_BASE_URL` — inlined by Expo at bundle time. Set this
 *    when testing on a PHYSICAL phone (the phone's own 127.0.0.1 refers to
 *    the phone itself, not your computer), e.g. in `frontend/.env`:
 *      EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000
 *    (replace with your computer's LAN IP — see .env.example).
 * 2. Web → `http://127.0.0.1:8000` (browser on the same computer).
 * 3. Android emulator → `http://10.0.2.2:8000` (Android's alias for the
 *    host machine's loopback interface).
 * 4. iOS simulator → `http://127.0.0.1:8000` (shares the host network).
 */
import { Platform } from 'react-native';
import { isWeb } from '../design/platform';

/**
 * The fire engine aggregates several upstream feeds before responding, so
 * give the request generous room before giving up. Observed live responses
 * take 50-110 s; the timeout must sit above that band.
 */
export const FIRES_TIMEOUT_MS = 150_000;

function platformDefaultBaseUrl(): string {
  if (isWeb) return 'http://127.0.0.1:8000';
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://127.0.0.1:8000';
}

/** Resolved backend origin, without a trailing slash. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const raw =
    typeof fromEnv === 'string' && fromEnv.trim().length > 0
      ? fromEnv.trim()
      : platformDefaultBaseUrl();
  return raw.replace(/\/+$/, '');
}

/** GET …/fires?latitude={latitude}&longitude={longitude} */
export function buildFiresUrl(latitude: number, longitude: number): string {
  return `${getApiBaseUrl()}/fires?latitude=${latitude}&longitude=${longitude}`;
}
