import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LiquidGlassNavItem from './LiquidGlassNavItem';
import { BP_MD, NAV_ITEMS } from './constants';

export interface NavCapsuleProps {
  /** Label of the currently active section (e.g. 'Map'). */
  active?: string;
  /** Called with the clicked section label. */
  onNavigate?: (label: string) => void;
}

/**
 * Floating nav capsule (native twin of NavCapsule.web). Mirrors the hero's
 * native nav (AnimatedNavFramer.tsx): the same LiquidGlassNavItem pills in a
 * centered row at the same top offset, shown on md+ screens only — so the
 * map screen's navbar matches the hero page's navbar on every platform.
 */
export default function NavCapsule({ active, onNavigate }: NavCapsuleProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMd = width >= BP_MD;
  const y = insets.top + 24;

  // Hero native nav hides the pills below md (matching that behavior).
  if (!isMd) return null;

  return (
    <View style={[styles.wrap, { top: y }]} pointerEvents="box-none">
      <View style={styles.row}>
        {NAV_ITEMS.map((item) => (
          <LiquidGlassNavItem
            key={item.label}
            label={item.label}
            active={item.label === active}
            onPress={() => onNavigate?.(item.label)}
          />
        ))}
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
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
});