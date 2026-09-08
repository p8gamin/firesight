import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { mapPalette } from '../map/tokens';
import { webClass } from '../design/platform';
import { COLOR, FONT, BP_MD } from '../design/constants';
import { useWeather, useAirQuality, useIncidents } from '../hooks/useData';
import { distanceKm, relativeTime } from '../hooks/useData';
import { formatDetected } from '../map/data';
import { LEVEL_META, distanceLabel, groupCategory, relativeLabel, type LocationEvent } from './model';
import type { GeoPoint, Weather } from '../types';

/**
 * Activity detail sheet — the Locations experience's absorbed Activity
 * functionality (formerly src/components/ActivityBottomSheet). Opening a
 * timeline event slides this panel up with the full read-out: severity,
 * source, concern, detection metrics, conditions, the linked official
 * incident when one exists, and the standard satellite-detection disclaimer.
 * Air-quality events get their own concise read-out.
 */
export function ActivitySheet({
  event,
  origin,
  visible,
  onClose,
}: {
  event: LocationEvent | null;
  origin: GeoPoint | null;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMd = width >= BP_MD;

  const { data: weather } = useWeather();
  const { data: air } = useAirQuality();
  const { data: incidents } = useIncidents();

  if (!event) return null;
  const now = Date.now();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, isMd && styles.backdropMd]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close activity details" />
        <View
          style={[
            styles.sheet,
            { width: isMd ? 520 : width, paddingBottom: insets.bottom + 18 },
          ]}
          {...webClass('lc-blur')}
        >
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {event.category === 'air' && event.air ? (
              <AirReadout event={event} now={now} />
            ) : (
              <GroupReadout event={event} origin={origin} weather={weather} air={air} incidents={incidents} now={now} />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function GroupReadout({
  event,
  origin,
  weather,
  air,
  incidents,
  now,
}: {
  event: LocationEvent;
  origin: GeoPoint | null;
  weather?: Weather;
  air?: { pm25: number; aqi: number; label: string };
  incidents: { id: string; name: string; type: string; containmentPct: number; acreage: string; point: GeoPoint }[];
  now: number;
}) {
  const group = event.group;
  if (!group) return null;
  const meta = LEVEL_META[group.concernScore >= 70 ? 'high' : group.concernScore >= 35 ? 'moderate' : 'low'];
  const cat = groupCategory(group);
  const incident = group.incidentId ? incidents.find((i) => i.id === group.incidentId) : undefined;
  const dist = origin ? distanceKm(origin, group.point) : event.distanceKm;

  const CIRC = 2 * Math.PI * 30;
  const shown = group.concernScore;

  return (
    <>
      <View style={styles.eyebrowRow}>
        <View style={[styles.levelChip, { backgroundColor: `${meta.color}1F`, borderColor: `${meta.color}42` }]}>
          <View style={[styles.levelDot, { backgroundColor: meta.color }]} />
          <Text style={[styles.eyebrow, { color: meta.color }]}>{meta.text}</Text>
        </View>
        <Text style={styles.satellites}>{group.satellites.slice(0, 2).join(' · ')}</Text>
      </View>

      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.subtitle}>
        {distanceLabel(dist)} away · {relativeTime(group.latestDetectedAt)}
      </Text>

      {/* Concern score */}
      <View style={styles.scoreCard}>
        <View style={styles.ringWrap}>
          <Svg width={68} height={68}>
            <Circle cx={34} cy={34} r={30} stroke="rgba(255,255,255,0.1)" strokeWidth={4.5} fill="none" />
            <Circle
              cx={34}
              cy={34}
              r={30}
              stroke={meta.color}
              strokeWidth={4.5}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={CIRC * (1 - shown / 100)}
              transform="rotate(-90 34 34)"
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringValue}>{shown}</Text>
          </View>
        </View>
        <View style={styles.scoreText}>
          <Text style={styles.scoreLabel}>CONCERN SCORE</Text>
          <Text style={styles.scoreBody}>
            {cat === 'fire'
              ? 'Repeated detections and proximity drive this score.'
              : 'Lower-confidence thermal activity — watch the next overpass.'}
          </Text>
        </View>
      </View>

      {/* Detection metrics */}
      <View style={styles.metaCard}>
        <Metric label="First detected" value={formatDetected(group.firstDetectedAt)} />
        <Metric label="Latest" value={formatDetected(group.latestDetectedAt)} />
        <Metric label="Detections" value={`${group.detectionCount}`} />
        <Metric label="Confidence" value={`${Math.round(group.confidence * 100)}%`} />
        <Metric label="FRP" value={`${group.frpMw.toFixed(1)} MW`} />
        <Metric label="Source" value={group.satellites.join(', ')} />
      </View>

      {/* Conditions */}
      {weather || air ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONDITIONS NEAR DETECTION</Text>
          <View style={styles.metaCard}>
            {weather ? (
              <>
                <Metric label="Wind" value={`${weather.windKmh} km/h ${weather.windDir}`} />
                <Metric label="Humidity" value={`${weather.humidityPct}%`} />
                <Metric label="Temp" value={`${weather.tempC}°`} />
              </>
            ) : null}
            {air ? (
              <Metric label="PM2.5 / AQI" value={`${air.pm25} µg/m³ · ${air.aqi}`} />
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Official incident (distinct source) */}
      {incident ? (
        <View style={styles.incidentCard}>
          <View style={styles.incidentHeader}>
            <Ionicons name="shield-checkmark-outline" size={15} color="#7FB8A0" />
            <Text style={styles.incidentLabel}>OFFICIAL INCIDENT · WFIGS</Text>
          </View>
          <Text style={styles.incidentName}>{incident.name}</Text>
          <Text style={styles.incidentMeta}>
            {incident.type} · {incident.containmentPct}% contained · {incident.acreage}
          </Text>
          <Text style={styles.incidentNote}>
            Official incident data and satellite thermal detections are different sources.
          </Text>
        </View>
      ) : null}

      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={13} color={mapPalette.textFaint} />
        <Text style={styles.disclaimerText}>
          Satellite thermal detections are not automatically confirmed wildfires. Points are
          approximate and coverage is periodic.
        </Text>
      </View>
    </>
  );
}

function AirReadout({ event, now }: { event: LocationEvent; now: number }) {
  const a = event.air;
  if (!a) return null;
  return (
    <>
      <View style={styles.eyebrowRow}>
        <View style={[styles.levelChip, { backgroundColor: '#7FB8A01F', borderColor: '#7FB8A042' }]}>
          <View style={[styles.levelDot, { backgroundColor: '#7FB8A0' }]} />
          <Text style={[styles.eyebrow, { color: '#7FB8A0' }]}>AIR QUALITY</Text>
        </View>
        <Text style={styles.satellites}>{relativeLabel(a.occurredAt, now)}</Text>
      </View>

      <Text style={styles.title}>Air quality changed</Text>
      <Text style={styles.subtitle}>
        {a.label} · {event.distanceKm > 0 ? `${event.distanceKm} km from this location` : 'At this location'}
      </Text>

      <View style={styles.metaCard}>
        <Metric label="PM2.5" value={`${a.pm25} µg/m³`} />
        <Metric label="AQI" value={`${a.aqi}`} />
        <Metric label="Quality" value={a.label} />
        <Metric label="Updated" value={formatDetected(a.occurredAt)} />
      </View>

      {a.note ? (
        <View style={styles.noteCard}>
          <Ionicons name="leaf-outline" size={15} color="#7FB8A0" />
          <Text style={styles.noteText}>{a.note}</Text>
        </View>
      ) : null}

      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={13} color={mapPalette.textFaint} />
        <Text style={styles.disclaimerText}>
          Air-quality readings are point estimates; conditions can vary across the region.
        </Text>
      </View>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center' },
  backdropMd: { justifyContent: 'center' },
  sheet: {
    backgroundColor: 'rgba(13,18,24,0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    borderBottomWidth: 0,
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', marginBottom: 14 },
  body: { gap: 14, paddingBottom: 8 },

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
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.6,
    color: COLOR.white,
    marginTop: 4,
  },
  subtitle: { fontFamily: FONT.interRegular, fontSize: 13.5, color: mapPalette.textMuted },

  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
  },
  ringWrap: { width: 68, height: 68 },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: { fontFamily: FONT.interSemiBold, fontSize: 20, color: COLOR.white, letterSpacing: -0.5 },
  scoreText: { flex: 1 },
  scoreLabel: { fontFamily: FONT.interMedium, fontSize: 9, letterSpacing: 1.3, color: mapPalette.textFaint, marginBottom: 4 },
  scoreBody: { fontFamily: FONT.interRegular, fontSize: 12.5, lineHeight: 18, color: mapPalette.textMuted },

  metaCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 14,
    columnGap: 14,
  },
  metric: { width: '47%', minWidth: 0 },
  metricLabel: {
    fontFamily: FONT.interMedium,
    fontSize: 9,
    letterSpacing: 1.1,
    color: mapPalette.textFaint,
    marginBottom: 3,
  },
  metricValue: { fontFamily: FONT.interMedium, fontSize: 13.5, color: COLOR.white },

  section: { gap: 8 },
  sectionLabel: { fontFamily: FONT.interMedium, fontSize: 9.5, letterSpacing: 1.4, color: mapPalette.textFaint },

  incidentCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(127,184,160,0.3)',
    backgroundColor: 'rgba(127,184,160,0.06)',
    padding: 14,
    gap: 3,
  },
  incidentHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  incidentLabel: { fontFamily: FONT.interSemiBold, fontSize: 9, letterSpacing: 1.2, color: '#7FB8A0' },
  incidentName: { fontFamily: FONT.interSemiBold, fontSize: 15, color: COLOR.white, marginTop: 4 },
  incidentMeta: { fontFamily: FONT.interRegular, fontSize: 12.5, color: mapPalette.textMuted },
  incidentNote: { fontFamily: FONT.interRegular, fontSize: 11, lineHeight: 16, color: mapPalette.textFaint, marginTop: 4 },

  noteCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(127,184,160,0.22)', backgroundColor: 'rgba(127,184,160,0.05)', padding: 13 },
  noteText: { flex: 1, fontFamily: FONT.interRegular, fontSize: 13, lineHeight: 19, color: mapPalette.text },

  disclaimer: { flexDirection: 'row', gap: 6, paddingHorizontal: 2 },
  disclaimerText: {
    flex: 1,
    fontFamily: FONT.interRegular,
    fontSize: 11,
    lineHeight: 16,
    color: mapPalette.textFaint,
  },
});