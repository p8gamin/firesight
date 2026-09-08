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

import { useActivityGroups, useAirEvents } from '../hooks/useData';
import { mapPalette } from '../map/tokens';
import { webClass, isWeb } from '../design/platform';
import { BP_MD, COLOR, FONT } from '../design/constants';
import { useDesignStyles } from '../design/designCss';
import { useLocationStyles } from './locationCss';
import NavCapsule from '../design/NavCapsule';
import ShinyBrand from '../design/ShinyBrand';
import { useLocationsStore, removeLocation } from './store';
import { locationSummary } from './model';
import { LocationCard } from './LocationCard';
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
 * The Locations screen — \"Your places. Their activity.\"
 *
 * Saved locations as premium cards (custom name, place, activity level and a
 * nearby-activity read-out all derived from the data layer), an Add Location
 * flow (search / current location → map confirm → name → monitoring → radius
 * → alerts → review), per-location management (edit, rename, settings,
 * remove), and a tap through to each location's personalized activity view.
 */
export default function LocationsScreen() {
  useLocationStyles();
  useDesignStyles(); // floating capsule + shiny brand rely on this CSS
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();

  const { locations, loading } = useLocationsStore();
  const { data: groups } = useActivityGroups();
  const { data: airEvents } = useAirEvents();
  // Local records can't fail today; the branch is a real UI path for when
  // the backend fetch lands.
  const [error] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [menuFor, setMenuFor] = useState<Location | null>(null);
  const [removing, setRemoving] = useState<Location | null>(null);

  const summaries = useMemo(() => {
    const m: Record<string, ReturnType<typeof locationSummary>> = {};
    for (const l of locations) m[l.id] = locationSummary(l, groups, airEvents);
    return m;
  }, [locations, groups, airEvents]);

  const navTo = useCallback(
    (label: string) => {
      const route = NAV_ROUTE[label];
      if (route) router.dismissTo(route as never);
    },
    [router]
  );

  const openAdd = useCallback(() => {
    setEditing(null);
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((loc: Location) => {
    setEditing(loc);
    setAddOpen(true);
  }, []);

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
                <Text style={styles.title}>Locations</Text>
              </View>
              <Text style={styles.subtitle}>Monitor the places that matter to you.</Text>
            </View>
            <Pressable
              onPress={openAdd}
              accessibilityRole="button"
              accessibilityLabel="Add a location"
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: COLOR.accent },
                pressed && { backgroundColor: '#d2611f', transform: [{ scale: 0.98 }] },
              ]}
              {...webClass('lc-tap')}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Add Location</Text>
            </Pressable>
          </View>

          {/* ============================== body ============================ */}
          {loading ? (
            <View style={styles.list}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : error ? (
            <CenterState
              icon="alert-circle-outline"
              iconColor={COLOR.accent}
              title="Locations unavailable"
              body="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => {}}
            />
          ) : locations.length === 0 ? (
            <CenterState
              icon="location-outline"
              iconColor="#5E8B77"
              title="Monitor a place that matters"
              body="Add a location to see wildfire activity, heat anomalies, and air quality around it."
              actionLabel="+ Add Location"
              onAction={openAdd}
            />
          ) : (
            <View style={styles.list}>
              {locations.map((loc, i) => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  summary={summaries[loc.id] ?? locationSummary(loc, groups, airEvents)}
                  index={i}
                  onOpen={() => router.push(`/location/${loc.id}` as never)}
                  onMenu={() => setMenuFor(loc)}
                />
              ))}
            </View>
          )}
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
          <NavCapsule active="Locations" onNavigate={navTo} />
        </View>
      </View>

      {/* ================================ modals ============================ */}
      <AddLocationModal
        visible={addOpen}
        editing={editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
      />
      <LocationMenuModal
        visible={!!menuFor}
        location={menuFor}
        onClose={() => setMenuFor(null)}
        onEdit={() => menuFor && openEdit(menuFor)}
        onRemove={() => setRemoving(menuFor)}
      />
      <RemoveConfirmModal
        visible={!!removing}
        location={removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeLocation(removing.id);
          setRemoving(null);
        }}
      />
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
          <View style={[styles.skelLine, { width: '30%', height: 10 }]} />
          <View style={[styles.skelLine, { width: '62%', height: 16, marginTop: 9 }]} />
          <View style={[styles.skelLine, { width: '44%', height: 11, marginTop: 9 }]} />
          <View style={[styles.skelLine, { width: '80%', height: 11, marginTop: 7 }]} />
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
            { backgroundColor: COLOR.accent },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          {...webClass('lc-tap')}
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  addBtnText: { fontFamily: FONT.interSemiBold, fontSize: 13.5, color: '#fff' },

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