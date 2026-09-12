/**
 * /auth/callback — OAuth return route (Supabase → Google → here).
 *
 * Why this route exists: Supabase redirects the browser back to a URL that
 * must be whitelisted in Supabase → Authentication → URL Configuration, and
 * an Expo SPA has no server route for it — hitting an unknown path is what
 * produced the production 404. This Expo Router screen makes the callback URL
 * a real client-side route, so the redirect lands inside the app instead of
 * on Vercel's 404.
 *
 * With flowType 'pkce' (set in src/lib/supabase.ts), supabase-js detects
 * `?code=…` on the URL the moment this screen's JS boots and exchanges it for
 * a session automatically (it then strips the query params from the address
 * bar). This screen only waits for that to finish, confirms the session was
 * restored, and forwards into the app via Expo Router. No second routing
 * system, no hard-coded domains: the redirect target is derived from
 * `window.location.origin` (see src/lib/oauthRedirect.ts).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../src/lib/supabase';

/** Milliseconds before the callback gives up and offers a manual escape. */
const TIMEOUT_MS = 12_000;

/** Dark styling copied from the app's tokens so this screen reads FireSight. */
const BG = '#0B0E11';
const BORDER = '#232B35';
const TEXT = '#F4F6F8';
const TEXT_MUTED = '#9AA4AE';
const EMBER = '#E8702A';

/** Map a raw Supabase exchange error to short, actionable copy. */
function friendlyCallbackError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('verifier') || m.includes('code verifier'))
    return 'This sign-in link expired or was already used. Please start again from the sign-in page.';
  if (m.includes('invalid') || m.includes('bad_oauth') || m.includes('oauth'))
    return 'Google sign-in failed or was cancelled. Please try again.';
  if (m.includes('redirect'))
    return 'The sign-in redirect URL is not configured in the Supabase dashboard.';
  return raw || 'Sign-in could not be completed. Please try again.';
}

/**
 * True if the session is usable. Tolerates a session object that is briefly
 * missing its access token while the exchange finalizes.
 */
function hasValidSession(session: Session | null): boolean {
  return !!session && (!!session.access_token || !!session.user?.id);
}

/** Read the current URL's query string (browser only). */
function urlSearchParams(): URLSearchParams {
  return typeof window !== 'undefined'
    ? new URLSearchParams(window.location?.search ?? '')
    : new URLSearchParams('');
}

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    // replace(), not push(): the callback URL has query params on it and must
    // not stay in history (back button would land on a dead callback URL).
    router.replace('/map');
  };

  useEffect(() => {
    let cancelled = false;

    // Failure guard: never dead-end on a spinner.
    timerRef.current = setTimeout(() => {
      if (!doneRef.current && !cancelled) {
        setError('Sign-in is taking longer than expected.');
      }
    }, TIMEOUT_MS);

    const run = async () => {
      try {
        // 1. Safety net — the client's auto-detect runs at module init; if it
        //    already exchanged the code, the session is in storage here.
        let session = (await supabase.auth.getSession()).data.session;

        // 2. If the code is still on the URL, exchange it now. The code is
        //    single-use with PKCE, so don't pass it manually — supabase-js
        //    reads it (and the flow's verifier) from the URL/storage itself.
        if (!session) {
          const params = urlSearchParams();
          if (params.get('code') || params.get('error')) {
            const res = await supabase.auth.exchangeCodeForSession('');
            if (res.error) throw res.error;
            session = res.data.session;
          }
        }

        // 3. Implicit-flow fallback: Supabase can also return tokens in the
        //    URL fragment. getSession() detects and consumes those too.
        if (!session && typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          session = (await supabase.auth.getSession()).data.session;
        }

        if (cancelled) return;

        if (hasValidSession(session)) {
          finish();
          return;
        }

        // 4. No session and no error — Supabase confirmed nothing; don't
        //    fake success. (Usually the user cancelled the Google prompt.)
        setError(
          'Sign-in did not complete. If you cancelled the Google prompt, just try again.'
        );
      } catch (e) {
        if (cancelled) return;
        const raw =
          e instanceof Error
            ? e.message
            : typeof e === 'object' && e && 'message' in e
              ? String((e as { message: unknown }).message)
              : 'Sign-in could not be completed.';
        setError(friendlyCallbackError(raw));
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToSignIn = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/signin');
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        {error ? (
          <>
            <Ionicons name="alert-circle" size={40} color={EMBER} />
            <Text style={styles.heading}>Sign-in issue</Text>
            <Text style={styles.body}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={backToSignIn}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Text style={styles.ctaText}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={EMBER} />
            <Text style={styles.heading}>Signing you in…</Text>
            <Text style={styles.body}>
              Restoring your FireSight session — one moment.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#161B22',
    padding: 32,
    alignItems: 'center',
  },
  heading: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    lineHeight: 26,
    color: TEXT,
    marginTop: 12,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 8,
  },
  cta: {
    height: 48,
    alignSelf: 'stretch',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMBER,
    marginTop: 20,
  },
  ctaPressed: { opacity: 0.95, transform: [{ scale: 0.97 }] },
  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: '#ffffff',
  },
});
