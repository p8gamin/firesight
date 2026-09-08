import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Weather } from '../../types';
import { palette, typography, radius } from '../../theme';
import { Card, SourceBadge } from '../ui/Primitives';

export function WeatherCard({ weather }: { weather: Weather }) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="partly-sunny-outline" size={20} color={palette.text} />
          <Text style={styles.title}>Weather</Text>
        </View>
        <SourceBadge source="Weather" />
      </View>

      <View style={styles.mainRow}>
        <Text style={styles.temp}>{weather.tempC}°</Text>
        <Text style={styles.condition}>{weather.condition}</Text>
      </View>

      <View style={styles.grid}>
        <Metric icon="navigate-outline" label="Wind" value={`${weather.windKmh} km/h ${weather.windDir}`} />
        <Metric icon="water-outline" label="Humidity" value={`${weather.humidityPct}%`} />
      </View>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={14} color={palette.textMuted} />
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typography.h3, color: palette.text },
  mainRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  temp: { fontSize: 40, fontWeight: '700', color: palette.text, letterSpacing: -1.5, lineHeight: 44 },
  condition: { ...typography.body, color: palette.textMuted },
  grid: { flexDirection: 'row', gap: 20 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricLabel: { ...typography.caption, color: palette.textFaint },
  metricValue: { ...typography.h3, color: palette.text },
});
