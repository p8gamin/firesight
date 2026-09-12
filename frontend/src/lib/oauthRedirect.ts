/**
 * OAuth redirect target for Supabase sign-ins.
 *
 * The URL must be resolvable at RUNTIME (not build time) because the same
 * bundle runs in three places:
 *   - production web: https://firesightweb.vercel.app
 *   - preview/local web: whatever origin `expo start --web` / a Vercel
 *     preview deployment is served from
 *   - native: the app's registered deep-link scheme (app.json `scheme`)
 *
 * `window.location.origin` gives the right answer for every web deployment
 * without ever hard-coding localhost or the production domain.
 */
import { isWeb } from '../design/platform';

/**
 * Expo Router route that consumes the Supabase OAuth response
 * (the `?code=…`/tokens Google's flow lands on).
 */
export const OAUTH_CALLBACK_PATH = '/auth/callback';

/**
 * Where to send the browser after Google authenticates. Must exactly match a
 * URL whitelisted in Supabase Dashboard → Authentication → URL Configuration:
 * add `<your-origin>/auth/callback` (e.g. https://firesightweb.vercel.app/auth/callback)
 * to the Redirect URLs list.
 */
export function getOAuthRedirectUrl(): string {
  if (isWeb && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${OAUTH_CALLBACK_PATH}`;
  }
  // Native: return into the app via its registered scheme. Google OAuth is
  // currently web-only in the UI (see AuthScreen), this is future-proofing.
  return 'wildfiremonitor://auth/callback';
}
