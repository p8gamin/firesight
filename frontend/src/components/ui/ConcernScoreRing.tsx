/**
 * Animated Concern Score ring. A circular progress indicator that counts up
 * on first appearance and animates smoothly when the value changes.
 * Uses react-native-svg + Animated (transform/opacity only).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { palette, typography, severityColor } from '../../theme';
import type { Severity } from '../../types';
import { severityLabel } from '../../theme';

const SIZE = 168;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ConcernScoreRing({
  score,
  severity,
  size = SIZE,
}: {
  score: number;
  severity: Severity;
  size?: number;
}) {
  const stroke = (size / SIZE) * STROKE;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  const progress = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = React.useState(0);
  const color = severityColor[severity];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, {
        toValue: score / 100,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(count, {
        toValue: score,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [score, progress, count]);

  useEffect(() => {
    const id = count.addListener(({ value }) => setDisplay(Math.round(value)));
    return () => count.removeListener(id);
  }, [count]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circ, 0],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={palette.border}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.value, { fontSize: size * 0.3 }]}>{display}</Text>
        <Text style={[styles.max, { fontSize: size * 0.11 }]}>/ 100</Text>
      </View>
    </View>
  );
}

export function ConcernScoreLabel({ severity }: { severity: Severity }) {
  return (
    <View style={[styles.labelPill, { backgroundColor: severityColor[severity] + '22' }]}>
      <Text style={[styles.labelText, { color: severityColor[severity] }]}>{severityLabel[severity]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', position: 'absolute' },
  value: { color: palette.text, fontWeight: '700', letterSpacing: -1.5 },
  max: { color: palette.textMuted, marginTop: -2 },
  labelPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'center',
  },
  labelText: { ...typography.caption, textTransform: 'uppercase' },
});
