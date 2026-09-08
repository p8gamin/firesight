import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { mapPalette } from '../map/tokens';
import { webClass } from '../design/platform';
import { COLOR, FONT } from '../design/constants';
import { LEVEL_META, type LocationSummary } from './model';
import type { Location } from '../types';

const KIND_ICON: Record<Location['kind'], keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  school: 'school-outline',
  family: 'people-outline',
  custom: 'location-outline',
};

/**
 * Saved-location card — the Locations list's primary unit. Shares the bento
 * DNA of the alert cards (dark panel, hairline ring, inset ember glow, an
 * eyebrow/title/description hierarchy, quiet hover lift): the rail graphic is
 * a soft glow in the location's activity level colour with its kind icon,
 * the body carries the name + place, a nearby-activity read-out derived from
 * real records, and a clear next action.
 */
export const LocationCard = memo(function LocationCard({
  location,
  summary,
  index,
  onOpen,
  onMenu,
}: {
  location: Location;
  summary: LocationSummary;
  index: number;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const reduced = useReducedMotion();
  const level = summary.level;
  const meta = LEVEL_META[level];
  const entering = reduced
    ? undefined
    : FadeInDown.duration(380)
        .delay(Math.min(index, 8) * 45)
        .springify()
        .damping(24)
        .stiffness(220);

  const stats: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }[] = [
    { icon: 'flame', text: `${summary.fires} fire${summary.fires === 1 ? '' : 's'}`, color: summary.fires > 0 ? COLOR.accent : mapPalette.textFaint },
    { icon: 'thermometer-outline', text: `${summary.heat} heat`, color: summary.heat > 0 ? '#E8A23C' : mapPalette.textFaint },
    summary.airLabel
      ? { icon: 'leaf-outline', text: summary.airLabel, color: '#7FB8A0' }
      : { icon: 'leaf-outline', text: 'Air —', color: mapPalette.textFaint },
  ];

  return (
    <Animated.View entering={entering} style={styles.wrap}>
      <View style={styles.card} {...webClass('lc-card')}>
        {/* menu — a sibling of the main pressable (never nested buttons) */}
        <Pressable
          onPress={onMenu}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`${location.name} — options`}
          style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.6 }]}
          {...webClass('lc-tap')}
        >
          <Ionicons name="ellipsis-horizontal" size={17} color={mapPalette.textFaint} />
        </Pressable>

        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${location.name}`}
          style={({ pressed }) => [pressed && { opacity: 0.88 }]}
        >
          <View style={styles.bodyRow}>
            <KindRail kind={location.kind} levelColor={meta.color} levelGlow={meta.glow} id={location.id} />

            <View style={styles.content}>
              <View style={styles.eyebrowRow}>
                <View
                  style={[
                    styles.levelChip,
                    { backgroundColor: `${meta.color}1F`, borderColor: `${meta.color}42` },
                  ]}
                >
                  <View style={[styles.levelDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.levelText, { color: meta.color }]}>{meta.text}</Text>
                </View>
              </View>

              <Text style={styles.name} numberOfLines={1}>
                {location.name}
              </Text>
              <Text style={styles.place} numberOfLines={1}>
                {location.placeLabel}
              </Text>

              <View style={styles.metaRow}>
                {stats.map((s, i) => (
                  <View key={i} style={styles.metaItem}>
                    <Ionicons name={s.icon} size={12} color={s.color} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {s.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Pressable>

        <View style={styles.divider} />
        <View style={styles.footer}>
          <View style={styles.footerMeta}>
            <View style={styles.footerItem}>
              <Ionicons name="scan-outline" size={12} color={mapPalette.textFaint} />
              <Text style={styles.footerText}>{location.radiusKm} km radius</Text>
            </View>
            {summary.lastAt ? (
              <View style={styles.footerItem}>
                <Ionicons name="time-outline" size={12} color={mapPalette.textFaint} />
                <Text style={styles.footerText}>Last activity · {relativeShort(summary.lastAt)}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={`View activity for ${location.name}`}
            style={({ pressed }) => [styles.viewBtn, pressed && { opacity: 0.82 }]}
            {...webClass('lc-tap')}
          >
            <Text style={styles.viewText}>View Activity</Text>
            <Ionicons name="arrow-forward" size={14} color={COLOR.accent} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
});

function relativeShort(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function KindRail({
  kind,
  levelColor,
  levelGlow,
  id,
}: {
  kind: Location['kind'];
  levelColor: string;
  levelGlow: number;
  id: string;
}) {
  const gradientId = `lcglow-${id}`;
  return (
    <View style={styles.rail}>
      <Svg width={56} height={56} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={levelColor} stopOpacity={0.1 + levelGlow * 0.5} />
            <Stop offset="65%" stopColor={levelColor} stopOpacity={levelGlow * 0.16} />
            <Stop offset="100%" stopColor={levelColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={28} cy={28} r={27} fill={`url(#${gradientId})`} />
        <Circle cx={28} cy={28} r={19.5} stroke="rgba(255,255,255,0.1)" strokeWidth={1} fill="none" />
      </Svg>
      <Ionicons name={KIND_ICON[kind]} size={20} color={mapPalette.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  card: {
    backgroundColor: '#0D1218',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  bodyRow: { flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  rail: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0A0F15',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: { flex: 1, minWidth: 0 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 26 },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelDot: { width: 5, height: 5, borderRadius: 2.5 },
  levelText: { fontFamily: FONT.interSemiBold, fontSize: 9.5, letterSpacing: 1, lineHeight: 13 },
  menuBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  name: {
    fontFamily: FONT.interSemiBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
    color: mapPalette.text,
    marginTop: 7,
  },
  place: {
    fontFamily: FONT.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: mapPalette.textMuted,
    marginTop: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 9, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { fontFamily: FONT.interRegular, fontSize: 11.5, color: mapPalette.textFaint },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  footerMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontFamily: FONT.interRegular, fontSize: 11.5, color: mapPalette.textFaint },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  viewText: { fontFamily: FONT.interSemiBold, fontSize: 13, color: COLOR.accent },
});