import React, { memo, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { planeToScreen, type CameraVals } from './camera';
import { lonLatToPlane } from './geo';
import {
  FONT_KEYS,
  mapPalette,
  severityPalette,
  severityText,
  fireSeverity,
  type ConcernCategory,
  type IoniconName,
} from './tokens';
import type { MapFire, FireTier } from '../types';

/**
 * Legacy three-level marker tier from the concern score (65/35 bands).
 * Kept for screens that read it (e.g. /fire/[id] hint copy); the map
 * markers themselves now use the four FireSight concern categories.
 */
export function tierOf(concern: number): FireTier {
  if (concern >= 65) return 'high';
  if (concern >= 35) return 'moderate';
  return 'small';
}

const BOX = 40; // hit box — larger than the visual for easy taps
const CENTER = BOX / 2;

/**
 * Anchors a billboard at a lon/lat through the camera. Children are centred
 * on the anchor; pass an offset to float a chip above/below a marker.
 */
function Billboard({
  camera,
  lon,
  lat,
  children,
  offsetY = 0,
}: {
  camera: CameraVals;
  lon: number;
  lat: number;
  children: React.ReactNode;
  offsetY?: number;
}) {
  const { x, y } = useMemo(() => lonLatToPlane(lon, lat), [lon, lat]);
  const style = useAnimatedStyle(() => {
    const p = planeToScreen(x, y, camera.s.value, camera.tx.value, camera.ty.value);
    return {
      transform: [{ translateX: p.sx - CENTER }, { translateY: p.sy - CENTER + offsetY }],
    };
  }, [camera]);
  return (
    <Animated.View pointerEvents="box-none" style={[styles.billboard, style]}>
      {children}
    </Animated.View>
  );
}

/** Soft expanding pulse ring for high-concern / selected markers. */
function PulseRing({
  color,
  size = 26,
  selected = false,
  period = 2100,
}: {
  color: string;
  size?: number;
  selected?: boolean;
  period?: number;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: period, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(p);
  }, [p, period, reduced]);
  const ring = useAnimatedStyle(() => ({
    opacity: selected ? 0.8 - p.value * 0.6 : 0.5 - p.value * 0.42,
    transform: [{ scale: 1 + p.value * (selected ? 1.35 : 1.1) }],
  }));
  return (
    <Animated.View
      style={[
        styles.pulse,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          borderWidth: 1.5,
          top: (BOX - size) / 2,
          left: (BOX - size) / 2,
        },
        ring,
      ]}
    />
  );
}

/** Marker grammar per Concern Score category (mirrors the native markers). */
const CATEGORY_STYLES: Record<
  ConcernCategory,
  { dot: number; halo: number; haloOpacity: number; hot: number; pulse: boolean }
> = {
  low: { dot: 4.5, halo: 12, haloOpacity: 0.14, hot: 2, pulse: false },
  moderate: { dot: 6, halo: 17, haloOpacity: 0.2, hot: 2.6, pulse: false },
  elevated: { dot: 7.5, halo: 22, haloOpacity: 0.26, hot: 3.2, pulse: false },
  high: { dot: 9, halo: 26, haloOpacity: 0.32, hot: 3.8, pulse: true },
};

const FireVisual = memo(function FireVisual({
  category,
  selected,
}: {
  category: ConcernCategory;
  selected: boolean;
}) {
  const s = CATEGORY_STYLES[category];
  const color = severityPalette[category];
  const centered = (d: number) => ({ top: (BOX - d) / 2, left: (BOX - d) / 2 });
  return (
    <View style={styles.visual}>
      {category !== 'low' ? (
        <View
          style={[
            styles.layer,
            centered(s.halo * 2),
            {
              width: s.halo * 2,
              height: s.halo * 2,
              borderRadius: s.halo,
              backgroundColor: color,
              opacity: s.haloOpacity,
            },
          ]}
        />
      ) : null}
      {s.pulse && <PulseRing color={color} />}
      {selected && <PulseRing color={mapPalette.on} size={30} selected period={1500} />}
      <View
        style={[
          styles.layer,
          centered(s.dot * 2),
          styles.dot,
          { width: s.dot * 2, height: s.dot * 2, borderRadius: s.dot, backgroundColor: color },
        ]}
      >
        <View style={[styles.hot, { width: s.hot * 2, height: s.hot * 2, borderRadius: s.hot }]} />
      </View>
    </View>
  );
});

function ConditionChip({
  camera,
  fire,
  icon,
  label,
  color,
  offsetY,
}: {
  camera: CameraVals;
  fire: MapFire;
  icon: IoniconName;
  label: string;
  color: string;
  offsetY: number;
}) {
  return (
    <Billboard camera={camera} lon={fire.point.lon} lat={fire.point.lat} offsetY={offsetY}>
      <View style={styles.chip}>
        <Ionicons name={icon} size={11} color={color} />
        <Text style={styles.chipText}>{label}</Text>
      </View>
    </Billboard>
  );
}

export interface MarkersProps {
  fires: MapFire[];
  camera: CameraVals;
  selectedFireId?: string | null;
  onSelect?: (id: string) => void;
  airOn: boolean;
  weatherOn: boolean;
  /** Settled camera scale — condition chips only appear zoomed in. */
  zoom: number;
}

export const FireMarkers = memo(function FireMarkers({
  fires,
  camera,
  selectedFireId,
  onSelect,
  airOn,
  weatherOn,
  zoom,
}: MarkersProps) {
  return (
    <>
      {fires.map((fire, i) => {
        const category = fireSeverity(fire);
        const selected = fire.id === selectedFireId;
        const chips = (airOn && fire.air && zoom >= 2.6) || (weatherOn && fire.weather && zoom >= 2.6);
        return (
          <React.Fragment key={fire.id}>
            <Billboard camera={camera} lon={fire.point.lon} lat={fire.point.lat}>
              <Pressable
                onPress={() => onSelect?.(fire.id)}
                accessibilityRole="button"
                accessibilityLabel={`${fire.name}, ${fire.region}. Concern ${fire.concern} — ${severityText[category]}.`}
                style={({ pressed }) => [styles.hit, pressed && { transform: [{ scale: 1.12 }] }]}
              >
                <FireVisual category={category} selected={selected} />
              </Pressable>
            </Billboard>
            {chips ? (
              <>
                {airOn && fire.air ? (
                  <ConditionChip
                    key={`air-${fire.id}`}
                    camera={camera}
                    fire={fire}
                    icon="leaf-outline"
                    color="#8FCEB0"
                    label={`AQI ${fire.air.aqi}`}
                    offsetY={i % 2 === 0 ? -46 : -64}
                  />
                ) : null}
                {weatherOn && fire.weather ? (
                  <ConditionChip
                    key={`wx-${fire.id}`}
                    camera={camera}
                    fire={fire}
                    icon="navigate"
                    color="#A8C9DA"
                    label={`${fire.weather.tempC != null ? `${Math.round(fire.weather.tempC)}° ` : ''}${fire.weather.windDir} ${Math.round(fire.weather.windKmh)}`}
                    offsetY={i % 2 === 0 ? 46 : 62}
                  />
                ) : null}
              </>
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  billboard: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hit: {
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visual: {
    width: BOX,
    height: BOX,
  },
  layer: {
    position: 'absolute',
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
    // soft shadow — helps the dot separate from dark terrain
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  hot: {
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  pulse: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,14,19,0.82)',
    borderWidth: 1,
    borderColor: mapPalette.glassBorderSoft,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    minHeight: 22,
  },
  chipText: {
    fontFamily: FONT_KEYS.interMedium,
    fontSize: 11,
    lineHeight: 14,
    color: mapPalette.textMuted,
  },
});
