import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LiquidGlassNavItem from './LiquidGlassNavItem';
import ShinyBrand from './ShinyBrand';
import { useAuth } from '../lib/AuthProvider';
import { BP_MD, COLOR, FONT, NAV_ITEMS } from './constants';
import { defaultAvatarUri, googleAvatarUrl } from '../lib/userDisplay';

/**
 * Animated floating nav (native).
 *
 * The web twin (AnimatedNavFramer.web.tsx) runs the framer-motion capsule
 * that collapses to a circle on scroll; native has no window scroll or
 * backdrop-filter, so this renders the same FireSight sections as the
 * existing liquid-glass pills, always expanded and floating at the top
 * center (md+ — on phones the pills are hidden, matching the old NavBar).
 * The FireSight flame + wordmark stays at the top-left on every size, and
 * the white "Sign In/Up" / "Profile" CTA sits at the top-right on md+
 * (mirroring the web twin's ProfileButton). The active pill is tracked the
 * same way NavBar used to.
 */

/**
 * White pill CTA (md+): "Sign In/Up" → /signin when signed out; a
 * "Profile" pill with the same styling once a Supabase session exists.
 * Native has no dropdown (the web twin owns that interaction) — tapping the
 * signed-in pill routes to /settings like the web dropdown's item.
 */
function ProfileButton() {
  const router = useRouter();
  const { session, user } = useAuth();
  // Remembers which Google URL failed so the default avatar takes over.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const avatarUrl = session ? googleAvatarUrl(user) : null;
  // Google users → their Google avatar; email/password users (and any
  // avatar URL that fails to load) → the bundled default avatar.
  const avatarSrc =
    !avatarUrl || failedUrl === avatarUrl ? defaultAvatarUri() : avatarUrl;

  if (session) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile"
        onPress={() => router.push('/settings')}
        style={({ pressed }: any) => [
          styles.signUp,
          pressed ? styles.pressedDim : null,
        ]}
      >
        <Image
          source={{ uri: avatarSrc }}
          style={styles.avatar}
          onError={() => avatarUrl && setFailedUrl(avatarUrl)}
        />
        <Text style={styles.signUpText}>Profile</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign in or sign up"
      onPress={() => router.push('/signin')}
      style={({ pressed }: any) => [
        styles.signUp,
        pressed ? styles.pressedDim : null,
      ]}
    >
      <Ionicons name="arrow-forward" size={16} color={COLOR.gray900} />
      <Text style={styles.signUpText}>Sign In/Up</Text>
    </Pressable>
  );
}

export default function AnimatedNavFramer() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMd = width >= BP_MD;
  const router = useRouter();
  const pathname = usePathname();
  const [activeNav, setActiveNav] = useState<string | null>(NAV_ITEMS[0].label);

  // Only render while the hero route is focused (the hero screen stays
  // mounted in the stack when /map is pushed on top).
  if (pathname !== '/') return null;

  const handleNav = (label: string) => {
    // Every section is a live route. dismissTo pops back to the existing
    // route (the original hero) instead of pushing a fresh copy on top.
    if (label === 'Map') router.dismissTo('/map');
    else if (label === 'Alerts') router.dismissTo('/alerts');
    else if (label === 'Locations') router.dismissTo('/locations');
    else if (label === 'About') router.dismissTo('/about');
    else if (label === 'Home') router.dismissTo('/');
    else setActiveNav(label);
  };

  // Floating row offset (web parity: 24px below the top inset), with equal
  // flex side fills on each side of the centered pills so the top-left brand
  // never collides with them — the layout NavBar used.
  const y = insets.top + 24;

  return (
    <View style={[styles.wrap, { top: y }]}>
      <View style={styles.fullRow}>
        <View style={styles.side}>
          {/* FireSight brand — logo + wordmark inside a shiny pill button
           * (glass pill on native). Clicking returns to the hero. */}
          <ShinyBrand />
        </View>
        {isMd ? (
          <View style={styles.row}>
            {NAV_ITEMS.map((item) => (
              <LiquidGlassNavItem
                key={item.label}
                label={item.label}
                active={activeNav === item.label}
                onPress={() => handleNav(item.label)}
              />
            ))}
          </View>
        ) : null}
        <View style={[styles.side, styles.sideEnd]}>
          {isMd ? <ProfileButton /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
  },
  fullRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideEnd: {
    justifyContent: 'flex-end',
  },
  signUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLOR.white,
  },
  signUpText: {
    fontFamily: FONT.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: COLOR.gray900,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  pressedDim: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
});