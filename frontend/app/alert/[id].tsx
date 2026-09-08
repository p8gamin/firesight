import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAlerts, useActivityGroups } from '../../src/hooks/useData';
import { requestMapFocus } from '../../src/map/focusRequest';
import { mapPalette } from '../../src/map/tokens';
import { COLOR, FONT } from '../../src/design/constants';
import {
  CATEGORY_META,
  LEVEL_META,
  alertLevelOf,
  detectionLabel,
  distanceLabel,
  pctLabel,
  proximityLabel,
} from '../../src/alerts/model';
import { formatDetected } from '../../src/map/data';
import type { Alert } from '../../src/types';

/**
 * /alert/[id] — the alert detail screen.
 *
 * Navigation structure + full read-out: resolves the alert record, enriches
 * it from its linked activity group (detections / FRP / confidence) when one
 * exists, and offers "View on Map", which centres the existing Map screen on
 * the activity. Fields with no backend value render as '—' rather than being
 * invented.
 */
export default function AlertDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alerts, markRead } = useAlerts();
  const { data: groups } = useActivityGroups();
  const [ready, setReady] = useState(false);

  const alert: Alert | undefined = useMemo(
    () => alerts.find((a) => a.id === id),
    [alerts, id]
  );
  const group = useMemo(
    () => (alert?.groupId ? groups.find((g) => g.id === alert.groupId) : undefined),
    [alert, groups]
  );

  useEffect(() => {
    // Short simulated fetch so the loading state is a real path.
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, [id]);

  useEffect(() => {
    if (alert) markRead(alert.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.id]);

  const viewOnMap = () => {
    if (alert?.point) requestMapFocus({ point: alert.point, label: alert.locationName });
    router.dismissTo('/map');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to alerts"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="chevron-back" size={18} color={mapPalette.text} />
          <Text style={styles.backText}>Alerts</Text>
        </Pressable>
        <Text style={styles.sectionName}>Alert Intelligence</Text>
        <View style={{ width: 60 }} />
      </View>

      {!ready ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={COLOR.accent} />
        </View>
      ) : !alert ? (
        <View style={styles.center}>
          <Text style={styles.missingTitle}>Alert not found</Text>
          <Text style={styles.missingText}>
            This record is no longer available. Alerts change as new detections come in.
          </Text>
          <Pressable
            onPress={() => router.replace('/alerts')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryText}>Back to alerts</Text>
          </Pressable>
        </View>
      ) : (
        (() => {
          const level = alertLevelOf(alert.severity);
          const meta = LEVEL_META[level];
          const cat = CATEGORY_META[alert.category];
          return (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
            >
              <View style={styles.eyebrowRow}>
                <View
                  style={[
                    styles.levelChip,
                    { backgroundColor: `${meta.color}1F`, borderColor: `${meta.color}42` },
                  ]}
                >
                  <View style={[styles.levelDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.eyebrow, { color: meta.color }]}>{meta.text}</Text>
                </View>
                {alert.satellites.length > 0 ? (
                  <Text style={styles.satellites}>{alert.satellites.join(' · ')}</Text>
                ) : null}
              </View>

              <Text style={styles.title}>{alert.title}</Text>
              <Text style={styles.subtitle}>{proximityLabel(alert)}</Text>
              <Text style={styles.body}>{alert.body}</Text>

              <View style={styles.metaCard}>
                <Text style={styles.cardLabel}>CONCERN SCORE</Text>
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreValue, { color: meta.color }]}>{alert.concernScore}</Text>
                  <View style={styles.scoreBar}>
                    <View
                      style={[
                        styles.scoreFill,
                        { width: `${alert.concernScore}%`, backgroundColor: meta.color },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.metricRow}>
                  <Metric label="Latest activity" value={formatDetected(alert.occurredAt)} />
                  <Metric label="Distance" value={distanceLabel(alert.distanceKm)} />
                </View>
                <View style={styles.metricRow}>
                  <Metric label="Detections" value={detectionLabel(group)} />
                  <Metric
                    label="FRP"
                    value={group ? `${group.frpMw.toFixed(1)} MW` : '—'}
                  />
                </View>
                <View style={styles.metricRow}>
                  <Metric label="Confidence" value={pctLabel(group?.confidence)} />
                  <Metric label="Source" value={cat.label} />
                </View>
              </View>

              {alert.triggerReason ? (
                <View style={styles.triggerCard}>
                  <Ionicons name="flash-outline" size={15} color={meta.color} />
                  <View style={styles.triggerText}>
                    <Text style={styles.triggerLabel}>TRIGGER</Text>
                    <Text style={styles.triggerBody}>{alert.triggerReason}</Text>
                  </View>
                </View>
              ) : null}

              <Pressable
                onPress={viewOnMap}
                accessibilityRole="button"
                accessibilityLabel={`View on map — ${alert.title}`}
                style={({ pressed }) => [
                  styles.viewBtn,
                  { backgroundColor: COLOR.accent },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
                ]}
              >
                <Ionicons name="map-outline" size={16} color="#fff" />
                <Text style={styles.viewBtnText}>View on Map</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </Pressable>
            </ScrollView>
          );
        })()
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070B10' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontFamily: FONT.interMedium, fontSize: 15, color: mapPalette.text },
  sectionName: { fontFamily: FONT.interMedium, fontSize: 13, color: mapPalette.textFaint },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  missingTitle: { fontFamily: FONT.interSemiBold, fontSize: 18, color: COLOR.white },
  missingText: {
    fontFamily: FONT.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: mapPalette.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: COLOR.accent,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  primaryText: { fontFamily: FONT.interSemiBold, fontSize: 14, color: '#fff' },
  scroll: { paddingHorizontal: 20, paddingTop: 28 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrow: { fontFamily: FONT.interSemiBold, fontSize: 10.5, letterSpacing: 1.4, lineHeight: 14 },
  satellites: { fontFamily: FONT.interRegular, fontSize: 11, color: mapPalette.textFaint },
  title: {
    fontFamily: FONT.interSemiBold,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.9,
    color: COLOR.white,
    marginTop: 16,
  },
  subtitle: { fontFamily: FONT.interRegular, fontSize: 14, color: mapPalette.textMuted, marginTop: 6 },
  body: {
    fontFamily: FONT.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: mapPalette.textMuted,
    marginTop: 12,
    maxWidth: 560,
  },
  metaCard: {
    marginTop: 26,
    backgroundColor: '#0E141B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  cardLabel: { fontFamily: FONT.interMedium, fontSize: 10, letterSpacing: 1.4, color: mapPalette.textFaint },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreValue: { fontFamily: FONT.interSemiBold, fontSize: 44, lineHeight: 48, letterSpacing: -1.5 },
  scoreBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  scoreFill: { height: 4, borderRadius: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  metricRow: { flexDirection: 'row', gap: 16 },
  metricLabel: {
    fontFamily: FONT.interMedium,
    fontSize: 9,
    letterSpacing: 1.1,
    color: mapPalette.textFaint,
    marginBottom: 4,
  },
  metricValue: { fontFamily: FONT.interMedium, fontSize: 14, color: COLOR.white },
  triggerCard: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(237,140,73,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(237,140,73,0.2)',
    borderRadius: 16,
    padding: 14,
  },
  triggerText: { flex: 1 },
  triggerLabel: {
    fontFamily: FONT.interMedium,
    fontSize: 9,
    letterSpacing: 1.1,
    color: mapPalette.textFaint,
    marginBottom: 3,
  },
  triggerBody: { fontFamily: FONT.interRegular, fontSize: 13.5, lineHeight: 20, color: mapPalette.text },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    paddingVertical: 13,
    marginTop: 18,
  },
  viewBtnText: { fontFamily: FONT.interSemiBold, fontSize: 15, color: '#fff', letterSpacing: 0.2 },
});