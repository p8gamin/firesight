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
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAlerts, useActivityGroups } from '../hooks/useData';
import { requestMapFocus } from '../map/focusRequest';
import { mapPalette } from '../map/tokens';
import { webClass, isWeb } from '../design/platform';
import { BP_MD, COLOR, FONT } from '../design/constants';
import { useDesignStyles } from '../design/designCss';
import NavCapsule from '../design/NavCapsule';
import ShinyBrand from '../design/ShinyBrand';
import { useAlertStyles } from './alertCss';
import { AlertCard } from './AlertCard';
import { ALERT_FILTERS, type AlertFilter } from './model';
import type { ActivityGroup, Alert } from '../types';

const NAV_ROUTE: Record<string, string | null> = {
  Home: '/',
  Map: '/map',
  Alerts: '/alerts',
  Locations: '/locations',
  About: '/about',
};

/**
 * The Alerts screen — FireSight's attention centre. Answers "what needs my
 * attention?": severity-labelled alert cards with a compact filter row
 * (All / Fire / Heat / Air Quality), inline expandable detail, and a direct
 * "View on Map" hop into the existing Map screen. Every value on screen
 * derives from the data layer (src/hooks/useData) — nothing is fabricated.
 */
export default function AlertsScreen() {
  useAlertStyles();
  useDesignStyles(); // the floating capsule + shiny brand rely on this CSS
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const { alerts, loading, error, hasLocations, markRead, markAllRead, retry } = useAlerts();
  const { data: groups } = useActivityGroups();

  const [filter, setFilter] = useState<AlertFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const groupOf = useMemo(() => {
    const m: Record<string, ActivityGroup> = {};
    for (const g of groups) m[g.id] = g;
    return m;
  }, [groups]);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  const filtered = useMemo(
    () => (filter === 'all' ? alerts : alerts.filter((a) => a.category === filter)),
    [alerts, filter]
  );

  const navTo = useCallback(
    (label: string) => {
      const route = NAV_ROUTE[label];
      if (route) router.dismissTo(route as never);
    },
    [router]
  );

  const toggleAlert = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id));
      markRead(id);
    },
    [markRead]
  );

  const viewOnMap = useCallback(
    (alert: Alert) => {
      // Centre the existing Map screen on the activity; the map consumes
      // this request on focus (works for fresh pushes and pop-backs alike).
      if (alert.point) requestMapFocus({ point: alert.point, label: alert.locationName });
      router.dismissTo('/map');
    },
    [router]
  );

  const openDetails = useCallback(
    (id: string) => {
      markRead(id);
      router.push(`/alert/${id}` as never);
    },
    [markRead, router]
  );

  const isMd = width >= BP_MD;
  const compact = width < 420;

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
          {/* ============================== header ========================== */}
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Alerts</Text>
              </View>
              <Text style={styles.subtitle}>Stay informed about activity that matters.</Text>
            </View>
            {unreadCount > 0 ? (
              <Pressable
                onPress={markAllRead}
                accessibilityRole="button"
                accessibilityLabel="Mark all alerts as read"
                style={({ pressed }) => [styles.markAll, pressed && { opacity: 0.6 }]}
                {...webClass('al-tap')}
              >
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            ) : null}
          </View>

          {/* ============================== filters ========================= */}
          <View style={styles.filters} {...webClass('al-blur')}>
            {ALERT_FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    setFilter(f.id);
                    setExpandedId(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Filter alerts — ${f.label}`}
                  style={({ pressed }) => [styles.filterPress, pressed && { transform: [{ scale: 0.96 }] }]}
                  {...webClass('al-tap')}
                >
                  <View style={[styles.filterChip, active && styles.filterChipOn]}>
                    <Ionicons
                      name={f.icon}
                      size={13}
                      color={active ? '#fff' : mapPalette.textFaint}
                    />
                    <Text style={[styles.filterLabel, active && { color: '#fff' }]}>{f.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ============================== body ============================ */}
          {loading ? (
            <View style={styles.list}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : error ? (
            <CenterState
              icon="alert-circle-outline"
              iconColor={COLOR.accent}
              title="Alerts unavailable"
              body="Check your connection and try again."
              actionLabel="Try again"
              onAction={retry}
            />
          ) : filtered.length === 0 ? (
            <CenterState
              icon={hasLocations ? 'checkmark-circle-outline' : 'location-outline'}
              iconColor={hasLocations ? '#5E8B77' : '#3FB68B'}
              title={hasLocations ? 'No significant activity' : 'No locations monitored yet'}
              body={
                hasLocations
                  ? 'FireSight will show relevant activity here as it develops.'
                  : 'Save a location to start watching for heat anomalies around the places that matter to you.'
              }
              actionLabel={hasLocations ? 'View the map' : '+ Add a location'}
              onAction={() =>
                hasLocations ? router.dismissTo('/map') : router.dismissTo('/locations')
              }
            />
          ) : (
            <View style={styles.list} key={filter}>
              {filtered.map((alert, i) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  group={alert.groupId ? groupOf[alert.groupId] : undefined}
                  index={i}
                  expanded={expandedId === alert.id}
                  onToggle={() => toggleAlert(alert.id)}
                  onViewMap={() => viewOnMap(alert)}
                  onDetails={() => openDetails(alert.id)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ============================ floating chrome ======================= */}
      {/* Brand + nav capsule float above the scroll — same positions as the
          hero and map screens (brand hidden below md, matching the hero). */}
      <View
        style={[
          styles.chrome,
          {
            paddingTop: isWeb ? (width < BP_MD ? 84 : 24) : insets.top + 24,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.chromeInner} pointerEvents="box-none">
          {!isWeb || isMd ? (
            <View style={styles.brandRow} pointerEvents="box-none">
              <ShinyBrand />
            </View>
          ) : null}
          <NavCapsule active="Alerts" onNavigate={navTo} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SkeletonCard() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0.45);
  useEffect(() => {
    if (reduced) {
      p.value = 0.5;
      return;
    }
    p.value = withRepeat(
      withTiming(0.85, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => cancelAnimation(p);
  }, [p, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: p.value }));

  return (
    <Animated.View style={[styles.skelCard, anim]}>
      <View style={styles.skelRow}>
        <View style={styles.skelRail} />
        <View style={styles.skelCol}>
          <View style={[styles.skelLine, { width: '38%', height: 10 }]} />
          <View style={[styles.skelLine, { width: '78%', height: 16, marginTop: 9 }]} />
          <View style={[styles.skelLine, { width: '100%', height: 11, marginTop: 9 }]} />
          <View style={[styles.skelLine, { width: '52%', height: 11, marginTop: 7 }]} />
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

function CenterState({
  icon,
  iconColor,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.stateWrap}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={27} color={iconColor} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.stateBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          {...webClass('al-tap')}
        >
          <Text style={styles.stateBtnText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={15} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mapPalette.oceanDeep },

  scroll: { paddingHorizontal: 20, alignItems: 'center' },
  content: { width: '100%', maxWidth: 720 },
  contentCompact: { maxWidth: 560 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 22,
  },
  headerText: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  markAll: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  markAllText: { fontFamily: FONT.interMedium, fontSize: 13, color: mapPalette.textMuted },

  filters: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 14,
    padding: 3,
    marginBottom: 20,
  },
  filterPress: { flex: 1, borderRadius: 11 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 11,
  },
  filterChipOn: {
    backgroundColor: 'rgba(237,140,73,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(237,140,73,0.55)',
  },
  filterLabel: {
    fontFamily: FONT.interMedium,
    fontSize: 13,
    lineHeight: 17,
    color: mapPalette.textFaint,
  },

  list: { gap: 12 },

  skelCard: {
    backgroundColor: '#0D1218',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    padding: 14,
  },
  skelRow: { flexDirection: 'row', gap: 13 },
  skelRail: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  skelCol: { flex: 1 },
  skelLine: { borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' },

  stateWrap: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 24,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: 18,
  },
  stateTitle: {
    fontFamily: FONT.interSemiBold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.3,
    color: COLOR.white,
    textAlign: 'center',
  },
  stateBody: {
    fontFamily: FONT.interRegular,
    fontSize: 14,
    lineHeight: 21,
    color: mapPalette.textMuted,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
  stateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLOR.accent,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 22,
  },
  stateBtnText: { fontFamily: FONT.interSemiBold, fontSize: 14, color: '#fff' },

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