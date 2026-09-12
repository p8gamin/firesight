import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Entrance from './Entrance';
import { BG_IMAGE_1, COLOR, FONT } from './constants';
import { isWeb } from './platform';
import { supabase } from '../lib/supabase';
import { getOAuthRedirectUrl } from '../lib/oauthRedirect';
import { useAuth } from '../lib/AuthProvider';

/**
 * FireSight sign in / sign up screen (route: /signin).
 *
 * Real Supabase Auth: email + password sign up / sign in with loading,
 * validation and error states, correct email-confirmation handling, Google
 * OAuth on web, and a signed-in state (sign out) when a session exists.
 *
 * Adapted from the provided split-panel login page (image left, form right)
 * and restyled into the FireSight language instead of the generic blue
 * template: dark image panel with the hero photography, and a dark form
 * panel on the app's own surfaces (near-black, hairline borders, one ember
 * accent) so both halves read as one continuous FireSight screen.
 * Inter throughout. The two
 * modes (Sign in / Sign up) live in one screen and swap via the link under
 * the heading — same intent as the original /signup navigation, without a
 * second route.
 *
 * Details that make it feel right (Emil design-eng):
 * - Every pressable scales to 0.97 on press.
 * - Focus rings flip the border to the ember accent.
 * - The password eye is a real labeled toggle, not decoration.
 * - The form staggers in (heading → fields → actions) instead of popping
 *   at once.
 * - md+ gets the split layout; phones get a compact dark header over the
 *   same form so nothing important is lost on small screens.
 *
 * The root is sized in EXPLICIT pixels (like HeroScreen) rather than flex:
 * on web the hero keeps its `fs-hero-scroll` document class while this
 * screen is pushed on top of it, which makes #root height:auto — a flex:1
 * chain inside that would collapse to zero height and push the form off
 * screen.
 */

type Mode = 'signin' | 'signup';

interface AuthFormProps {
  mode: Mode;
  onToggleMode: () => void;
  onBack: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Map raw Supabase auth errors to short, human, actionable copy. */
function friendlyAuthError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (m.includes('email not confirmed'))
    return 'Please confirm your email first — check your inbox for the confirmation link.';
  if (m.includes('already registered') || m.includes('already exists'))
    return 'An account with this email already exists — try signing in instead.';
  if (m.includes('rate limit')) return 'Too many attempts — wait a minute and try again.';
  if (m.includes('password')) return raw; // e.g. password-policy violations
  if (m.includes('failed to fetch') || m.includes('network request failed'))
    return 'Network error — check your connection and try again.';
  return raw || 'Something went wrong. Please try again.';
}

export default function AuthScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isMd = width >= 768;

  const [mode, setMode] = useState<Mode>('signin');
  const toggleMode = () => setMode((m) => (m === 'signin' ? 'signup' : 'signin'));

  const back = () => {
    // The screen is always pushed over the hero; go back or fall to root.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const formProps: AuthFormProps = { mode, onToggleMode: toggleMode, onBack: back };

  return (
    <View style={[styles.root, { width, height }]}>
      {isMd ? (
        <AuthSplitLayout {...formProps} />
      ) : (
        <AuthStackLayout {...formProps} />
      )}
    </View>
  );
}

/** The form column, shared by both layouts (identical behavior). */
function AuthForm({ mode, onToggleMode, onBack }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { session, signOut } = useAuth();

  const heading = mode === 'signin' ? 'Welcome Back' : 'Create Account';
  const submitLabel = mode === 'signin' ? 'Sign In' : 'Sign Up';

  const resetMessages = () => {
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async () => {
    if (busy) return;
    resetMessages();

    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password.length === 0) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: mail,
          password,
        });
        if (err) throw err;
        if (data.session) {
          // Email confirmation is disabled on the project — signed in straight
          // away, so go straight to the app.
          router.replace('/map');
        } else {
          // Email confirmation is enabled — the session arrives only after the
          // user clicks the link. Make that explicit instead of dead-ending.
          setNotice(
            `Account created! Check ${mail} for a confirmation link, then sign in.`
          );
          setPassword('');
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: mail,
          password,
        });
        if (err) throw err;
        router.replace('/map');
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const startGoogle = async () => {
    if (busy) return;
    resetMessages();
    if (!isWeb) {
      // Expo Go has no saved Google OAuth client — native needs a production
      // build with the platform client IDs. Be honest, don't fake success.
      setNotice(
        'Google sign-in is available on the web app for now. Native support is coming with the next production build.'
      );
      return;
    }
    setBusy(true);
    try {
      // Return to /auth/callback, where supabase-js detects the PKCE `code`,
      // exchanges it for a session and the callback screen routes onward.
      // Derived from the current origin — works on Vercel production, Vercel
      // preview URLs and local `expo start --web` without hard-coding hosts.
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getOAuthRedirectUrl() },
      });
      if (err) setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  // Already signed in — a signed-in state instead of the form.
  if (session) {
    return (
      <View style={styles.formWrap}>
        <View style={styles.formInner}>
          <Entrance kind="reveal" style={styles.headingWrap}>
            <Text style={styles.heading}>You're signed in</Text>
            <Text style={styles.subheading} numberOfLines={1}>
              {session.user.email ?? 'FireSight account'}
            </Text>
          </Entrance>
          <Entrance kind="fade" delay={60}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/map')}
              style={styles.submitBtn}
            >
              <Text style={styles.submitText}>Continue to FireSight</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleSignOut}
              disabled={busy}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryText}>
                {busy ? 'Signing out…' : 'Sign out'}
              </Text>
            </Pressable>
          </Entrance>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.formWrap}>
      <View style={styles.formInner}>
        {/* Back button — mirrors the reference page's top-left circle. */}
        <Entrance kind="fade" style={styles.backWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={20} color={TEXT_MUTED} />
          </Pressable>
        </Entrance>

        <Entrance kind="reveal" style={styles.headingWrap}>
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.subheading}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.link} onPress={onToggleMode} suppressHighlighting>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </Text>
          </Text>
        </Entrance>

        <Entrance kind="fade" delay={60} style={styles.fieldsWrap}>
          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <View
            style={[
              styles.fieldShell,
              emailFocused ? styles.fieldShellFocus : styles.fieldShellIdle,
            ]}
          >
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email Address"
              placeholderTextColor={TEXT_FAINT}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              style={styles.input}
            />
          </View>

          {/* Password */}
          <Text style={[styles.label, styles.labelGap]}>Password</Text>
          <View
            style={[
              styles.fieldShell,
              passwordFocused ? styles.fieldShellFocus : styles.fieldShellIdle,
            ]}
          >
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={TEXT_FAINT}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              onPress={() => setShowPassword((v) => !v)}
              style={({ pressed }) => [styles.eyeBtn, pressed && styles.pressed]}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={TEXT_MUTED}
              />
            </Pressable>
          </View>

          {/* Remember me (sign in only, as in the reference) */}
          {mode === 'signin' ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              onPress={() => setRememberMe((v) => !v)}
              style={styles.rememberRow}
              hitSlop={6}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                {rememberMe ? (
                  <Ionicons name="checkmark" size={13} color={COLOR.white} />
                ) : null}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </Pressable>
          ) : null}
        </Entrance>

        {error ? (
          <Entrance key="err" kind="fade" delay={40}>
            <View style={styles.noticeBoxErr}>
              <Ionicons name="alert-circle" size={16} color="#F87171" />
              <Text style={styles.noticeTextErr}>{error}</Text>
            </View>
          </Entrance>
        ) : null}
        {notice ? (
          <Entrance key="note" kind="fade" delay={40}>
            <View style={styles.noticeBoxOk}>
              <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
              <Text style={styles.noticeTextOk}>{notice}</Text>
            </View>
          </Entrance>
        ) : null}

        <Entrance kind="fade" delay={100} style={styles.submitWrap}>
          {/* Submit */}
          <Pressable
            accessibilityRole="button"
            onPress={handleSubmit}
            disabled={busy}
            style={({ pressed }) => [
              styles.submitBtn,
              (pressed || busy) && styles.submitPressed,
            ]}
          >
            <Text style={styles.submitText}>
              {busy
                ? mode === 'signin'
                  ? 'Signing In…'
                  : 'Creating Account…'
                : submitLabel}
            </Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social */}
          <View style={styles.socialRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              onPress={startGoogle}
              disabled={busy}
              style={({ pressed }) => [styles.socialBtn, pressed && styles.pressed]}
            >
              <GoogleIcon />
              <Text style={styles.socialText}>Google</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with GitHub (coming soon)"
              onPress={() => {
                resetMessages();
                setNotice(
                  'GitHub sign-in is coming soon — Google is available today.'
                );
              }}
              style={({ pressed }) => [styles.socialBtn, pressed && styles.pressed]}
            >
              <GitHubIcon />
              <Text style={styles.socialText}>GitHub</Text>
            </Pressable>
          </View>
        </Entrance>
      </View>
    </View>
  );
}

/** md+ : split layout — image panel left, form panel right. */
function AuthSplitLayout(props: AuthFormProps) {
  return (
    <View style={styles.splitRoot}>
      <View style={styles.imagePanel}>
        <Image
          source={{ uri: BG_IMAGE_1 }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(11,14,17,0.55)', 'rgba(11,14,17,0.1)', 'rgba(11,14,17,0.45)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.imagePanelTop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={props.onBack}
            style={({ pressed }) => [
              styles.backBtn,
              styles.backBtnOnDark,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={COLOR.white} />
          </Pressable>
        </View>
        <View style={styles.imagePanelCopy} pointerEvents="none">
          <Text style={styles.imagePanelWordmark}>{'See Fire.'}</Text>
          <Text style={styles.imagePanelTagline}>{'Before it Spreads'}</Text>
        </View>
        <View style={styles.imagePanelFooter} pointerEvents="none">
          <Text style={styles.imagePanelFooterText}>
            {'Live satellite data. Real-time wildfire intelligence.'}
          </Text>
        </View>
      </View>
      <View style={styles.formPanel}>
        {/* Barely-there vertical gradient — the "dark, layered, calm" depth
         * the rest of the app uses, so the form side never reads as flat. */}
        <LinearGradient colors={[BG, BG_ELEVATED]} style={StyleSheet.absoluteFill} />
        <View style={styles.formPanelInner}>
          <AuthForm {...props} />
        </View>
      </View>
    </View>
  );
}

/** < md : single column — compact dark header over the same form. */
function AuthStackLayout(props: AuthFormProps) {
  return (
    <ScrollView
      style={styles.stackRoot}
      contentContainerStyle={styles.stackContent}
      alwaysBounceVertical={false}
    >
      <View style={styles.stackHero}>
        <Image
          source={{ uri: BG_IMAGE_1 }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(11,14,17,0.55)', 'rgba(11,14,17,0.85)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.stackHeroTop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={props.onBack}
            style={({ pressed }) => [
              styles.backBtn,
              styles.backBtnOnDark,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={COLOR.white} />
          </Pressable>
        </View>
      </View>
      <View style={styles.stackForm}>
        <AuthForm {...props} />
      </View>
    </ScrollView>
  );
}

/**
 * Dark-theme palette for the form panel — mirrors src/theme (the FireSight
 * tokens) so the sign-in screen reads as part of the app: near-black
 * surfaces, hairline borders, muted text, one ember accent for the primary
 * action.
 */
const BG = '#0B0E11';
const BG_ELEVATED = '#11151B';
const SURFACE = '#161B22';
const SURFACE_HOVER = '#1C232C';
const BORDER = '#232B35';
const EMBER = '#E8702A';
const EMBER_DIM = '#D2611F';
const TEXT = '#F4F6F8';
const TEXT_MUTED = '#9AA4AE';
const TEXT_FAINT = '#5E6872';

const styles = StyleSheet.create({
  root: {
    backgroundColor: BG,
    overflow: 'hidden',
  },

  /* ---- Split layout (md+) ---- */
  splitRoot: { flex: 1, flexDirection: 'row', backgroundColor: BG },
  imagePanel: { flex: 1, backgroundColor: '#0B0E11' },
  formPanel: { flex: 1, backgroundColor: BG },
  formPanelInner: { flex: 1 },

  /* ---- Stack layout (< md) ---- */
  stackRoot: { flex: 1, backgroundColor: BG },
  stackContent: { flexGrow: 1 },
  stackHero: { height: 190, backgroundColor: '#0B0E11' },
  stackForm: { flex: 1, backgroundColor: BG },

  /* ---- Image panel content ---- */
  imagePanelTop: { position: 'absolute', top: 24, left: 24 },
  stackHeroTop: { position: 'absolute', top: 24, left: 24 },
  imagePanelCopy: { position: 'absolute', left: 32, right: 32, bottom: 96 },
  imagePanelWordmark: {
    fontFamily: FONT.interMedium,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.2,
    color: COLOR.white,
  },
  imagePanelTagline: {
    fontFamily: FONT.interRegular,
    fontSize: 15,
    lineHeight: 22,
    color: COLOR.white80,
    marginTop: 6,
  },
  imagePanelFooter: { position: 'absolute', left: 32, right: 32, bottom: 28 },
  imagePanelFooterText: {
    fontFamily: FONT.interRegular,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.3,
    color: COLOR.white60,
  },

  /* ---- Form column ---- */
  formWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  formInner: { width: '100%', maxWidth: 420, paddingHorizontal: 32, paddingVertical: 40 },
  backWrap: { alignSelf: 'flex-start', marginBottom: 28 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backBtnOnDark: { backgroundColor: 'rgba(0,0,0,0.3)' },
  headingWrap: { marginBottom: 28 },
  heading: {
    fontFamily: FONT.interMedium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: TEXT,
  },
  subheading: {
    fontFamily: FONT.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
    marginTop: 8,
  },
  link: { color: EMBER, fontFamily: FONT.interMedium },
  fieldsWrap: { marginBottom: 24 },
  label: {
    fontFamily: FONT.interMedium,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MUTED,
    marginBottom: 8,
  },
  labelGap: { marginTop: 16 },
  fieldShell: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
  },
  fieldShellIdle: { borderColor: BORDER },
  fieldShellFocus: {
    borderColor: EMBER,
    borderWidth: 1.5,
    backgroundColor: SURFACE_HOVER,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    color: TEXT,
    paddingVertical: 0,
  },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
  },
  checkboxOn: { backgroundColor: EMBER, borderColor: EMBER },
  rememberText: {
    fontFamily: FONT.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_MUTED,
    marginLeft: 8,
  },
  submitWrap: { marginTop: 4 },
  // The primary action carries the ember accent — the same CTA color the
  // map's "View Wildfire" button uses, so the app speaks one voice.
  submitBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMBER,
  },
  submitPressed: {
    opacity: 0.95,
    backgroundColor: EMBER_DIM,
    transform: [{ scale: 0.97 }],
  },
  submitText: {
    fontFamily: FONT.interSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: COLOR.white,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: BORDER },
  dividerText: {
    fontFamily: FONT.interRegular,
    fontSize: 12,
    color: TEXT_FAINT,
    marginHorizontal: 12,
  },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SURFACE,
  },
  socialText: {
    fontFamily: FONT.interMedium,
    fontSize: 13,
    color: TEXT,
  },
  noticeBoxErr: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor: 'rgba(248,113,113,0.35)',
  },
  noticeBoxOk: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderColor: 'rgba(74,222,128,0.3)',
  },
  noticeTextErr: {
    flex: 1,
    fontFamily: FONT.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: '#FCA5A5',
  },
  noticeTextOk: {
    flex: 1,
    fontFamily: FONT.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: '#86EFAC',
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryText: {
    fontFamily: FONT.interMedium,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_MUTED,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});

/* ---------- Brand icons (inline SVG paths from the reference page) ---------- */

/** Google "G" — the four-color mark from the reference implementation. */
function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

/** GitHub octocat mark. */
function GitHubIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#FFFFFF"
        d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
      />
    </Svg>
  );
}
