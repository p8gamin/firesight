/**
 * Procedural "smoked desert" hero background — layered mountain silhouettes,
 * a gradient sky, and drifting ember particles. No external image needed.
 * Animated with transform/opacity only (compositor-friendly).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useWindowDimensions } from 'react-native';

const EMBER_COLORS = ['#E8702A', '#F2A05B', '#D2611F'];
const NUM_EMBER = 24;

function emberParticles(width: number, height: number) {
  return Array.from({ length: NUM_EMBER }).map((_, i) => {
    const n = (i * 2654435761) % 1000;
    return {
      x: ((n % 1000) / 1000) * width,
      y: height * (0.5 + ((n % 400) / 1000) * 0.5),
      r: 1 + (n % 3),
      c: EMBER_COLORS[i % 3],
      o: 0.22 + ((n % 50) / 100),
    };
  });
}

export function HeroBackground() {
  const { width, height } = useWindowDimensions();
  const zoom = useRef(new Animated.Value(1.1)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(zoom, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(drift, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ),
    ]).start();
    return () => drift.stopAnimation();
  }, [zoom, drift]);

  const particles = emberParticles(width, height);
  const swayY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom }] }]} pointerEvents="none">
      <LinearGradient
        colors={['#05070A', '#0B0E11', '#1A1210', '#2A1610']}
        locations={[0, 0.4, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: swayY }] }]}>
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          <Path
            d={`M0 ${height * 0.66} Q ${width * 0.25} ${height * 0.52}, ${width * 0.5} ${height * 0.6} T ${width} ${height * 0.6} L ${width} ${height} L 0 ${height} Z`}
            fill="#0B0E11"
            opacity={0.85}
          />
          <Path
            d={`M0 ${height * 0.78} Q ${width * 0.3} ${height * 0.66}, ${width * 0.6} ${height * 0.74} T ${width} ${height * 0.7} L ${width} ${height} L 0 ${height} Z`}
            fill="#080A0E"
          />
          {particles.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
          ))}
        </Svg>
      </Animated.View>

      <View style={[styles.glow, { top: height * 0.5, left: width * 0.2 }]} />
      <View style={[styles.glow2, { top: height * 0.58, left: width * 0.62 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    width: 220,
    height: 120,
    borderRadius: 100,
    backgroundColor: '#E8702A',
    opacity: 0.12,
  },
  glow2: {
    position: 'absolute',
    width: 180,
    height: 100,
    borderRadius: 100,
    backgroundColor: '#F2A05B',
    opacity: 0.08,
  },
});
