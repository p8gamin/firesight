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
    // Web has multiple tabs; only one should poll for token refreshes.
    // (Detecting an SSR/document-less environment is enough here.)
    ...(typeof document !== 'undefined' ? {} : { autoRefreshToken: true }),
    persistSession: true,
    detectSessionInUrl: typeof document !== 'undefined',
  },
});

/** Best-effort message for showing the user why auth is unavailable. */
export function supabaseConfigError(): string | null {
  return url && key
    ? null
    : 'Supabase is not configured (missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY).';
}
