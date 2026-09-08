import React from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLOR, FONT } from './constants';

/**
 * The top-left FireSight brand as a shiny pill button (native twin of
 * ShinyBrand.web). The web version gets the animated conic shine via CSS;
 * native approximates the same intent with layered translucency: a deep
 * forest-green gradient base, a subtle orange ring, and a top-lit sheen —
 * logo and wordmark kept inside the pill. Clicking returns to the hero.
 */
export default function ShinyBrand() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.dismissTo('/')}
      accessibilityRole="button"
      accessibilityLabel="FireSight — back to home"
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['#1c1c1c', '#0a0a0a', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pill}
      >
        {/* Top-lit sheen over the tinted base, echoing the web shimmer. */}
        <LinearGradient
          colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.wordmark}>{'FireSight'}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(237,140,73,0.4)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  logo: {
    width: 46,
    height: 24,
  },
  wordmark: {
    fontFamily: FONT.interMedium,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: COLOR.white,
  },
});