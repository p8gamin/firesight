/**
 * Small, reusable UI primitives shared across screens.
 */
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { palette, radius, typography, shadow, severityColor, severityLabel } from '../../theme';
import type { Severity, SourceKind } from '../../types';

/** A frosted, elevated surface card. */
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Severity pill — colour is always paired with a text label (never colour alone). */
export function SeverityBadge({ severity, style }: { severity: Severity; style?: ViewStyle }) {
  const c = severityColor[severity];
  return (
    <View style={[styles.badge, { backgroundColor: c + '22', borderColor: c + '44' }, style]}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.badgeText, { color: c }]}>{severityLabel[severity]}</Text>
    </View>
  );
}

/** Small data-source label (NASA FIRMS, WFIGS, etc.). */
export function SourceBadge({ source, style }: { source: SourceKind; style?: ViewStyle }) {
  return (
    <View style={[styles.source, style]}>
      <Text style={styles.sourceText}>{source}</Text>
    </View>
  );
}

/** Section heading with an optional trailing action. */
export function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** A subtle horizontal divider. */
export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

/** Metric label + value row used inside cards. */
export function Metric({
  label,
  value,
  unit,
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.metric, style]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    padding: 18,
    ...shadow.card,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { ...typography.caption, textTransform: 'uppercase' },
  source: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceHover,
    borderWidth: 1,
    borderColor: palette.borderSubtle,
  },
  sourceText: { ...typography.caption, color: palette.textMuted },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { ...typography.h2, color: palette.text },
  sectionSubtitle: { ...typography.bodySmall, color: palette.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: palette.borderSubtle },
  metric: { minWidth: 0 },
  metricLabel: { ...typography.caption, color: palette.textFaint, textTransform: 'uppercase', marginBottom: 4 },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  metricValue: { ...typography.h3, color: palette.text },
  metricUnit: { ...typography.bodySmall, color: palette.textMuted },
});
