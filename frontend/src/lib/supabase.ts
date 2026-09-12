/**
 * FireSight's Supabase client (authentication only for now).
 *
 * Credentials come from Expo public env vars, inlined at bundle time
 * (see .env.example). Only the anon/publishable key belongs here — it is a
 * public browser key, safe to ship, and safe only because Row Level
 * Security protects the data it can reach. The service-role key must NEVER
 * appear in frontend code or env files.
 *
 * Session persistence: supabase-js defaults to localStorage, which does not
 * exist in React Native, so we back it with AsyncStorage. That keeps the
 * user signed in across app restarts on native and across browser restarts
 * on web (AsyncStorage maps to localStorage on web).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_KEY in .env (see .env.example), then restart ' +
      '`expo start` so Expo re-inlines them.'
  );
}

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    // OAuth uses the PKCE flow: the session arrives as a one-time `?code=`
    // that this client exchanges itself on return — no token in the URL
    // (referrer/https upgrade-safe), and no server-side exchange needed.
    flowType: 'pkce',
    // Web has multiple tabs; only one should poll for token refreshes.
    // (Detecting an SSR/document-less environment is enough here.)
    ...(typeof document !== 'undefined' ? {} : { autoRefreshToken: true }),
    persistSession: true,
    // Consume `?code=…`/`#access_token=…` returned to any route (e.g.
    // /auth/callback) at client-init time. Native has no URL to parse.
    detectSessionInUrl: typeof document !== 'undefined',
  },
});

/** Best-effort message for showing the user why auth is unavailable. */
export function supabaseConfigError(): string | null {
  return url && key
    ? null
    : 'Supabase is not configured (missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY).';
}
