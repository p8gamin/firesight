import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT } from './constants';

export interface LiquidGlassNavItemProps {
  label: string;
  /** Whether this item is the currently selected section. */
  active?: boolean;
  /** Compact pill (phone screens) — smaller type + padding so the full
   * five-section nav fits alongside the brand and the Sign In/Up pill. */
  compact?: boolean;
  onPress?: () => void;
}

/**
 * Liquid-glass nav pill (native).
 *
 * The web twin (LiquidGlassNavItem.web.tsx) gets real frosted glass via
 * backdrop blur; the RN runtime has no backdrop filter without an extra
 * dependency, so this approximates the same glass with layered translucency:
 * a dark tinted base, a vertical white "sheen" gradient on top, a hairline
 * light ring, and a soft drop shadow. The active item's glass is brighter.
 */
export default function LiquidGlassNavItem({
  label,
  active = false,
  compact = false,
  onPress,
}: LiquidGlassNavItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.wrap,
        compact && styles.wrapCompact,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.pill, compact && styles.pillCompact, active ? styles.pillActive : null]}>
        {/* Top-lit translucent sheen over the tinted base */}
        <LinearGradient
          colors={
            active
              ? ['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.05)']
              : ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']
          }
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Text
          style={[
            compact ? styles.labelCompact : styles.label,
            active ? styles.labelActive : styles.labelIdle,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  // Android renders elevation through its native shadow system, which is
  // comparatively expensive; five pills × heavy elevation shows up in scroll
  // frames. Compact pills keep the look with a lighter shadow.
  wrapCompact: {
    elevation: 3,
  },
  pill: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 6,
    backgroundColor: 'rgba(13,17,22,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillCompact: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillActive: {
    backgroundColor: 'rgba(22,28,35,0.5)',
    borderColor: 'rgba(255,255,255,0.42)',
  },
  label: {
    fontFamily: FONT.interMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  labelCompact: {
    fontFamily: FONT.interMedium,
    fontSize: 11.5,
    lineHeight: 16,
  },
  labelIdle: {
    color: 'rgba(255,255,255,0.82)',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelActive: {
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
});
