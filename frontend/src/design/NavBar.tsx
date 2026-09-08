import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowRight } from 'lucide-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LiquidGlassNavItem from './LiquidGlassNavItem';
import { BP_MD, BP_SM, COLOR, COPY, FONT, NAV_ITEMS } from './constants';
import { isWeb, toWebStyle, webPillProps } from './platform';

/** FireSight mark — ember flame, the single accent of the palette. */
export function FireSightMark() {
  return <Ionicons name="flame" size={24} color={COLOR.accent} />;
}

function SignUpButton() {
  if (isWeb) {
    // Web: FlowButton — white pill; on hover a dark circle expands from the
    // center while the border-radius relaxes to 12px and text + arrows invert.
    return (
      <button type="button" className="cd-flowbtn">
        {/* Left arrow (slides in from off-canvas on hover) */}
        <ArrowRight className="cd-flowbtn-arrow cd-flowbtn-arrow-left" strokeWidth={2} />
        {/* Text */}
        <span className="cd-flowbtn-text" style={{ fontFamily: FONT.interSemiBold }}>
          {COPY.nav.signUp}
        </span>
        {/* Expanding dark circle */}
        <span className="cd-flowbtn-circle" />
        {/* Right arrow (exits right on hover) */}
        <ArrowRight className="cd-flowbtn-arrow cd-flowbtn-arrow-right" strokeWidth={2} />
      </button>
    );
  }

  // Native: same white pill + arrow, pressed feedback instead of hover.
  return (
    <Pressable
      style={({ pressed }: any) => [
        styles.signUp,
        { backgroundColor: COLOR.white },
        pressed ? styles.pressedDim : null,
      ]}
    >
      <Ionicons name="arrow-forward" size={16} color={COLOR.gray900} />
      <Text style={[styles.signUpText, { color: COLOR.gray900 }]}>
        {COPY.nav.signUp}
      </Text>
    </Pressable>
  );
}

function MobileMenuButton() {
  const icon = <Ionicons name="menu" size={24} color={COLOR.white} />;

  if (isWeb) {
    return (
      <div
        {...webPillProps('cd-click')}
        style={{ ...toWebStyle(styles.menuButton), cursor: 'pointer' }}
      >
        {icon}
      </div>
    );
  }

  return (
    <Pressable
      style={({ pressed }: any) => [
        styles.menuButton,
        pressed ? styles.pressedDim : null,
      ]}
      hitSlop={8}
    >
      {icon}
    </Pressable>
  );
}

function CenterPill({
  activeNav,
  onActive,
}: {
  activeNav: string | null;
  onActive: (id: string | null) => void;
}) {
  // Five liquid-glass pills. Web resolves LiquidGlassNavItem.web.tsx
  // (frosted backdrop blur + layered glass shadows); native resolves
  // LiquidGlassNavItem.tsx (translucent gradient glass approximation).
  return (
    <View style={styles.pillRow}>
      {NAV_ITEMS.map((item) => (
        <LiquidGlassNavItem
          key={item.label}
          label={item.label}
          active={activeNav === item.label}
          onPress={() => onActive(item.label)}
        />
      ))}
    </View>
  );
}

/**
 * Fixed navigation overlaying the hero — logo + wordmark left, five
 * liquid-glass nav pills centered (md+), Sign Up right (md+) / hamburger on
 * mobile.
 */
export default function NavBar() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSm = width >= BP_SM;
  const isMd = width >= BP_MD;
  const pad = isSm ? 20 : 16;
  const [activeNav, setActiveNav] = useState<string | null>(NAV_ITEMS[0].label);

  const rowContent = isMd ? (
    <View style={styles.row}>
      <View style={styles.leftFill}>
        <FireSightMark />
        <Text style={styles.wordmark}>{COPY.wordmark}</Text>
      </View>
      <CenterPill activeNav={activeNav} onActive={setActiveNav} />
      <View style={styles.rightFill}>
        <SignUpButton />
      </View>
    </View>
  ) : (
    <View style={[styles.row, styles.rowBetween]}>
      <View style={styles.leftCluster}>
        <FireSightMark />
        <Text style={styles.wordmark}>{COPY.wordmark}</Text>
      </View>
      <MobileMenuButton />
    </View>
  );

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingHorizontal: pad,
          // Mirror CSS p-4/p-5; add the notch inset on device only.
          paddingTop: pad + (isWeb ? 0 : insets.top),
          paddingBottom: pad,
        },
      ]}
    >
      {rowContent}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    justifyContent: 'space-between',
  },
  leftFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rightFill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontFamily: FONT.interMedium,
    fontSize: 24,
    letterSpacing: -0.5,
    color: COLOR.white,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    justifyContent: 'center',
  },
  signUpText: {
    fontFamily: FONT.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  menuButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorInheritWeb: {
    // RNW text defaults to black; inherit so CSS color transitions apply.
    color: 'inherit',
  },
  pressedDim: { opacity: 0.7 },
});
