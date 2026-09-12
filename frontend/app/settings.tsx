import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/lib/AuthProvider';
import { COLOR, FONT } from '../src/design/constants';
import { defaultAvatarUri, googleAvatarUrl } from '../src/lib/userDisplay';

/**
 * /settings — account settings. Reached from the nav's Profile dropdown
 * (web) or the Profile pill (native). Minimal for now: confirms the signed-in
 * account and offers sign-out; more settings will land here later. Styled
 * with the app's dark tokens so it reads as part of FireSight.
 */
export default function SettingsRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, user, signOut } = useAuth();
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const avatarUrl = session ? googleAvatarUrl(user) : null;
  // Same avatar selection as the nav button: Google photo when present and
  // loadable, bundled default otherwise.
  const avatarSrc =
    !avatarUrl || failedUrl === avatarUrl ? defaultAvatarUri() : avatarUrl;

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.dismissTo('/');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={back}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={20} color={COLOR.white} />
      </Pressable>

      <View style={styles.card}>
        {session ? (
          <Image
            source={{ uri: avatarSrc }}
            style={styles.avatar}
            onError={() => avatarUrl && setFailedUrl(avatarUrl)}
          />
        ) : (
          <Ionicons name="settings-outline" size={30} color={COLOR.accent} />
        )}
        <Text style={styles.heading}>Settings</Text>
        <Text style={styles.body}>
          {session
            ? `Signed in as ${user?.email ?? 'FireSight account'}.`
            : 'You are signed out.'}
        </Text>
        {session ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            onPress={() => void signOut()}
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          >
            <Ionicons name="log-out-outline" size={16} color="#0B0E11" />
            <Text style={styles.btnTextDark}>Log Out</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in or sign up"
            onPress={() => router.push('/signin')}
            style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
          >
            <Text style={styles.btnTextLight}>Sign In/Up</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const BG = '#0B0E11';
const SURFACE = '#161B22';
const BORDER = '#232B35';
const TEXT = '#F4F6F8';
const TEXT_MUTED = '#9AA4AE';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    marginTop: '20%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 28,
    alignItems: 'center',
  },
  heading: {
    fontFamily: FONT.interSemiBold,
    fontSize: 24,
    lineHeight: 30,
    color: TEXT,
    marginTop: 14,
  },
  body: {
    fontFamily: FONT.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  btn: {
    height: 48,
    alignSelf: 'stretch',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLOR.white,
  },
  btnTextDark: {
    fontFamily: FONT.interSemiBold,
    fontSize: 15,
    color: '#0B0E11',
  },
  btnTextLight: {
    fontFamily: FONT.interSemiBold,
    fontSize: 15,
    color: '#0B0E11',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 6,
  },
});
