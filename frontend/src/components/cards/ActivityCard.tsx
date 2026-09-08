import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityGroup } from '../../types';
import { palette, typography } from '../../theme';
import { SeverityBadge, Card } from '../ui/Primitives';
import { distanceKm, relativeTime } from '../../hooks/useData';

export function ActivityCard({
  group,
  origin,
  onPress,
}: {
  group: ActivityGroup;
  origin: { lat: number; lon: number };
  onPress?: () => void;
}) {
  const dist = distanceKm(origin, group.point);
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card style={[styles.card, pressed && styles.pressed]}>
          <View style={styles.topRow}>
            <SeverityBadge severity={group.severity} />
            <Text style={styles.dist}>{dist.toFixed(1)} km</Text>
          </View>
          <Text style={styles.label}>{group.label}</Text>
          <Text style={styles.meta}>
            {group.detectionCount} detection{group.detectionCount === 1 ? '' : 's'} · {relativeTime(group.latestDetectedAt)}
          </Text>
          <View style={styles.row}>
            <View style={styles.stat}>
              <Ionicons name="aperture-outline" size={14} color={palette.textMuted} />
              <Text style={styles.statText}>FRP {group.frpMw.toFixed(1)} MW</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="wifi-outline" size={14} color={palette.textMuted} />
              <Text style={styles.statText}>{group.satellites.join(', ')}</Text>
            </View>
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dist: { ...typography.h3, color: palette.text },
  label: { ...typography.h3, color: palette.text, marginTop: 4 },
  meta: { ...typography.bodySmall, color: palette.textMuted },
  row: { flexDirection: 'row', gap: 14, marginTop: 6 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...typography.caption, color: palette.textMuted },
});
