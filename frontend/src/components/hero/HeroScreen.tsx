import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroBackground } from './HeroBackground';
import { useAppState } from '../AppStateContext';
import { palette, radius, typography } from '../../theme';

function useReveal(delay: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1] });
  return { opacity: v, transform: [{ translateY }, { scale }] };
}

export function HeroScreen() {
  const insets = useSafeAreaInsets();
  const { enter } = useAppState();
  const { width } = useWindowDimensions();

  const exiting = useRef(new Animated.Value(0)).current;
  const [leaving, setLeaving] = useState(false);

  const line1 = useReveal(150);
  const line2 = useReveal(280);
  const desc = useReveal(430);
  const cta = useReveal(600);
  const foot = useReveal(720);

  const isSmall = width < 360;

  function handleStart() {
    if (leaving) return;
    setLeaving(true);
    Animated.timing(exiting, {
      toValue: 1,
      duration: 480,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) enter();
    });
  }

  const exitScale = exiting.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const exitOpacity = exiting.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { opacity: exitOpacity, transform: [{ scale: exitScale }] },
      ]}
    >
      <HeroBackground />

      <Animated.View style={[styles.topbar, { paddingTop: insets.top + 12 }, line1]}>
        <View style={styles.brand}>
          <View style={styles.mark}>
            <Ionicons name="flame" size={15} color="#fff" />
          </View>
          <Text style={styles.wordmark}>Emberfield</Text>
        </View>
        <Pressable style={styles.exploreLink} onPress={handleStart}>
          <Text style={styles.exploreText}>Explore</Text>
          <Ionicons name="arrow-forward" size={14} color={palette.textMuted} />
        </Pressable>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.eyebrow, desc]}>
          <View style={styles.eyebrowLine} />
          <Text style={styles.eyebrowText}>SATELLITE THERMAL MONITORING</Text>
        </Animated.View>

        <View style={styles.headlineWrap}>
          <Animated.Text style={[styles.line1, { fontSize: isSmall ? 40 : 48 }, line1]}>
            Know what&apos;s
          </Animated.Text>
          <Animated.Text style={[styles.line2, { fontSize: isSmall ? 40 : 48 }, line2]}>
            happening
            <Text style={styles.line2Accent}> around you.</Text>
          </Animated.Text>
        </View>

        <Animated.Text style={[styles.subhead, desc]}>
          Monitor satellite-detected thermal activity, weather, air quality, and official
          wildfire information — all in one calm, clear place.
        </Animated.Text>

        <Animated.View style={[styles.ctaWrap, cta]}>
          <Pressable style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]} onPress={handleStart}>
            <LinearGradient
              colors={['#F0864A', '#D2611F']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryText}>Start Monitoring</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </LinearGradient>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]} onPress={handleStart}>
            <Text style={styles.secondaryText}>Explore App</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.foot, foot]}>
          <Ionicons name="radio-outline" size={14} color={palette.textFaint} />
          <Text style={styles.footText}>Live satellite data · NASA FIRMS · WFIGS</Text>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  topbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  exploreLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exploreText: { fontSize: 15, lineHeight: 22, color: palette.textMuted },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  eyebrowLine: { width: 28, height: 1, backgroundColor: palette.accent },
  eyebrowText: { fontSize: 12, letterSpacing: 1.5, fontWeight: '600', color: palette.accent },
  headlineWrap: { marginBottom: 20 },
  line1: { fontWeight: '700', color: '#fff', letterSpacing: -2, lineHeight: 46 },
  line2: { fontWeight: '700', color: '#fff', letterSpacing: -2, lineHeight: 46 },
  line2Accent: { color: palette.textMuted },
  subhead: { fontSize: 15, lineHeight: 24, color: palette.textMuted, marginBottom: 30, maxWidth: 360 },
  ctaWrap: { gap: 12, marginBottom: 32 },
  primary: { borderRadius: radius.pill, overflow: 'hidden' },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  primaryPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  primaryText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  secondary: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(22,27,34,0.5)',
  },
  secondaryPressed: { backgroundColor: 'rgba(22,27,34,0.8)' },
  secondaryText: { fontSize: 17, fontWeight: '600', color: palette.text },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footText: { fontSize: 11, letterSpacing: 0.2, color: palette.textFaint },
});
