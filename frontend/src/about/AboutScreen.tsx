import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { mapPalette } from '../map/tokens';
import { webClass, isWeb } from '../design/platform';
import { BP_MD, COLOR, FONT } from '../design/constants';
import { useDesignStyles } from '../design/designCss';
import { useAboutStyles } from './aboutCss';
import NavCapsule from '../design/NavCapsule';
import ShinyBrand from '../design/ShinyBrand';

const NAV_ROUTE: Record<string, string | null> = {
  Home: '/',
  Map: '/map',
  Alerts: '/alerts',
  Locations: '/locations',
  About: '/about',
};

const VERSION = '1.0.0';

/**
 * The About screen — \"Understand FireSight.\" A calm, typography-led
 * explanation of the product: what it is, how it combines satellite
 * detections with official incident + environmental data, the Concern Score
 * at a high level, what it monitors, the mission, and an honest disclaimer.
 * Only sources actually used by the backend are mentioned; no invented
 * partners or links.
 */
export default function AboutScreen() {
  useAboutStyles();
  useDesignStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const reduced = useReducedMotion();
  const isMd = width >= BP_MD;
  const compact = width < 420;

  const navTo = useCallback(
    (label: string) => {
      const route = NAV_ROUTE[label];
      if (route) router.dismissTo(route as never);
    },
    [router]
  );

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: isWeb ? 100 : insets.top + 96, paddingBottom: insets.bottom + 48 },
        ]}
      >
        <View style={[styles.content, compact && styles.contentCompact]}>
          {/* ============================ header ============================ */}
          <View style={styles.header}>
            <Text style={styles.title}>About</Text>
            <Text style={styles.subtitle}>Understand FireSight.</Text>
          </View>

          {/* ============================ intro ============================= */}
          <View style={styles.lead}>
            <Text style={styles.leadText}>
              FireSight is a wildfire monitoring and intelligence tool. It brings satellite
              detections, official incident information, weather and air-quality data together
              so you can understand what's burning — and what's at risk around the places you
              care about.
            </Text>
          </View>

          {/* ========================= how it works ========================= */}
          <Section index={1} title="How FireSight Works">
            <Text style={styles.para}>
              FireSight combines several kinds of information into one view. Satellites detect
              heat on the ground; those detections are grouped into activity events and scored
              by proximity, recency and repeat observations. Official incident and perimeter
              records add context where they exist, and weather + air-quality feeds describe
              the conditions around each event.
            </Text>
            <Text style={styles.para}>
              Every location you save gets a monitoring radius and a live read-out of the
              activity inside it — so the map answers “where are the fires?”, and Locations
              answers “what's happening around the places I care about?”.
            </Text>
          </Section>

          {/* ========================= data sources ========================= */}
          <Section index={2} title="Data Sources">
            <Text style={styles.para}>
              FireSight is built on the following sources:
            </Text>
            <View style={styles.sourceList}>
              <SourceRow
                icon="radio-outline"
                name="Satellite wildfire detection"
                detail="Thermal detections from polar-orbiting satellites, delivered via NASA FIRMS."
              />
              <SourceRow
                icon="shield-checkmark-outline"
                name="Fire incident & perimeter data"
                detail="Official wildfire incidents and perimeters via WFIGS where available."
              />
              <SourceRow
                icon="partly-sunny-outline"
                name="Weather data"
                detail="Local conditions — wind, temperature, humidity — around detected activity."
              />
              <SourceRow
                icon="leaf-outline"
                name="Air-quality data"
                detail="PM2.5 and AQI readings for the areas FireSight monitors."
              />
            </View>
          </Section>

          {/* ======================== concern score ========================= */}
          <Section index={3} title="Concern Score">
            <View style={styles.scoreBlock}>
              <Text style={styles.scoreValue}>0–100</Text>
              <Text style={styles.para}>
                The Concern Score is FireSight's single measure of how much an activity event
                deserves your attention. It weighs how close the activity is to places you
                monitor, how recently it was detected, and how consistently satellites have
                observed it. Higher scores mean higher concern — but it is a monitoring aid,
                not a prediction of fire behaviour.
              </Text>
            </View>
          </Section>

          {/* ======================== what we monitor ======================= */}
          <Section index={4} title="What FireSight Monitors">
            <View style={styles.monitorRow}>
              <MonitorChip icon="flame" label="Wildfires" color={COLOR.accent} />
              <MonitorChip icon="thermometer-outline" label="Heat anomalies" color="#E8A23C" />
              <MonitorChip icon="leaf-outline" label="Air quality" color="#7FB8A0" />
              <MonitorChip icon="partly-sunny-outline" label="Weather" color="#8FB8C9" />
            </View>
          </Section>

          {/* ============================ mission =========================== */}
          <Section index={5} title="Mission">
            <Text style={styles.para}>
              Wildfire information should be easy to understand before it matters. FireSight's
              purpose is to help people understand wildfire activity and environmental
              conditions around the places that matter to them — early, clearly, and without
              noise.
            </Text>
          </Section>

          {/* ========================== disclaimer ========================== */}
          <Section index={6} title="Disclaimer">
            <View style={styles.disclaimerCard}>
              <Ionicons name="information-circle-outline" size={17} color="#E8B23C" />
              <Text style={styles.disclaimerText}>
                FireSight is an informational monitoring tool, not an official emergency
                service. Satellite detections are not automatically confirmed wildfires,
                points are approximate, and wildfire conditions can change rapidly. Always
                follow guidance from local authorities and emergency services.
              </Text>
            </View>
          </Section>

          {/* ========================== app info ============================ */}
          <Section index={7} title="App Information">
            <View style={styles.infoCard}>
              <InfoRow label="Version" value={VERSION} />
              <InfoRow label="Product" value="FireSight — wildfire monitoring & intelligence" />
              <InfoRow
                label="Acknowledgements"
                value="NASA FIRMS · WFIGS · open geospatial basemap data (Natural Earth)"
              />
            </View>
            <Text style={styles.footnote}>
              Heat activity is detected around your saved locations and refreshed
              from the live satellite feed.
            </Text>
          </Section>
        </View>
      </ScrollView>

      {/* ============================ floating chrome ======================= */}
      <View
        style={[
          styles.chrome,
          { paddingTop: isWeb ? (width < BP_MD ? 84 : 24) : insets.top + 24 },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.chromeInner} pointerEvents="box-none">
          {!isWeb || isMd ? (
            <View style={styles.brandRow} pointerEvents="box-none">
              <ShinyBrand />
            </View>
          ) : null}
          <NavCapsule active="About" onNavigate={navTo} />
        </View>
      </View>
    </View>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(420).delay(Math.min(index, 6) * 50)}
      style={styles.section}
    >
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIndex}>{String(index).padStart(2, '0')}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Animated.View>
  );
}

function SourceRow({
  icon,
  name,
  detail,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  detail: string;
}) {
  return (
    <View style={styles.sourceRow}>
      <View style={styles.sourceIcon}>
        <Ionicons name={icon} size={16} color={mapPalette.text} />
      </View>
      <View style={styles.sourceText}>
        <Text style={styles.sourceName}>{name}</Text>
        <Text style={styles.sourceDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function MonitorChip({
  icon,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.monitorChip, { borderColor: `${color}45`, backgroundColor: `${color}14` }]}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.monitorChipText, { color }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mapPalette.oceanDeep },

  scroll: { paddingHorizontal: 20, alignItems: 'center' },
  content: { width: '100%', maxWidth: 720 },
  contentCompact: { maxWidth: 560 },

  header: { marginBottom: 26 },
  title: {
    fontFamily: FONT.interSemiBold,
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -1.2,
    color: COLOR.white,
  },
  subtitle: {
    fontFamily: FONT.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: mapPalette.textMuted,
    marginTop: 3,
  },

  lead: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(237,140,73,0.25)',
    backgroundColor: 'rgba(237,140,73,0.05)',
    padding: 20,
    marginBottom: 8,
  },
  leadText: {
    fontFamily: FONT.interRegular,
    fontSize: 15.5,
    lineHeight: 24,
    color: mapPalette.text,
    letterSpacing: 0.1,
  },

  section: { marginTop: 34 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  sectionIndex: {
    fontFamily: FONT.interSemiBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLOR.accent,
  },
  sectionTitle: {
    fontFamily: FONT.interSemiBold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.6,
    color: COLOR.white,
  },
  sectionBody: { marginTop: 14 },

  para: {
    fontFamily: FONT.interRegular,
    fontSize: 14,
    lineHeight: 22,
    color: mapPalette.textMuted,
    marginBottom: 10,
    maxWidth: 620,
  },

  sourceList: { gap: 9, marginTop: 4 },
  sourceRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.025)',
    padding: 13,
  },
  sourceIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sourceText: { flex: 1, minWidth: 0 },
  sourceName: { fontFamily: FONT.interSemiBold, fontSize: 13.5, color: COLOR.white },
  sourceDetail: {
    fontFamily: FONT.interRegular,
    fontSize: 12.5,
    lineHeight: 18,
    color: mapPalette.textMuted,
    marginTop: 2,
  },

  scoreBlock: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 18,
  },
  scoreValue: {
    fontFamily: FONT.interSemiBold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.6,
    color: COLOR.accent,
    marginBottom: 8,
  },

  monitorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monitorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  monitorChipText: { fontFamily: FONT.interSemiBold, fontSize: 12.5 },

  disclaimerCard: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(232,178,60,0.3)',
    backgroundColor: 'rgba(232,178,60,0.06)',
    padding: 15,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: FONT.interRegular,
    fontSize: 13,
    lineHeight: 20,
    color: mapPalette.text,
  },

  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    gap: 12,
  },
  infoRow: { gap: 3 },
  infoLabel: { fontFamily: FONT.interMedium, fontSize: 9, letterSpacing: 1.2, color: mapPalette.textFaint },
  infoValue: { fontFamily: FONT.interRegular, fontSize: 13.5, lineHeight: 19, color: COLOR.white },
  footnote: {
    fontFamily: FONT.interRegular,
    fontSize: 12,
    lineHeight: 18,
    color: mapPalette.textFaint,
    marginTop: 14,
  },

  chrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 20,
    zIndex: 20,
  },
  chromeInner: { gap: 10, alignItems: 'center' },
  brandRow: { width: '100%', flexDirection: 'row' },
});