/**
 * A lightweight entrance animation wrapper (fade + slight rise).
 * Composable with a delay for staggered reveals. Respects reduced motion.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, AccessibilityInfo, ViewStyle } from 'react-native';

export function FadeIn({
  children,
  delay = 0,
  style,
  distance = 18,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
  distance?: number;
}) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let raf: number;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        value.setValue(1);
        return;
      }
      // slight delay lets layout settle before animating
      raf = requestAnimationFrame(() => {
        Animated.timing(value, {
          toValue: 1,
          duration: 520,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    });
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, delay]);

  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });

  return (
    <Animated.View style={[style, { opacity: value, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export const fadeStyles = StyleSheet.create({});
