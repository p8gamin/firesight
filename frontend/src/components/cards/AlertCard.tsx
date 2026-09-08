import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Alert } from '../../types';
import { palette, radius, typography, severityColor } from '../../theme';
import { relativeTime } from '../../hooks/useData';

export function AlertCard({
  alert: a,
  onPress,
}: {
  alert: Alert;
  onPress?: () => void;
}) {
  const c = severityColor[a.severity];
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View style={[styles.card, { borderLeftColor: c }, pressed && styles.pressed]}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={a.read ? 'notifications-outline' : 'notifications'}
              size={18}
              color={a.read ? palette.textFaint : c}
            />
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{a.title}</Text>
              {!a.read && <View style={[styles.unread, { backgroundColor: c }]} />}
            </View>
            <Text style={styles.bodyText}>{a.body}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {a.distanceKm > 0 ? `${a.distanceKm.toFixed(1)} km · ` : ''}
                {relativeTime(a.occurredAt)}
              </Text>
              <Text style={styles.metaFaint}>
                {a.satellites.length > 0 ? `${a.satellites.length} satellite${a.satellites.length === 1 ? '' : 's'}` : a.triggerReason}
              </Text>
            </View>
          </View>
          <Text style={[styles.score, { color: c }]}>{a.concernScore}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderLeftWidth: 3,
  },
  pressed: { opacity: 0.85 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: palette.surfaceHover, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.h3, color: palette.text },
  unread: { width: 8, height: 8, borderRadius: 4 },
  bodyText: { ...typography.bodySmall, color: palette.textMuted },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  meta: { ...typography.caption, color: palette.textMuted },
  metaFaint: { ...typography.caption, color: palette.textFaint },
  score: { ...typography.h3, fontWeight: '700' },
});
