import React from 'react';
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
import { useFireById, formatDetected } from '../../src/map/data';
import { tierOf } from '../../src/map/Markers';
import { mapPalette, FONT_KEYS } from '../../src/map/tokens';
import { COLOR, FONT } from '../../src/design/constants';

/**
 * /fire/[id] — the detailed wildfire screen.
 *
 * Resolves the live wildfire record from the FireSight backend and lays
 * out the screen header/metadata. The loading and not-found states below
 * are unchanged.
 */
export default function FireDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { fire, loading } = useFireById(id);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topbar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to map"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="chevron-back" size={18} color={mapPalette.text} />
          <Text style={styles.backText}>Map</Text>
        </Pressable>
        <Text style={styles.sectionName}>Fire Intelligence</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={COLOR.accent} />
        </View>
      ) : !fire ? (
        <View style={styles.center}>
          <Text style={styles.missingTitle}>Fire not found</Text>
          <Text style={styles.missingText}>
            This record is no longer available. Satellite detections change with every overpass.
          </Text>
          <Pressable
            onPress={() => router.replace('/map')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryText}>Back to the map</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        >
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>
              {fire.hasWfigsReport ? 'WILDFIRE' : 'HEAT ANOMALY'}
            </Text>
            <Text style={styles.satellites}>{fire.satellites.join(' · ')}</Text>
          </View>
          <Text style={styles.region}>{fire.region}</Text>
          <Text style={styles.subtitle}>
            {fire.name} · first detected {formatDetected(fire.firstDetectedAt)}
            {!fire.hasWfigsReport ? ' · not yet confirmed as a wildfire' : ''}
          </Text>

          <View style={styles.metaCard}>
            <Text style={styles.cardLabel}>CONCERN SCORE</Text>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreValue}>{fire.concern}</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreFill, { width: `${fire.concern}%` }]} />
              </View>
            </View>
            <Text style={styles.scoreHint}>
              {tierOf(fire.concern) === 'high'
                ? 'High concern — repeated detections, active growth potential.'
                : 'Moderate concern — monitor over the next overpasses.'}
            </Text>

            <View style={styles.divider} />

            <View style={styles.metricRow}>
              <Metric label="Latest detection" value={formatDetected(fire.detectedAt)} />
              <Metric label="FRP" value={`${fire.frpMw.toFixed(1)} MW`} />
            </View>
            <View style={styles.metricRow}>
              <Metric label="Detections" value={String(fire.detections)} />
              <Metric label="Perimeter" value={fire.perimeterId ? 'Available' : '—'} />
            </View>
          </View>

          <View style={styles.placeholderCard}>
            <Ionicons name="construct-outline" size={18} color={mapPalette.textFaint} />
            <Text style={styles.placeholderTitle}>Full fire intelligence arrives with live data</Text>
            <Text style={styles.placeholderBody}>
              Growth projections, containment, air-quality outlook and evacuation context
              will appear here once the FireSight backend is connected. The navigation
              structure and record resolution are in place.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.metricValue}>{value}</Text>
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
  scroll: { paddingHorizontal: 20, paddingTop: 24 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLOR.accent },
  eyebrow: { fontFamily: FONT.interSemiBold, fontSize: 11, letterSpacing: 2, color: COLOR.accent },
  satellites: { fontFamily: FONT.interRegular, fontSize: 11, color: mapPalette.textFaint },
  region: {
    fontFamily: FONT.interSemiBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.2,
    color: COLOR.white,
    marginTop: 14,
  },
  subtitle: { fontFamily: FONT.interRegular, fontSize: 14, color: mapPalette.textMuted, marginTop: 6 },
  metaCard: {
    marginTop: 28,
    backgroundColor: '#0E141B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  cardLabel: { fontFamily: FONT.interMedium, fontSize: 10, letterSpacing: 1.4, color: mapPalette.textFaint },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreValue: { fontFamily: FONT.interSemiBold, fontSize: 44, lineHeight: 48, color: COLOR.white, letterSpacing: -1.5 },
  scoreBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  scoreFill: { height: 4, borderRadius: 2, backgroundColor: COLOR.accent },
  scoreHint: { fontFamily: FONT.interRegular, fontSize: 13, lineHeight: 19, color: mapPalette.textMuted },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  metricRow: { flexDirection: 'row', gap: 16 },
  metricLabel: { fontFamily: FONT.interMedium, fontSize: 9, letterSpacing: 1.1, color: mapPalette.textFaint, marginBottom: 4 },
  metricValue: { fontFamily: FONT.interMedium, fontSize: 14, color: COLOR.white },
  placeholderCard: {
    marginTop: 16,
    backgroundColor: 'rgba(232,112,42,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(232,112,42,0.22)',
    borderRadius: 18,
    padding: 16,
    gap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  placeholderTitle: {
    fontFamily: FONT_KEYS.interMedium,
    fontSize: 14,
    color: COLOR.white,
    flexShrink: 1,
  },
  placeholderBody: {
    fontFamily: FONT.interRegular,
    fontSize: 12.5,
    lineHeight: 19,
    color: mapPalette.textMuted,
    width: '100%',
  },
});
