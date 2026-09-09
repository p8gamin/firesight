/**
 * FireSight backend configuration.
 *
 * The frontend talks ONLY to the FireSight FastAPI backend — never to the
 * upstream data providers it aggregates.
 *
 * Base URL resolution (first match wins):
 *
 * 1. `EXPO_PUBLIC_API_BASE_URL` — inlined by Expo at bundle time. Point it at
 *    your LOCAL FastAPI server during development, e.g. in `frontend/.env`
 *    (see `.env.example`):
 *      EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
 *    When testing on a PHYSICAL phone, the phone's own 127.0.0.1 refers to the
 *    phone itself, not your computer — use your computer's LAN IP instead:
 *      EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000
 *    (Android emulator: http://10.0.2.2:8000 — the host machine's loopback.)
 * 2. Unset → the deployed production backend on Render:
 *      https://firesight-backend-2rm4.onrender.com
 */

/**
 * The fire engine aggregates several upstream feeds before responding, so
 * give the request generous room before giving up. Warm responses take
 * 50-110 s; the deployed Render backend additionally cold-starts, and the
 * first request after that has been observed to take up to ~240 s. The
 * timeout must sit above both bands.
 */
export const FIRES_TIMEOUT_MS = 300_000;

/** Deployed production backend (Render) — the default when no override is set. */
const PRODUCTION_API_BASE_URL = 'https://firesight-backend-2rm4.onrender.com';

/** Resolved backend origin, without a trailing slash. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const raw =
    typeof fromEnv === 'string' && fromEnv.trim().length > 0
      ? fromEnv.trim()
      : PRODUCTION_API_BASE_URL;
  return raw.replace(/\/+$/, '');
}

/** GET …/fires?latitude={latitude}&longitude={longitude} */
export function buildFiresUrl(latitude: number, longitude: number): string {
  return `${getApiBaseUrl()}/fires?latitude=${latitude}&longitude=${longitude}`;
}
