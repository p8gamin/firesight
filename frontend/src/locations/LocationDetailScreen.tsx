import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useActivityGroups, useAirEvents } from '../hooks/useData';
import { mapPalette } from '../map/tokens';
import { webClass, isWeb } from '../design/platform';
import { COLOR, FONT } from '../design/constants';
import { useLocationStyles } from './locationCss';
import { useLocationsStore, removeLocation } from './store';
import {
  ACTIVITY_FILTERS,
  LEVEL_META,
  TIME_WINDOWS,
  TREND_DIRECTION_META,
  datasetNow,
  distanceLabel,
  eventsFor,
  locationSummary,
  mostActiveNearby,
  nearestCityLabel,
  relativeLabel,
  trendFor,
  type ActivityFilter,
  type LocationEvent,
  type TimeWindowId,
} from './model';
import { requestMapFocus } from '../map/focusRequest';
import { formatDetected } from '../map/data';
import { useDesignStyles } from '../design/designCss';
import NavCapsule from '../design/NavCapsule';
import ShinyBrand from '../design/ShinyBrand';
import MiniMap, { type MiniMarker } from './MiniMap';
import { ActivitySheet } from './ActivitySheet';
import AddLocationModal from './AddLocationModal';
import { LocationMenuModal, RemoveConfirmModal } from './LocationMenuModal';
import type { Location } from '../types';

const NAV_ROUTE: Record<string, string | null> = {
  Home: '/',
  Map: '/map',
  Alerts: '/alerts',
  Locations: '/locations',
  About: '/about',
};

/**
 * /location/[id] — a saved location's personalized monitoring view.
 *
 * \"Your places. Their activity.\": current activity level, a 7-day trend,
 * the activity map around the location (monitoring radius respected), time +
 * activity filters over the recent-activity timeline, a most-active-nearby
 * ranking, and the management menu. The timeline's events open the absorbed
 * Activity detail sheet. Everything on screen derives from records via the
 * data layer — nothing is fabricated.
 */
export default function LocationDetailScreen() {
  useLocationStyles();
  useDesignStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { locations } = useLocationsStore();
  const { data: groups, loading: groupsLoading } = useActivityGroups();
  const { data: airEvents, loading: airLoading } = useAirEvents();

  const [timeWindow, setTimeWindow] = useState<TimeWindowId>('7d');
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [activeEvent, setActiveEvent] = useState<LocationEvent | null>(null);
  const [menuFor, setMenuFor] = useState<Location | null>(null);
  const [removing, setRemoving] = useState<Location | null>(null);
  const [editing, setEditing] = useState<Location | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const location: Location | undefined = useMemo(
    () => locations.find((l) => l.id === id),
    [locations, id]
  );

  const summary = useMemo(
    () => (location ? locationSummary(location, groups, airEvents) : null),
    [location, groups, airEvents]
  );

  const events = useMemo(() => {
    if (!location) return [];
    const hours = TIME_WINDOWS.find((w) => w.id === timeWindow)?.hours ?? Infinity;
    return eventsFor(location, groups, airEvents, hours, filter);
  }, [location, groups, airEvents, timeWindow, filter]);

  const trend = useMemo(
    () => (location ? trendFor(location, groups, airEvents, 7) : null),
    [location, groups, airEvents]
  );

  const markers: MiniMarker[] = useMemo(() => {
    if (!location) return [];
    return events
      .filter((e) => e.category !== 'air' && e.group)
      .map((e) => ({
        id: e.id,
        point: e.group!.point,
        kind: e.category as 'fire' | 'heat',
        concern: e.group!.concernScore,
      }));
  }, [events, location]);

  const mostActive = useMemo(
    () => (location ? mostActiveNearby(location, groups, 3) : []),
    [location, groups]
  );

  const now = useMemo(() => datasetNow(events), [events]);
  const loading = groupsLoading || airLoading;
  const compact = width < 420;
  const mapWidth = Math.min(width - 40, 560);

  const navTo = useCallback(
    (label: string) => {
      const route = NAV_ROUTE[label];
      if (route) router.dismissTo(route as never);
    },
    [router]
  );

  const viewFullMap = useCallback(() => {
    if (!location) return;
    requestMapFocus({ point: location.point, label: location.name });
    router.dismissTo('/map');
  }, [location, router]);

  if (!location) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Topbar onBack={() => router.back()} title="Location Intelligence" onMenu={null} />
        <View style={styles.center}>
          <Text style={styles.missingTitle}>Location not found</Text>
          <Text style={styles.missingText}>
            This location is no longer in your saved places.
          </Text>
          <Pressable
            onPress={() => router.dismissTo('/locations')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryText}>Back to locations</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const meta = LEVEL_META[summary?.level ?? 'low'];

  return (
    <View style={[styles.root, { paddingTop: isWeb ? 0 : insets.top }]}>
      <Topbar
        onBack={() => router.back()}
        title="Location Intelligence"
        onMenu={() => setMenuFor(location)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 48 },
        ]}
      >
        <View style={[styles.content, compact && styles.contentCompact]}>
          {/* ============================ header ============================ */}
          <View style={styles.eyebrowRow}>
            <View
              style={[
                styles.levelChip,
                { backgroundColor: `${meta.color}1F`, borderColor: `${meta.color}42` },
              ]}
            >
              <View style={[styles.levelDot, { backgroundColor: meta.color }]} />
              <Text style={[styles.eyebrow, { color: meta.color }]}>CURRENT ACTIVITY · {meta.text}</Text>
            </View>
          </View>
          <Text style={styles.title}>{location.name}</Text>
          <Text style={styles.place}>{location.placeLabel}</Text>

          {/* current activity read-out */}
          <View style={styles.activityRow}>
            <ActivityStat icon="flame" label="Fires" value={summary?.fires ?? 0} color={COLOR.accent} />
            <View style={styles.statDivider} />
            <ActivityStat icon="thermometer-outline" label="Heat" value={summary?.heat ?? 0} color="#E8A23C" />
            <View style={styles.statDivider} />
            <ActivityStat
              icon="leaf-outline"
              label="Air"
              value={summary?.airLabel ?? '—'}
              color="#7FB8A0"
              small
            />
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValueSmall}>
                {summary?.lastAt ? relativeLabel(summary.lastAt, now) : '—'}
              </Text>
              <Text style={styles.statLabel}>LAST ACTIVITY</Text>
            </View>
          </View>

          {/* ============================ trend ============================= */}
          {trend ? (
            <View style={styles.card} {...webClass('lc-card')}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Activity · Last 7 Days</Text>
                <TrendChip direction={trend.direction} />
              </View>
              {loading ? (
                <SkeletonBars />
              ) : (
                <TrendBars buckets={trend.buckets} />
              )}
            </View>
          ) : null}

          {/* ========================= activity map ========================= */}
          <View style={styles.card} {...webClass('lc-card')}>
            <Text style={styles.cardTitle}>Activity around {location.name}</Text>
            <MiniMap
              locationPoint={location.point}
              placeLabel={location.placeLabel}
              radiusKm={location.radiusKm}
              markers={markers}
              airLabel={summary?.airLabel ? `Air · ${summary.airLabel}` : null}
              width={mapWidth}
              height={Math.round(Math.min(mapWidth, 560) * 0.56)}
            />
            <Pressable
              onPress={viewFullMap}
              accessibilityRole="button"
              accessibilityLabel="View full map"
              style={({ pressed }) => [styles.mapLink, pressed && { opacity: 0.8 }]}
              {...webClass('lc-tap')}
            >
              <Ionicons name="map-outline" size={14} color={COLOR.accent} />
              <Text style={styles.mapLinkText}>View Full Map</Text>
              <Ionicons name="arrow-forward" size={14} color={COLOR.accent} />
            </Pressable>
          </View>

          {/* ============================ filters =========================== */}
          <View style={styles.filtersRow}>
            <View style={styles.timeFilters} {...webClass('lc-blur')}>
              {TIME_WINDOWS.map((w) => {
                const active = timeWindow === w.id;
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => setTimeWindow(w.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Activity from the last ${w.label}`}
                    style={({ pressed }) => [styles.filterPress, pressed && { transform: [{ scale: 0.96 }] }]}
                    {...webClass('lc-tap')}
                  >
                    <View style={[styles.filterChip, active && styles.filterChipOn]}>
                      <Text style={[styles.filterLabel, active && { color: '#fff' }]}>{w.label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.catFilters} {...webClass('lc-blur')}>
            {ACTIVITY_FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Filter activity — ${f.label}`}
                  style={({ pressed }) => [styles.catPress, pressed && { transform: [{ scale: 0.96 }] }]}
                  {...webClass('lc-tap')}
                >
                  <View style={[styles.catChip, active && styles.catChipOn]}>
                    <Text style={[styles.catLabel, active && { color: '#fff' }]}>{f.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ======================= recent activity ======================== */}
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {loading ? (
            <View style={styles.timeline}>
              <SkeletonEvent />
              <SkeletonEvent />
              <SkeletonEvent />
            </View>
          ) : events.length === 0 ? (
            <View style={styles.quietState}>
              <View style={styles.quietIcon}>
                <Ionicons name="leaf-outline" size={22} color="#7C8A96" />
              </View>
              <Text style={styles.quietTitle}>No significant activity</Text>
              <Text style={styles.quietBody}>
                FireSight hasn't detected notable activity around this location during the
                selected period.
              </Text>
            </View>
          ) : (
            <View style={styles.timeline} key={`${timeWindow}-${filter}`}>
              {events.map((e, i) => (
                <EventRow
                  key={e.id}
                  event={e}
                  now={now}
                  first={i === 0}
                  onPress={() => setActiveEvent(e)}
                />
              ))}
            </View>
          )}

          {/* ====================== most active nearby ====================== */}
          {mostActive.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Most Active Nearby</Text>
              <View style={styles.card} {...webClass('lc-card')}>
                {mostActive.map((g, i) => (
                  <Pressable
                    key={g.id}
                    onPress={() => {
                      const ev = eventsFor(location, [g], [], Infinity, 'all')[0];
                      if (ev) setActiveEvent(ev);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${nearestCityLabel(g.point)} activity`}
                    style={({ pressed }) => [styles.rankRow, i > 0 && styles.rankRowBorder, pressed && { opacity: 0.75 }]}
                    {...webClass('lc-tap')}
                  >
                    <Text style={styles.rankNum}>{String(i + 1).padStart(2, '0')}</Text>
                    <View style={styles.rankText}>
                      <Text style={styles.rankName}>{nearestCityLabel(g.point)}</Text>
                      <View style={styles.rankBar}>
                        <View
                          style={[
                            styles.rankFill,
                            { width: `${g.concernScore}%`, backgroundColor: g.concernScore >= 70 ? '#ED8C49' : g.concernScore >= 35 ? '#D9A43C' : '#7C8A96' },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={styles.rankScore}>{g.concernScore}</Text>
                    <Text style={styles.rankDist}>{distanceLabel(distanceKmOf(location, g.point))}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* floating chrome */}
      <View
        style={[
          styles.chrome,
          { paddingTop: isWeb ? (width < 768 ? 84 : 24) : 0 },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.chromeInner} pointerEvents="box-none">
          {!isWeb || width >= 768 ? (
            <View style={styles.brandRow} pointerEvents="box-none">
              <ShinyBrand />
            </View>
          ) : null}
          <NavCapsule active="Locations" onNavigate={navTo} />
        </View>
      </View>

      {/* modals */}
      <ActivitySheet
        visible={!!activeEvent}
        event={activeEvent}
        origin={location.point}
        onClose={() => setActiveEvent(null)}
      />
      <LocationMenuModal
        visible={!!menuFor}
        location={menuFor}
        onClose={() => setMenuFor(null)}
        onEdit={() => {
          setEditing(location);
          setEditOpen(true);
        }}
        onRemove={() => setRemoving(menuFor)}
      />
      <RemoveConfirmModal
        visible={!!removing}
        location={removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeLocation(removing.id);
          setRemoving(null);
          router.back();
        }}
      />
      <AddLocationModal
        visible={editOpen}
        editing={editing}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
        }}
      />
    </View>
  );
}

function distanceKmOf(location: Location, point: { lat: number; lon: number }): number {
  // Local re-implementation avoids importing the hook module's dependency
  // surface into a memo; identical haversine formula.
  const R = 6371;
  const dLat = ((point.lat - location.point.lat) * Math.PI) / 180;
  const dLon = ((point.lon - location.point.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((location.point.lat * Math.PI) / 180) *
      Math.cos((point.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function Topbar({
  onBack,
  title,
  onMenu,
}: {
  onBack: () => void;
  title: string;
  onMenu: (() => void) | null;
}) {
  return (
    <View style={styles.topbar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to locations"
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        {...webClass('lc-tap')}
      >
        <Ionicons name="chevron-back" size={18} color={mapPalette.text} />
        <Text style={styles.backText}>Locations</Text>
      </Pressable>
      <Text style={styles.sectionName}>{title}</Text>
      {onMenu ? (
        <Pressable
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel="Location options"
          style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.7 }]}
          {...webClass('lc-tap')}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={mapPalette.text} />
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

function ActivityStat({
  icon,
  label,
  value,
  color,
  small,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | string;
  color: string;
  small?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={[styles.statValue, small && styles.statValueSmall]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function TrendChip({ direction }: { direction: ReturnType<typeof trendFor>['direction'] }) {
  const meta = TREND_DIRECTION_META[direction];
  return (
    <View style={[styles.trendChip, { backgroundColor: `${meta.color}18`, borderColor: `${meta.color}40` }]}>
      <Ionicons name={meta.icon} size={12} color={meta.color} />
      <Text style={[styles.trendChipText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function TrendBars({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <View style={styles.trendBars}>
      {buckets.map((b, i) => {
        const h = Math.max(4, Math.round((b.count / max) * 52));
        const today = i === buckets.length - 1;
        return (
          <View key={i} style={styles.trendCol}>
            <Text style={[styles.trendCount, b.count === 0 && styles.trendCountZero]}>
              {b.count > 0 ? b.count : ''}
            </Text>
            <View
              style={[
                styles.trendBar,
                { height: h },
                today && { backgroundColor: COLOR.accent },
                !today && { backgroundColor: 'rgba(255,255,255,0.28)' },
              ]}
            />
            <Text style={[styles.trendDay, today && { color: COLOR.accent }]}>{b.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function EventRow({
  event,
  now,
  first,
  onPress,
}: {
  event: LocationEvent;
  now: number;
  first: boolean;
  onPress: () => void;
}) {
  const color = event.category === 'fire' ? '#ED8C49' : event.category === 'heat' ? '#E8A23C' : '#7FB8A0';
  const icon = event.category === 'fire' ? 'flame' : event.category === 'heat' ? 'thermometer-outline' : 'leaf-outline';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${event.body}`}
      style={({ pressed }) => [styles.eventRow, pressed && { opacity: 0.8 }]}
      {...webClass('lc-event')}
    >
      <View style={styles.eventRail}>
        <View style={[styles.eventLine, first && styles.eventLineTop]} />
        <View style={[styles.eventDot, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
          <Ionicons name={icon} size={13} color={color} />
        </View>
      </View>
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <Text style={styles.eventBody} numberOfLines={2}>
          {event.body}
        </Text>
        <View style={styles.eventFooter}>
          <Text style={styles.eventMeta}>
            {distanceLabel(event.distanceKm)} away · {formatDetected(event.at)}
          </Text>
          <Text style={styles.eventTime}>{relativeLabel(event.at, now)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SkeletonBars() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0.45);
  useEffect(() => {
    if (reduced) {
      p.value = 0.5;
      return;
    }
    p.value = withRepeat(withTiming(0.85, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(p);
  }, [p, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.trendBars, anim]}>
      {Array.from({ length: 7 }).map((_, i) => (
        <View key={i} style={styles.skelBarCol}>
          <View style={[styles.skelBar, { height: 20 + ((i * 7) % 30) }]} />
        </View>
      ))}
    </Animated.View>
  );
}

function SkeletonEvent() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0.45);
  useEffect(() => {
    if (reduced) {
      p.value = 0.5;
      return;
    }
    p.value = withRepeat(withTiming(0.85, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(p);
  }, [p, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.eventRow, anim]}>
      <View style={styles.skelDot} />
      <View style={styles.skelEventContent}>
        <View style={[styles.skelLine, { width: '55%', height: 13 }]} />
        <View style={[styles.skelLine, { width: '90%', height: 10, marginTop: 8 }]} />
        <View style={[styles.skelLine, { width: '64%', height: 10, marginTop: 7 }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mapPalette.oceanDeep },
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
  menuBtn: {
    width: 40,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  scroll: { paddingHorizontal: 20, paddingTop: 16, alignItems: 'center' },
  content: { width: '100%', maxWidth: 720 },
  contentCompact: { maxWidth: 560 },

  eyebrowRow: { flexDirection: 'row', alignItems: 'center' },
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
  eyebrow: { fontFamily: FONT.interSemiBold, fontSize: 10, letterSpacing: 1.4, lineHeight: 14 },
  title: {
    fontFamily: FONT.interSemiBold,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -1,
    color: COLOR.white,
    marginTop: 14,
  },
  place: { fontFamily: FONT.interRegular, fontSize: 14, color: mapPalette.textMuted, marginTop: 3 },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  stat: { flex: 1, alignItems: 'center', minWidth: 0 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { fontFamily: FONT.interSemiBold, fontSize: 19, letterSpacing: -0.4, color: COLOR.white },
  statValueSmall: { fontFamily: FONT.interSemiBold, fontSize: 13, color: COLOR.white, letterSpacing: -0.2 },
  statLabel: {
    fontFamily: FONT.interMedium,
    fontSize: 8.5,
    letterSpacing: 1,
    color: mapPalette.textFaint,
    marginTop: 4,
  },
  statDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.1)' },

  card: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(13,18,24,0.85)',
    padding: 16,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  cardTitle: { fontFamily: FONT.interSemiBold, fontSize: 14.5, letterSpacing: -0.2, color: COLOR.white },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  trendChipText: { fontFamily: FONT.interSemiBold, fontSize: 10.5, letterSpacing: 0.3 },

  trendBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 96 },
  trendCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  trendCount: { fontFamily: FONT.interMedium, fontSize: 9.5, color: mapPalette.textMuted, height: 13, marginBottom: 3 },
  trendCountZero: { color: 'transparent' },
  trendBar: { width: 10, borderRadius: 5, maxHeight: 52, minHeight: 4 },
  trendDay: { fontFamily: FONT.interMedium, fontSize: 10, color: mapPalette.textFaint, marginTop: 6 },

  mapLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 13,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(237,140,73,0.35)',
    backgroundColor: 'rgba(237,140,73,0.07)',
  },
  mapLinkText: { fontFamily: FONT.interSemiBold, fontSize: 13.5, color: COLOR.accent },

  filtersRow: { flexDirection: 'row', marginTop: 22 },
  timeFilters: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 13,
    padding: 3,
  },
  filterPress: { flex: 1, borderRadius: 10 },
  filterChip: { alignItems: 'center', paddingVertical: 7, borderRadius: 10 },
  filterChipOn: {
    backgroundColor: 'rgba(237,140,73,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(237,140,73,0.55)',
  },
  filterLabel: { fontFamily: FONT.interMedium, fontSize: 12.5, color: mapPalette.textFaint },

  catFilters: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 13,
    padding: 3,
    marginTop: 8,
  },
  catPress: { flex: 1, borderRadius: 10 },
  catChip: { alignItems: 'center', paddingVertical: 7, borderRadius: 10 },
  catChipOn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  catLabel: { fontFamily: FONT.interMedium, fontSize: 12.5, color: mapPalette.textFaint },

  sectionTitle: {
    fontFamily: FONT.interSemiBold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: COLOR.white,
    marginTop: 26,
    marginBottom: 4,
  },

  timeline: { marginTop: 10 },
  eventRow: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderRadius: 14, paddingHorizontal: 4 },
  eventRail: { width: 32, alignItems: 'center' },
  eventLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  eventLineTop: { top: 26 },
  eventDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  eventContent: { flex: 1, minWidth: 0, paddingBottom: 6 },
  eventTitle: { fontFamily: FONT.interSemiBold, fontSize: 14.5, color: COLOR.white, letterSpacing: -0.2 },
  eventBody: { fontFamily: FONT.interRegular, fontSize: 12.5, lineHeight: 18, color: mapPalette.textMuted, marginTop: 2 },
  eventFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  eventMeta: { fontFamily: FONT.interRegular, fontSize: 11.5, color: mapPalette.textFaint },
  eventTime: { fontFamily: FONT.interMedium, fontSize: 11, color: mapPalette.textFaint, marginLeft: 'auto' },

  quietState: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 20 },
  quietIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: 14,
  },
  quietTitle: { fontFamily: FONT.interSemiBold, fontSize: 16, color: COLOR.white },
  quietBody: {
    fontFamily: FONT.interRegular,
    fontSize: 13,
    lineHeight: 19,
    color: mapPalette.textMuted,
    textAlign: 'center',
    marginTop: 5,
    maxWidth: 320,
  },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rankRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  rankNum: { fontFamily: FONT.interSemiBold, fontSize: 12, color: mapPalette.textFaint, width: 20 },
  rankText: { flex: 1, minWidth: 0 },
  rankName: { fontFamily: FONT.interMedium, fontSize: 13.5, color: COLOR.white },
  rankBar: { height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 5 },
  rankFill: { height: 3, borderRadius: 1.5 },
  rankScore: { fontFamily: FONT.interSemiBold, fontSize: 14, color: COLOR.white, width: 30, textAlign: 'right' },
  rankDist: { fontFamily: FONT.interRegular, fontSize: 11.5, color: mapPalette.textFaint, width: 56, textAlign: 'right' },

  skelBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  skelBar: { width: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.08)' },
  skelDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', marginTop: 2 },
  skelEventContent: { flex: 1, paddingVertical: 4 },
  skelLine: { borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' },

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