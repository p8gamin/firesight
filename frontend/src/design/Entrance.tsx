import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { isWeb, toWebStyle } from './platform';

export type EntranceKind = 'reveal' | 'fade' | 'zoom';

interface EntranceProps {
  /** Which entrance motion to play on load. */
  kind: EntranceKind;
  /** Delay before the animation starts (ms). */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Load-time entrance animation wrapper.
 *
 * Web: the wrapper is a real <div> carrying the exact CSS classes/keyframes
 * from the original template (including its prefers-reduced-motion handling),
 * so the web build behaves like the MotionSites reference. react-native-web
 * drops `className`, so a raw DOM node is required here.
 *
 * Native: plays an equivalent JS-driven animation (opacity + translate for
 * reveal/fade, scale for zoom) with the same easing, duration and stagger
 * delays. Text blur is skipped on native — RN has no cheap cross-platform way
 * to animate it, and the end state is identical.
 */
export default function Entrance({ kind, delay = 0, style, children }: EntranceProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (isWeb) return; // The injected stylesheet owns all web animations.
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active) return;
      setReduceMotion(reduced);
      if (reduced) {
        progress.setValue(1);
        return;
      }
      const duration = kind === 'reveal' ? 1100 : kind === 'fade' ? 1000 : 1800;
      const anim = Animated.timing(progress, {
        toValue: 1,
        duration,
        delay,
        easing: EASE_OUT,
        useNativeDriver: true,
      });
      anim.start();
      return () => anim.stop();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, delay]);

  if (isWeb) {
    const cls =
      kind === 'zoom'
        ? 'hero-zoom'
        : `hero-anim ${kind === 'reveal' ? 'hero-reveal' : 'hero-fade'}`;
    const webStyle = toWebStyle(style) ?? {};
    if (delay > 0) webStyle.animationDelay = `${delay}ms`;
    return (
      // eslint-disable-next-line react/no-unknown-property
      <div className={cls} style={webStyle}>
        {children}
      </div>
    );
  }

  // Native: JS animation with identical intent.
  const motion =
    kind === 'zoom'
      ? {
          opacity: 1,
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1.12, 1],
              }),
            },
          ],
        }
      : {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [kind === 'reveal' ? 28 : 20, 0],
              }),
            },
          ],
        };

  return <Animated.View style={[style, motion]}>{children}</Animated.View>;
}
