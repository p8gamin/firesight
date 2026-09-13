/**
 * LiveDataBar (native) — the global "retrieving live heat data" indicator.
 *
 * Shown on EVERY screen while the app is retrieving the user's data — the
 * saved-locations fetch and every heat-data request for those locations
 * (initial post-sign-in load, the 15-minute refresh, foreground catch-up,
 * or a newly added location's request). Previously the "Loading live heat
 * data…" pill existed only inside the Map screen.
 *
 * The web twin (LiveDataBar.web.tsx) renders a raw-DOM pill portaled to
 * document.body, because react-native-web drops `className` on RN elements
 * and its View wrappers trap position:fixed children in low stacking
 * contexts (the same reasons AnimatedNavFramer portals its nav).
 *
 * Signals: the fire store's `syncing` flag (any /fires request in flight)
 * plus the locations store's `loading` phase (the saved_locations fetch
 * that precedes it). Idle states (no saved locations / signed out) never
 * show the bar. Screen-level errors keep their own retry UI; this bar only
 * communicates "the app is actively retrieving data".
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFiresState } from '../services/fireStore';
import { useLocationsStore } from '../locations/store';
import { FONT } from './constants';

export default function LiveDataBar() {
  const { syncing } = useFiresState();
  const { phase } = useLocationsStore();
  const insets = useSafeAreaInsets();

  if (!syncing && phase !== 'loading') return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: insets.bottom + 20 }]}
    >
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(240)}
        style={styles.pill}
      >
        <ActivityIndicator size="small" color="rgba(255,255,255,0.66)" />
        <Text style={styles.text}>Loading live heat data…</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(13, 17, 22, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  text: {
    fontFamily: FONT.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
});
