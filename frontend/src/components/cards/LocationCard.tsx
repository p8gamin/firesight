import React from 'react';
import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Location } from '../../types';
import { palette, radius, typography, severityColor } from '../../theme';
import { distanceKm, relativeTime } from '../../hooks/useData';
import type { ActivityGroup } from '../../types';

const KIND_ICON: Record<Location['kind'], keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  school: 'school-outline',
  family: 'people-outline',
  custom: 'location-outline',
};

export function LocationCard({
  location,
  nearest,
  onPress,
  onToggleAlerts,
  onEdit,
  onDelete,
  selected,
}: {
  location: Location;
  nearest?: ActivityGroup;
  onPress?: () => void;
  onToggleAlerts?: (id: string, enabled: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  selected?: boolean;
}) {
  const dist = nearest ? distanceKm(location.point, nearest.point) : null;
  const sev = nearest ? nearest.severity : 'low';

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View style={[styles.card, selected && styles.selected, pressed && styles.pressed]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconWrap}>
                <Ionicons name={KIND_ICON[location.kind]} size={18} color={palette.text} />
              </View>
              <View>
                <Text style={styles.name}>{location.name}</Text>
                <Text style={styles.sub}>{location.radiusKm} km monitoring radius</Text>
              </View>
            </View>
            {onDelete ? (
              <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={palette.textFaint} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Concern</Text>
              <Text style={[styles.statValue, { color: severityColor[sev] }]}>
                {nearest ? nearest.concernScore : '—'}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Nearest</Text>
              <Text style={styles.statValue}>{dist ? `${dist.toFixed(1)} km` : 'None'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Updated</Text>
              <Text style={styles.statValue}>{nearest ? relativeTime(nearest.latestDetectedAt) : '—'}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.alertToggle}>
              <Ionicons name="notifications-outline" size={16} color={palette.textMuted} />
              <Text style={styles.alertLabel}>Alerts</Text>
              <Switch
                value={location.alertsEnabled}
                onValueChange={(v) => onToggleAlerts?.(location.id, v)}
                trackColor={{ true: palette.accent, false: palette.border }}
                thumbColor="#fff"
              />
            </View>
            {onEdit ? (
              <Pressable onPress={onEdit} style={styles.editBtn}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 14,
  },
  selected: { borderColor: palette.accent, borderWidth: 2 },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: palette.surfaceHover, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.h3, color: palette.text },
  sub: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  deleteBtn: { padding: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: 2, flex: 1 },
  statLabel: { ...typography.caption, color: palette.textFaint, textTransform: 'uppercase' },
  statValue: { ...typography.h3, color: palette.text },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.borderSubtle, paddingTop: 12 },
  alertToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertLabel: { ...typography.bodySmall, color: palette.textMuted },
  editBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: palette.surfaceHover },
  editText: { ...typography.caption, color: palette.text },
});
