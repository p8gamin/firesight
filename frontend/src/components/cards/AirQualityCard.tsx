import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AirQuality } from '../../types';
import { palette, typography, radius } from '../../theme';
import { Card, SourceBadge } from '../ui/Primitives';

export function AirQualityCard({ air }: { air: AirQuality }) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="leaf-outline" size={20} color={palette.text} />
          <Text style={styles.title}>Air Quality</Text>
        </View>
        <SourceBadge source="Air Quality" />
      </View>

      <View style={styles.mainRow}>
        <Text style={styles.pm}>{air.pm25}</Text>
        <View>
          <Text style={styles.unit}>PM2.5 · µg/m³</Text>
          <Text style={styles.aqi}>AQI {air.aqi} · {air.label}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.h3, color: palette.text },
  mainRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  pm: { fontSize: 40, fontWeight: '700', color: palette.text, letterSpacing: -1.5, lineHeight: 44 },
  unit: { ...typography.caption, color: palette.textFaint },
  aqi: { ...typography.body, color: palette.textMuted, marginTop: 2 },
});
