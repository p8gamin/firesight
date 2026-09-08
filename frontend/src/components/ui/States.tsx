/**
 * Polished Empty / Loading / Error states — intentional, never a blank screen.
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radius, typography } from '../../theme';

export function EmptyState({
  icon = 'leaf-outline',
  title,
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={palette.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

export function LoadingState({ label = 'Loading activity…' }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="small" color={palette.accent} />
      <Text style={styles.message}>{label}</Text>
    </View>
  );
}

/** Skeleton placeholders for card lists while data "loads". */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={[styles.skeleton, { width: '100%', height: 14, borderRadius: 6 }]} />
          <View style={[styles.skeleton, { width: '60%', height: 12, borderRadius: 6 }]} />
        </View>
      ))}
    </View>
  );
}

export function ErrorState({
  title = 'Unable to update activity',
  message = 'We could not reach the monitoring service. Please try again.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={28} color={palette.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { ...typography.h3, color: palette.text, textAlign: 'center', marginBottom: 6 },
  message: { ...typography.bodySmall, color: palette.textMuted, textAlign: 'center', maxWidth: 300 },
  retry: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
  },
  retryText: { ...typography.label, color: '#fff' },
  skeleton: { backgroundColor: palette.surfaceHover },
  skeletonRow: { gap: 10, padding: 16, borderRadius: radius.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSubtle },
});
