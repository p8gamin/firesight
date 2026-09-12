/**
 * User display helpers — derive profile info from the Supabase auth user.
 *
 * Google sign-ins carry profile data in `user.user_metadata` (populated by
 * Supabase's Google provider). Email/password users have none, so the UI
 * falls back to the bundled default avatar asset. Nothing here calls the
 * network or the database — the metadata already rides on the session.
 */
import { Asset } from 'expo-asset';

/** Bundled default avatar (Metro asset module id — see assets/default-avatar.jpg). */
export const DEFAULT_AVATAR_SOURCE = require('../../assets/default-avatar.jpg') as number;

/**
 * Resolved URI for the bundled default avatar (works on web dev servers and
 * Vercel's static export alike, since expo-asset resolves Metro's output).
 */
export function defaultAvatarUri(): string | undefined {
  try {
    return Asset.fromModule(DEFAULT_AVATAR_SOURCE).uri ?? undefined;
  } catch {
    return undefined;
  }
}

/** Best Google avatar URL from the user's metadata, or null. */
export function googleAvatarUrl(user: {
  user_metadata?: Record<string, unknown> | null;
} | null): string | null {
  const meta = user?.user_metadata;
  if (!meta) return null;
  for (const key of ['avatar_url', 'picture'] as const) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim().startsWith('http')) {
      return value.trim();
    }
  }
  return null;
}
