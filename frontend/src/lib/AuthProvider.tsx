/**
 * FireSight auth context — wraps Supabase Auth for the whole app.
 *
 * Responsibilities:
 * - Hold the current session/user and expose { session, user, loading, signOut, ... }.
 * - Persist sessions via the supabase client's AsyncStorage storage, so the
 *   user stays signed in across app/browser restarts.
 * - Re-render the UI automatically whenever the auth state changes
 *   (sign in, sign out, token refresh, external sign-in like OAuth).
 * - Clear local auth state completely on signOut.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue {
  /** True while the initial session is being restored from storage. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** True once Supabase has confirmed the email address (or confirmation is off). */
  emailConfirmed: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  session: null,
  user: null,
  emailConfirmed: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1. Restore any existing session (from AsyncStorage / localStorage).
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    // 2. Keep the UI in sync with every auth state change from now on
    //    (sign in/out, token refresh, OAuth return, another tab signing out…).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      // A session exists but the underlying identity may still be pending
      // confirmation when email confirmation is enabled.
      emailConfirmed:
        !!session &&
        (session.user.email_confirmed_at != null ||
          session.user.confirmed_at != null),
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
      },
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
