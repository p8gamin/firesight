import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { mapPalette } from '../map/tokens';
import { webClass } from '../design/platform';
import { COLOR, FONT } from '../design/constants';
import {
  CATEGORY_META,
  LEVEL_META,
  alertLevelOf,
  ageLabel,
  detectionLabel,
  pctLabel,
  proximityLabel,
  type AlertLevel,
} from './model';
import { formatDetected } from '../map/data';
import type { ActivityGroup, Alert } from '../types';

/**
 * Alert card — the Alerts screen's primary unit.
 *
 * Adapted from the provided 21st.dev BentoCard (bento.tsx): the card keeps
 * the bento DNA — a dark panel with a hairline light ring, an inset glow, an
 * eyebrow / title / description hierarchy, a dedicated "graphic" zone, and a
 * hover lift — restructured into a compact list card. The bento's full-bleed
 * image graphic becomes a restrained ember signal rail (radial heat glow +
 * category icon) whose intensity follows severity, echoing the map's heat
 * blobs; the bento's frosted content panel becomes the glass card body.
 *
 * Tap toggles an inline expanded state (marking the alert read) that reveals
 * the detection grid + actions; "View on Map" centres the existing Map screen
 * on the activity, "Details" opens the alert detail route.
 */
export const AlertCard = memo(function AlertCard({
  alert,
  group,
  index,
  expanded,
  onToggle,
  onViewMap,
  onDetails,
}: {
  alert: Alert;
  group?: ActivityGroup;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onViewMap: () => void;
  onDetails: () => void;
}) {
  const reduced = useReducedMotion();
  const level = alertLevelOf(alert.severity);
  const meta = LEVEL_META[level];
  const cat = CATEGORY_META[alert.category];
  const entering = reduced
    ? undefined
    : FadeInDown.duration(380).delay(Math.min(index, 8) * 45).springify().damping(24).stiffness(220);

  return (
    <Animated.View entering={entering} style={styles.wrap}>
      <View style={styles.card} {...webClass('al-card')}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${alert.title}. ${meta.text}. Tap for details.`}
          style={({ pressed }) => [pressed && { opacity: 0.88 }]}
        >
          <View style={styles.bodyRow}>
            <SignalGraphic level={level} categoryIcon={cat.icon} categoryColor={cat.color} id={alert.id} />

            <View style={styles.content}>
              <View style={styles.eyebrowRow}>
                <View style={[styles.levelChip, { backgroundColor: `${meta.color}1F`, borderColor: `${meta.color}42` }]}>
                  <View style={[styles.levelDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.levelText, { color: meta.color }]}>{meta.text}</Text>
                </View>
                {alert.satellites.length > 0 ? (
                  <Text style={styles.satellites} numberOfLines={1}>
                    {alert.satellites.slice(0, 2).join(' · ')}
                  </Text>
                ) : null}
                <View style={styles.eyebrowSpacer} />
                {!alert.read ? <View style={styles.unreadDot} /> : null}
                <Ionicons
                  name="chevron-down"
                  size={15}
                  color={mapPalette.textFaint}
                  style={expanded ? styles.chevronOpen : undefined}
                />
              </View>

              <Text style={styles.title} numberOfLines={1}>
                {alert.title}
              </Text>
              <Text style={styles.body} numberOfLines={2}>
                {alert.body}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={12} color={mapPalette.textFaint} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {proximityLabel(alert)}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={12} color={mapPalette.textFaint} />
                  <Text style={styles.metaText}>{ageLabel(alert.occurredAt)}</Text>
                </View>
                <View style={styles.concern}>
                  <Text style={[styles.concernValue, { color: meta.color }]}>{alert.concernScore}</Text>
                  <View style={styles.concernTrack}>
                    <View style={[styles.concernFill, { width: `${alert.concernScore}%`, backgroundColor: meta.color }]} />
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Pressable>

        {expanded ? (
          <Animated.View
            entering={reduced ? undefined : FadeInDown.duration(240)}
            exiting={reduced ? undefined : FadeOut.duration(150)}
          >
            <View style={styles.divider} />
            <View style={styles.grid}>
              <DetailCell label="Latest activity" value={formatDetected(alert.occurredAt)} />
              <DetailCell label="Detections" value={detectionLabel(group)} />
              <DetailCell
                label="FRP"
                value={group ? `${group.frpMw.toFixed(1)} MW` : '—'}
              />
              <DetailCell label="Confidence" value={pctLabel(group?.confidence)} />
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={onViewMap}
                accessibilityRole="button"
                accessibilityLabel={`View on map — ${alert.title}`}
                style={({ pressed }) => [styles.viewBtn, pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] }]}
                {...webClass('al-tap')}
              >
                <Ionicons name="map-outline" size={15} color="#fff" />
                <Text style={styles.viewBtnText}>View on Map</Text>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </Pressable>
              <Pressable
                onPress={onDetails}
                accessibilityRole="button"
                accessibilityLabel={`Alert details — ${alert.title}`}
                style={({ pressed }) => [styles.detailsBtn, pressed && { opacity: 0.7 }]}
                {...webClass('al-tap')}
              >
                <Text style={styles.detailsText}>Details</Text>
                <Ionicons name="chevron-forward" size={14} color={mapPalette.textMuted} />
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
});

/**
 * The card's "graphic" zone (bento-style): a small heat-glow block whose
 * ember intensity follows severity, with the category icon centred — a
 * restrained nod to the map's heat blobs rather than a stock photo.
 */
function SignalGraphic({
  level,
  categoryIcon,
  categoryColor,
  id,
}: {
  level: AlertLevel;
  categoryIcon: keyof typeof Ionicons.glyphMap;
  categoryColor: string;
  id: string;
}) {
  const meta = LEVEL_META[level];
  const gradientId = `alglow-${id}`;
  return (
    <View style={styles.rail}>
      <Svg width={56} height={56} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={meta.color} stopOpacity={0.14 + meta.glow * 0.6} />
            <Stop offset="65%" stopColor={meta.color} stopOpacity={meta.glow * 0.18} />
            <Stop offset="100%" stopColor={meta.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={28} cy={28} r={27} fill={`url(#${gradientId})`} />
        <Circle cx={28} cy={28} r={19.5} stroke="rgba(255,255,255,0.1)" strokeWidth={1} fill="none" />
      </Svg>
      <Ionicons name={categoryIcon} size={20} color={level === 'low' ? '#9AA8B4' : categoryColor} />
    </View>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.cellValue} numberOfLines={1}>
        {value}
      </Text>
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
    // soft float shadow — subtle, never harsh
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
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  satellites: {
    fontFamily: FONT.interRegular,
    fontSize: 10.5,
    color: mapPalette.textFaint,
    flexShrink: 1,
  },
  eyebrowSpacer: { flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ED8C49' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  title: {
    fontFamily: FONT.interSemiBold,
    fontSize: 16.5,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: mapPalette.text,
    marginTop: 7,
  },
  body: {
    fontFamily: FONT.interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: mapPalette.textMuted,
    marginTop: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 9 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { fontFamily: FONT.interRegular, fontSize: 11.5, color: mapPalette.textFaint },
  concern: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  concernValue: { fontFamily: FONT.interSemiBold, fontSize: 12.5, lineHeight: 16 },
  concernTrack: {
    width: 26,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  concernFill: { height: 3, borderRadius: 1.5 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 14 },
  cell: { width: '47%', minWidth: 0 },
  cellLabel: {
    fontFamily: FONT.interMedium,
    fontSize: 9,
    letterSpacing: 1.1,
    color: mapPalette.textFaint,
    marginBottom: 3,
  },
  cellValue: { fontFamily: FONT.interMedium, fontSize: 13, color: mapPalette.text },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLOR.accent,
    borderRadius: 12,
    paddingVertical: 11,
  },
  viewBtnText: { fontFamily: FONT.interSemiBold, fontSize: 14, color: '#fff', letterSpacing: 0.2 },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  detailsText: { fontFamily: FONT.interMedium, fontSize: 13.5, color: mapPalette.textMuted },
});