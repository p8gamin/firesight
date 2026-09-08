import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ActivityGroup, Weather, AirQuality, Incident } from '../types';
import { palette, radius, typography } from '../theme';
import { SeverityBadge, SourceBadge, Card, Divider, Metric } from './ui/Primitives';
import { distanceKm, relativeTime, todayLabel, formatClock } from '../hooks/useData';
import { ConcernScoreRing, ConcernScoreLabel } from './ui/ConcernScoreRing';

export function ActivityBottomSheet({
  group,
  origin,
  weather,
  air,
  incident,
  visible,
  onClose,
}: {
  group: ActivityGroup;
  origin: { lat: number; lon: number };
  weather?: Weather;
  air?: AirQuality;
  incident?: Incident;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slide, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      slide.setValue(0);
    }
  }, [visible, slide]);

  const dist = distanceKm(origin, group.point);
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={styles.badgeRow}>
                <SeverityBadge severity={group.severity} />
                <SourceBadge source="NASA FIRMS" />
              </View>
              <Text style={styles.title}>{group.label}</Text>
              <Text style={styles.subtitle}>
                {dist.toFixed(1)} km away · {relativeTime(group.latestDetectedAt)}
              </Text>
            </View>
          </View>

          {/* Concern score */}
          <Card style={styles.scoreCard}>
            <ConcernScoreRing score={group.concernScore} severity={group.severity} />
            <ConcernScoreLabel severity={group.severity} />
          </Card>

          {/* Detection metrics */}
          <Card style={{ gap: 14 }}>
            <View style={styles.metricRow}>
              <Metric label="First detected" value={todayLabel(group.firstDetectedAt)} />
              <Metric label="Latest detection" value={formatClock(group.latestDetectedAt)} />
            </View>
            <Divider />
            <View style={styles.metricRow}>
              <Metric label="Detections" value={String(group.detectionCount)} />
              <Metric label="Confidence" value={confidenceLabel(group.confidence)} />
            </View>
            <Divider />
            <View style={styles.metricRow}>
              <Metric label="FRP" value={group.frpMw.toFixed(1)} unit="MW" />
              <Metric label="Satellites" value={group.satellites.join(', ')} />
            </View>
          </Card>

          {/* Weather + air */}
          <Card style={{ gap: 14 }}>
            <Text style={styles.sectionLabel}>Conditions near detection</Text>
            <View style={styles.metricRow}>
              {weather ? <Metric label="Wind" value={`${weather.windKmh} km/h ${weather.windDir}`} /> : null}
              {weather ? <Metric label="Humidity" value={`${weather.humidityPct}%`} /> : null}
            </View>
            <Divider />
            <View style={styles.metricRow}>
              {air ? <Metric label="PM2.5" value={`${air.pm25}`} unit="µg/m³" /> : null}
              {weather ? <Metric label="Temp" value={`${weather.tempC}°`} /> : null}
            </View>
          </Card>

          {/* Official incident (distinct source) */}
          {incident ? (
            <Card style={styles.incidentCard}>
              <View style={styles.incidentHeader}>
                <Ionicons name="shield-checkmark-outline" size={18} color={palette.low} />
                <Text style={styles.incidentLabel}>OFFICIAL INCIDENT</Text>
                <SourceBadge source="WFIGS" />
              </View>
              <Text style={styles.incidentName}>{incident.name}</Text>
              <Text style={styles.incidentType}>{incident.type} · {incident.containmentPct}% contained · {incident.acreage}</Text>
              <Text style={styles.incidentNote}>Official incident data and satellite thermal detections are different sources.</Text>
            </Card>
          ) : null}

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={14} color={palette.textFaint} />
            <Text style={styles.disclaimerText}>
              Satellite thermal detections are not automatically confirmed wildfires. Points are
              approximate and coverage is periodic.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function confidenceLabel(c: number): string {
  if (c >= 0.85) return 'High';
  if (c >= 0.6) return 'Moderate';
  return 'Low';
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border, marginBottom: 14 },
  header: { gap: 6 },
  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  title: { ...typography.h1, color: palette.text },
  subtitle: { ...typography.bodySmall, color: palette.textMuted },
  scoreCard: { alignItems: 'center', gap: 10 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  sectionLabel: { ...typography.label, color: palette.textMuted, textTransform: 'uppercase' },
  incidentCard: { gap: 6, borderColor: palette.low + '44' },
  incidentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incidentLabel: { ...typography.caption, color: palette.low, letterSpacing: 1 },
  incidentName: { ...typography.h2, color: palette.text },
  incidentType: { ...typography.bodySmall, color: palette.textMuted },
  incidentNote: { ...typography.caption, color: palette.textFaint, marginTop: 4 },
  disclaimer: { flexDirection: 'row', gap: 6, paddingHorizontal: 4 },
  disclaimerText: { ...typography.caption, color: palette.textFaint, flex: 1, lineHeight: 16 },
});
