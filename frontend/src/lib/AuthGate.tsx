/**
 * Guards for account-dependent screens.
 *
 * The public FireSight experience (hero, map, fire details, about) stays
 * open to everyone. Screens that are inherently personal — saved Locations,
 * personalized Alerts — show a friendly sign-in prompt instead of their
 * content until the user authenticates. No route is hard-blocked; the map
 * is always reachable.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthProvider';
import { COLOR, FONT } from '../design/constants';

/**
 * Wraps account-dependent content. Renders the children only for a
 * signed-in user; otherwise shows a dark sign-in card with a CTA to /signin.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth();
  const router = useRouter();

  // Keep the page height stable (dark background) while the session restores.
  if (loading) {
    return <View style={styles.gateSpacer} />;
  }

  if (session) {
    return <>{children}</>;
  }

  return (
    <View style={styles.gateWrap}>
      <View style={styles.gateCard}>
        <View style={styles.gateIconWrap}>
          <Ionicons name="person-circle-outline" size={44} color={COLOR.accent} />
        </View>
        <Text style={styles.gateHeading}>Sign in to use this</Text>
        <Text style={styles.gateBody}>
          Saved locations and personalized alerts live with your FireSight
          account. The map and live fire data stay open to everyone.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/signin')}
          style={({ pressed }) => [styles.gateCta, pressed && styles.gateCtaPressed]}
        >
          <Text style={styles.gateCtaText}>Sign in / Sign up</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Shared dark gate styling, aligned with the app's design tokens. */
const BG = '#0B0E11';
const SURFACE = '#161B22';
const BORDER = '#232B35';
const TEXT = '#F4F6F8';
const TEXT_MUTED = '#9AA4AE';
const EMBER = '#E8702A';
const EMBER_DIM = '#D2611F';

const styles = StyleSheet.create({
  gateSpacer: {
    flex: 1,
    backgroundColor: BG,
  },
  gateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    padding: 24,
  },
  gateCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 28,
    alignItems: 'center',
  },
  gateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#11151B',
    marginBottom: 16,
  },
  gateHeading: {
    fontFamily: FONT.interMedium,
    fontSize: 20,
    lineHeight: 26,
    color: TEXT,
  },
  gateBody: {
    fontFamily: FONT.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  gateCta: {
    height: 48,
    alignSelf: 'stretch',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMBER,
  },
  gateCtaPressed: {
    backgroundColor: EMBER_DIM,
    opacity: 0.95,
    transform: [{ scale: 0.97 }],
  },
  gateCtaText: {
    fontFamily: FONT.interSemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: COLOR.white,
  },
});
