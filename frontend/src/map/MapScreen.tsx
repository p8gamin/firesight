import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';

import MapSurface from './MapSurface';
import type { MapSurfaceHandle } from './mapSurfaceTypes';
import {
  fireSeverity,
  severityPalette,
  severityText,
  LAYERS,
  mapPalette,
  type MapLayerId,
} from './tokens';
import { WORLD_PX } from './geo';
import { useMapStyles } from './mapCss';
import { useDesignStyles } from '../design/designCss';
import { useMapData, formatDetected } from './data';
import { searchPlaces, type Place } from './gazetteer';
import { Chip } from './ui/Chip';
import { IconButton } from './ui/IconButton';
import { webClass, isWeb } from '../design/platform';
import { COLOR, FONT, BP_MD } from '../design/constants';
import NavCapsule from '../design/NavCapsule';
import ShinyBrand from '../design/ShinyBrand';
import { distanceKm, relativeTime } from '../hooks/useData';
import { consumeMapFocus } from './focusRequest';
import { resolveDeviceCoords } from '../services/location';
import { useLocationsStore } from '../locations/store';
import type { GeoPoint, Location, MapFire } from '../types';

const NAV_ROUTE: Record<string, string | null> = {
  Home: '/',
  Map: '/map',
  Alerts: '/alerts',
  Locations: '/locations',
  About: '/about',
};

/** FireSight locate framing: ~90 px per degree of longitude (plane scale). */
const LOCATE_SCALE = (90 * 360) / WORLD_PX;

/**
 * Neutral view centre used ONLY while the user has no saved locations — it is
 * a camera default, never presented as data. Nothing is resolved or plotted
 * on first open: the teal user dot appears only after the user taps the
 * locate button.
 */
const IDLE_VIEW_CENTER: GeoPoint = { lat: 45, lon: -100 };

export default function MapScreen() {
  useMapStyles();
  useDesignStyles(); // capsule + shiny-brand CSS (deep-linked /map never mounts the hero)
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const surface = useRef<MapSurfaceHandle | null>(null);

  const {
    fires,
    heatRegions,
    perimeters,
    loading: dataLoading,
    error: dataError,
    refresh: refreshData,
  } = useMapData();
  // Saved locations — the app's locations store (user-created included).
  const { locations } = useLocationsStore();
  // The user's primary monitoring location: heat data is requested around it.
  const primaryLocation = locations[0] ?? null;

  const [layers, setLayers] = useState<Record<MapLayerId, boolean>>(() => {
    const init = {} as Record<MapLayerId, boolean>;
    for (const l of LAYERS) init[l.id] = l.defaultOn;
    return init;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  // The saved location distances are measured from. Distinct from the card
  // selection: tapping a fire marker closes the location card but keeps this
  // reference, so the fire's distance is measured from the last location the
  // user picked. Falls back to the primary saved location.
  const [referenceLocId, setReferenceLocId] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<GeoPoint | null>(null);
  const [centerGeo, setCenterGeo] = useState<GeoPoint | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const showStatus = useCallback((msg: string) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(msg);
    statusTimer.current = setTimeout(() => setStatus(null), 3400);
  }, []);

  const dismissSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedLocId(null);
  }, []);

  // Dragging/pinching the map drops transient chrome + any selection card.
  const onInteract = useCallback(() => {
    setSearchOpen(false);
    setFiltersOpen(false);
    dismissSelection();
  }, [dismissSelection]);

  const selectLocation = useCallback((id: string) => {
    setFiltersOpen(false);
    setSearchOpen(false);
    setSelectedId(null);
    setSelectedLocId(id);
    setReferenceLocId(id);
  }, []);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocId) ?? null,
    [locations, selectedLocId]
  );

  const onCenterChange = useCallback((c: GeoPoint) => setCenterGeo(c), []);

  // --- Distance reference point ---------------------------------------------
  // Distances are measured from a real saved location — never the map view
  // centre or viewport geometry. The reference is the last saved location the
  // user selected on the map (if it still exists), otherwise the primary
  // saved location (the first one — the same point the heat data is requested
  // around). Never a hardcoded coordinate: when the user changes the selected
  // location, the distance follows that location's stored coordinates.
  const referenceLocation = useMemo(
    () => locations.find((l) => l.id === referenceLocId) ?? locations[0] ?? null,
    [locations, referenceLocId]
  );
  const referenceName = referenceLocation?.name ?? null;
  const referencePoint = referenceLocation?.point ?? null;

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    []
  );

  // --- Data visible under the current layer toggles -------------------------
  const visibleFires = useMemo(() => {
    if (!layers.fires) return [];
    return layers.highConcern ? fires.filter((f) => fireSeverity(f) === 'high') : fires;
  }, [fires, layers.fires, layers.highConcern]);

  const visiblePerimeters = useMemo(
    () => (layers.perimeters ? perimeters : []),
    [perimeters, layers.perimeters]
  );

  const selectedFire = useMemo(
    () => visibleFires.find((f) => f.id === selectedId) ?? null,
    [visibleFires, selectedId]
  );
  useEffect(() => {
    if (selectedId && !selectedFire) setSelectedId(null);
  }, [selectedFire, selectedId]);

  // Distance readout = haversine from the reference saved location to the
  // fire's actual coordinates. Recomputes when the user selects a different
  // saved location.
  const distKm = useMemo(
    () =>
      selectedFire && referencePoint
        ? distanceKm(referencePoint, selectedFire.point)
        : null,
    [referencePoint, selectedFire]
  );

  const selectFire = useCallback((id: string) => {
    setFiltersOpen(false);
    setSearchOpen(false);
    setSelectedLocId(null);
    setSelectedId(id);
  }, []);

  // Another screen (Alerts) asked us to focus on a fire / location — consume
  // the request when this screen gains focus, whether we're freshly pushed or
  // already mounted in the stack.
  useFocusEffect(
    useCallback(() => {
      const focus = consumeMapFocus();
      if (!focus) return;
      if (focus.fireId) {
        const fire = fires.find((f) => f.id === focus.fireId);
        if (fire) {
          selectFire(fire.id);
          surface.current?.flyTo(fire.point, { scale: LOCATE_SCALE });
        }
      } else if (focus.point) {
        surface.current?.flyTo(focus.point, { scale: (70 * 360) / WORLD_PX });
      }
    }, [fires, selectFire])
  );

  // Where the map centres: the user's primary saved location (their
  // monitoring home), else the neutral view. No device location is resolved
  // on mount, so first open always starts with zero plotted points.
  const initialCenter = primaryLocation?.point ?? IDLE_VIEW_CENTER;
  const autoCenter = primaryLocation != null;

  const counts = useMemo(
    () => ({
      fires: visibleFires.length,
      high: fires.filter((f) => fireSeverity(f) === 'high').length,
      heat: heatRegions.length,
    }),
    [visibleFires, fires, heatRegions]
  );

  // --- Search ---------------------------------------------------------------
  const results = useMemo(() => searchPlaces(query), [query]);

  const flyToPlace = useCallback(
    (place: Place) => {
      setQuery('');
      setSearchOpen(false);
      setFiltersOpen(false);
      const pxPerDeg = place.kind === 'city' ? 85 : place.kind === 'region' ? 36 : 22;
      surface.current?.flyTo(
        { lat: place.lat, lon: place.lon },
        { scale: (pxPerDeg * 360) / WORLD_PX }
      );
    },
    []
  );

  // --- Locate ---------------------------------------------------------------
  const locateMe = useCallback(async () => {
    showStatus('Locating…');
    try {
      const coords = await resolveDeviceCoords();
      setUserPos({ lat: coords.lat, lon: coords.lon });
      surface.current?.flyTo(
        { lat: coords.lat, lon: coords.lon },
        { scale: LOCATE_SCALE }
      );
      showStatus('Centered on your location');
    } catch {
      showStatus('Location unavailable. Allow location access to centre the map.');
    }
  }, [showStatus]);

  const compact = width < 420;

  // The status pill doubles as the live-data loading/error banner: while the
  // backend request is in flight it shows a spinner, and on failure it stays
  // up and retries on tap. When the user has no saved locations the store is
  // idle — no banner, the get-started card speaks instead.
  const toastBanner: { text: string; spinner: boolean; retry: boolean } | null =
    dataError
      ? { text: 'Live heat data unavailable — tap to retry', spinner: false, retry: true }
      : dataLoading
        ? { text: 'Loading live heat data…', spinner: true, retry: false }
        : status
          ? { text: status, spinner: status === 'Locating…', retry: false }
          : null;

  return (
    <View style={styles.root}>
      {/* ========================================================== map ==== */}
      <MapSurface
        ref={surface}
        fires={visibleFires}
        heatRegions={heatRegions}
        perimeters={visiblePerimeters}
        layers={layers}
        selectedFireId={selectedFire?.id ?? null}
        locations={locations}
        selectedLocationId={selectedLocation?.id ?? null}
        userPos={userPos}
        initialCenter={initialCenter}
        autoCenter={autoCenter}
        onSelectFire={selectFire}
        onSelectLocation={selectLocation}
        onDismiss={dismissSelection}
        onInteract={onInteract}
        onCenterChange={onCenterChange}
      />

      {/* ==================================================== top chrome ==== */}
      <View
        style={[
          styles.chrome,
          // Match the hero nav brand's position exactly (web: fixed at 24/20
          // so the brand, navbar and Get Started CTA all sit on the same
          // level; native: insets.top + 24). Below md the hero hides its
          // brand so the centered capsule has room; on phones the top padding
          // instead clears the floating capsule.
          {
            paddingTop: isWeb
              ? width < BP_MD
                ? 84
                : 24
              : insets.top + 24,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.chromeInner} pointerEvents="box-none">
          {/* brand — hidden below md on web, exactly like the hero's brand
           * (the hero hides it so the centered capsule never collides). */}
          {!isWeb || width >= BP_MD ? (
            <View style={styles.brandRow} pointerEvents="box-none">
              {/* The FireSight brand — logo + wordmark inside a shiny pill
               * button (web: animated conic shine; native: glass pill). */}
              <ShinyBrand />
            </View>
          ) : null}

          {/* nav capsule — the exact same floating frosted pill as the hero
           * page (shared NavCapsule component), “Map” active. */}
          <NavCapsule
            active="Map"
            onNavigate={(label) => {
              const route = NAV_ROUTE[label];
              if (route) router.dismissTo(route as never);
            }}
          />

          {/* search */}
          <View style={styles.searchCol} pointerEvents="box-none">
            <View style={styles.searchUnit} {...webClass('cm-blur')}>
              <Ionicons name="search" size={17} color={mapPalette.textFaint} />
              <TextInput
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  setSearchOpen(true);
                }}
                onFocus={() => {
                  setSearchOpen(true);
                  setFiltersOpen(false);
                }}
                placeholder="Search a location"
                placeholderTextColor={mapPalette.textFaint}
                style={styles.searchInput}
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (results[0]) flyToPlace(results[0]);
                }}
                accessibilityLabel="Search a location"
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setQuery('');
                    setSearchOpen(false);
                  }}
                  hitSlop={10}
                  accessibilityLabel="Clear search"
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="close-circle" size={18} color={mapPalette.textFaint} />
                </Pressable>
              ) : null}
              <View style={styles.searchDivider} />
              <Pressable
                onPress={() => {
                  setFiltersOpen((v) => !v);
                  setSearchOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: filtersOpen }}
                accessibilityLabel="Map layers and filters"
                style={({ pressed }) => [
                  styles.layersBtn,
                  pressed && { opacity: 0.7 },
                  filtersOpen && styles.layersBtnOn,
                ]}
              >
                <Ionicons
                  name={filtersOpen ? 'options' : 'layers-outline'}
                  size={17}
                  color={filtersOpen ? COLOR.accent : mapPalette.textMuted}
                />
              </Pressable>
            </View>

            {/* dropdowns anchored below the search bar */}
            <View style={styles.dropAnchor} pointerEvents="box-none">
              {searchOpen && results.length > 0 ? (
                <View style={styles.resultsPanel} {...webClass('cm-blur')}>
                  {results.map((r, i) => (
                    <Pressable
                      key={r.id}
                      onPress={() => flyToPlace(r)}
                      style={({ pressed }) => [
                        styles.resultRow,
                        i > 0 && styles.resultRowBorder,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View style={styles.resultIcon}>
                        <Ionicons
                          name={r.kind === 'city' ? 'location' : r.kind === 'country' ? 'earth' : 'map'}
                          size={14}
                          color={r.kind === 'country' ? mapPalette.textMuted : COLOR.accent}
                        />
                      </View>
                      <View style={styles.resultText}>
                        <Text style={styles.resultName}>{r.name}</Text>
                        {r.area ? <Text style={styles.resultArea}>{r.area}</Text> : null}
                      </View>
                      <Ionicons name="arrow-forward" size={13} color={mapPalette.textFaint} />
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {filtersOpen ? (
                <View style={styles.filtersPanel} {...webClass('cm-blur')}>
                  <Text style={styles.filtersTitle}>Overlays</Text>
                  <View style={styles.filtersGrid}>
                    {LAYERS.map((l) => (
                      <Chip
                        key={l.id}
                        label={l.label}
                        icon={l.icon}
                        on={layers[l.id]}
                        onPress={() =>
                          setLayers((prev) => ({ ...prev, [l.id]: !prev[l.id] }))
                        }
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {toastBanner ? (
                <View style={styles.toast} pointerEvents={toastBanner.retry ? 'auto' : 'none'}>
                  <Pressable
                    onPress={toastBanner.retry ? refreshData : undefined}
                    style={({ pressed }) => [
                      styles.toastInner,
                      toastBanner.retry && pressed && { opacity: 0.7 },
                    ]}
                    {...webClass('cm-blur')}
                    accessibilityRole={toastBanner.retry ? 'button' : undefined}
                    accessibilityLabel={toastBanner.retry ? 'Retry loading heat data' : undefined}
                  >
                    {toastBanner.spinner ? (
                      <ActivityIndicator size="small" color={mapPalette.textMuted} />
                    ) : (
                      <Ionicons
                        name={toastBanner.retry ? 'cloud-offline-outline' : 'information-circle-outline'}
                        size={15}
                        color={mapPalette.textMuted}
                      />
                    )}
                    <Text style={styles.toastText}>{toastBanner.text}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {/* ==================================================== controls ====== */}
      {/* On narrow screens an open fire card fills the bottom third; tuck the
          control cluster above it so nothing overlaps the card's corner. */}
      <View
        style={[
          styles.controls,
          {
            right: compact ? 12 : 16,
            top:
              (selectedFire || selectedLocation) && compact
                ? Math.max(insets.top + 196, height * 0.2)
                : height * 0.46,
          },
        ]}
        pointerEvents="box-none"
      >
        <IconButton
          icon="add"
          label="Zoom in"
          onPress={() => surface.current?.zoomBy(1.7)}
        />
        <View style={styles.controlGap} />
        <IconButton
          icon="remove"
          label="Zoom out"
          onPress={() => surface.current?.zoomBy(1 / 1.7)}
        />
        <View style={styles.controlDivider} />
        <IconButton icon="locate" label="Center on your location" onPress={locateMe} />
        <View style={styles.controlDivider} />
        <IconButton
          icon="scan-outline"
          label="Frame North America"
          dim
          onPress={() => surface.current?.fitNorthAmerica()}
        />
      </View>

      {/* ============================================ bottom summary / card == */}
      <View
        style={[styles.bottomArea, { paddingBottom: insets.bottom + 8 }]}
        pointerEvents="box-none"
      >
        {selectedFire ? (
          <FireCard
            fire={selectedFire}
            distKm={distKm}
            distanceLabel={referenceName ? `from ${referenceName}` : null}
            onClose={dismissSelection}
            onView={() => router.push(`/fire/${selectedFire.id}` as never)}
            width={Math.min(width - (compact ? 24 : 48), 560)}
          />
        ) : selectedLocation ? (
          <LocationCard
            location={selectedLocation}
            distKm={
              centerGeo ? Math.round(distanceKm(centerGeo, selectedLocation.point)) : null
            }
            onClose={dismissSelection}
            onView={() => router.push(`/location/${selectedLocation.id}` as never)}
            width={Math.min(width - (compact ? 24 : 48), 560)}
          />
        ) : locations.length === 0 ? (
          <GetStartedCard
            width={Math.min(width - (compact ? 24 : 48), 560)}
            onCreate={() => router.push('/locations' as never)}
          />
        ) : (
          <SummaryBar counts={counts} />
        )}
      </View>

      {/* attribution */}
      <View style={[styles.attribution, { bottom: insets.bottom + 6 }]} pointerEvents="none">
        <Text style={styles.attributionText}>
          {isWeb ? 'Basemap · OpenStreetMap contributors' : 'Basemap · Google / Apple Maps'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bottom bar + fire card
// ---------------------------------------------------------------------------

function SummaryBar({ counts }: { counts: { fires: number; high: number; heat: number } }) {
  const metrics = [
    { label: 'ACTIVE HEAT GROUPINGS', value: counts.fires },
    { label: 'HIGH CONCERN', value: counts.high, accent: counts.high > 0 },
    { label: 'HEAT ANOMALIES', value: counts.heat },
  ];
  return (
    <View style={styles.summary} {...webClass('cm-blur')}>
      <View style={styles.metricsRow}>
        {metrics.map((m, i) => (
          <React.Fragment key={m.label}>
            {i > 0 ? <View style={styles.metricDivider} /> : null}
            <View style={styles.metric}>
              <Text style={[styles.metricValue, m.accent && { color: COLOR.accent }]}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function ConcernMark({ score, color }: { score: number; color: string }) {
  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const DUR = 700;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / DUR);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(score * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  return (
    <View style={styles.concernWrap}>
      <Svg width={76} height={76}>
        <Circle
          cx={38}
          cy={38}
          r={R}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={5}
          fill="none"
        />
        <Circle
          cx={38}
          cy={38}
          r={R}
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={CIRC * (1 - shown / 100)}
          transform="rotate(-90 38 38)"
          opacity={0.9}
        />
      </Svg>
      <View style={styles.concernCenter}>
        <Text style={styles.concernValue}>{shown}</Text>
      </View>
    </View>
  );
}

/** "8.2" / "120" — one decimal below 100 km, whole km above. */
function formatDistanceKm(km: number): string {
  return km >= 100 ? `${Math.round(km)}` : km.toFixed(1);
}

function FireCard({
  fire,
  distKm,
  distanceLabel,
  onClose,
  onView,
  width,
}: {
  fire: MapFire;
  distKm: number | null;
  /** e.g. "from Home" — names the location the distance is measured from. */
  distanceLabel: string | null;
  onClose: () => void;
  onView: () => void;
  width: number;
}) {
  const category = fireSeverity(fire);
  const categoryColor = severityPalette[category];
  const confidenceLabel = fire.confidence
    ? fire.confidence.charAt(0).toUpperCase() + fire.confidence.slice(1)
    : null;
  // Satellite detections are heat activity — only a WFIGS incident match
  // confirms an actual wildfire.
  const isConfirmedWildfire = fire.hasWfigsReport === true;
  const detections = `${fire.detections} satellite detection${fire.detections === 1 ? '' : 's'}`;
  return (
    <Animated.View
      entering={cardEnter}
      style={[styles.card, { width }]}
      {...webClass('cm-fire-card')}
    >
      <View style={styles.cardHeader}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>
            {isConfirmedWildfire ? 'WILDFIRE' : 'HEAT ANOMALY'}
          </Text>
          <View style={[styles.categoryTag, { backgroundColor: `${categoryColor}26` }]}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {severityText[category]}
            </Text>
          </View>
          <Text style={styles.sourceRow}>· {fire.satellites.slice(0, 2).join(' / ')}</Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close fire details"
          style={({ pressed }) => [styles.cardClose, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={18} color={mapPalette.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.cardRegion}>{fire.region}</Text>
      <Text style={styles.cardSub}>
        {fire.name} · {detections}
        {!isConfirmedWildfire ? ' · not yet confirmed as a wildfire' : ''}
      </Text>

      <View style={styles.cardBody}>
        <ConcernMark score={fire.concern} color={categoryColor} />
        <View style={styles.cardMetrics}>
          <View style={styles.cardMetric}>
            <Text style={styles.cardMetricLabel}>DETECTED</Text>
            <Text style={styles.cardMetricValue}>{formatDetected(fire.detectedAt)}</Text>
          </View>
          <View style={styles.cardMetricRow}>
            <View style={styles.cardMetricHalf}>
              <Text style={styles.cardMetricLabel}>DISTANCE</Text>
              <Text style={styles.cardMetricValue}>
                {distKm === null ? '—' : `${formatDistanceKm(distKm)}`}
                <Text style={styles.cardMetricUnit}> km {distanceLabel ?? ''}</Text>
              </Text>
            </View>
            <View style={styles.cardMetricHalf}>
              <Text style={styles.cardMetricLabel}>UPDATED</Text>
              <Text style={styles.cardMetricValue}>{relativeTime(fire.detectedAt)}</Text>
            </View>
          </View>
          {confidenceLabel ? (
            <View style={styles.cardMetricRow}>
              <View style={styles.cardMetricHalf}>
                <Text style={styles.cardMetricLabel}>CONFIDENCE</Text>
                <Text style={styles.cardMetricValue}>{confidenceLabel}</Text>
              </View>
              <View style={styles.cardMetricHalf} />
            </View>
          ) : null}
          <View style={styles.cardMetricRow}>
            <View style={styles.cardMetricHalf}>
              <Text style={styles.cardMetricLabel}>LAT</Text>
              <Text style={styles.cardMetricValue}>
                {Math.abs(fire.point.lat).toFixed(4)}°{fire.point.lat >= 0 ? 'N' : 'S'}
              </Text>
            </View>
            <View style={styles.cardMetricHalf}>
              <Text style={styles.cardMetricLabel}>LON</Text>
              <Text style={styles.cardMetricValue}>
                {Math.abs(fire.point.lon).toFixed(4)}°{fire.point.lon >= 0 ? 'E' : 'W'}
              </Text>
            </View>
          </View>
          <View style={styles.conditionRow}>
            {fire.weather ? (
              <View style={styles.conditionChip}>
                <Ionicons name="partly-sunny-outline" size={12} color="#A8C9DA" />
                <Text style={styles.conditionText}>
                  {fire.weather.tempC != null ? `${Math.round(fire.weather.tempC)}° · ` : ''}
                  {fire.weather.windDir} {Math.round(fire.weather.windKmh)}
                </Text>
              </View>
            ) : null}
            {fire.air ? (
              <View style={styles.conditionChip}>
                <Ionicons name="leaf-outline" size={12} color="#8FCEB0" />
                <Text style={styles.conditionText}>AQI {fire.air.aqi}</Text>
              </View>
            ) : null}
            <View style={styles.conditionChip}>
              <Ionicons name="flame-outline" size={12} color={COLOR.accent} />
              <Text style={styles.conditionText}>{fire.frpMw.toFixed(1)} MW</Text>
            </View>
          </View>
        </View>
      </View>

      <Pressable
        onPress={onView}
        accessibilityRole="button"
        accessibilityLabel={`View ${isConfirmedWildfire ? 'wildfire' : 'heat activity'} — ${fire.region}`}
        style={({ pressed }) => [
          styles.viewBtn,
          { backgroundColor: COLOR.accent },
          pressed && { backgroundColor: COLOR.accentHover, transform: [{ scale: 0.985 }] },
        ]}
      >
        <Text style={styles.viewBtnText}>
          {isConfirmedWildfire ? 'View Wildfire' : 'View Heat Activity'}
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

const cardEnter = FadeInDown.duration(340).springify().damping(21).stiffness(240);

/**
 * Shown on the map while the user has no saved locations: no data is
 * requested and nothing is plotted — the get-started prompt takes over.
 */
function GetStartedCard({ width, onCreate }: { width: number; onCreate: () => void }) {
  return (
    <Animated.View
      entering={cardEnter}
      style={[styles.card, { width }]}
      {...webClass('cm-fire-card')}
    >
      <View style={styles.getStartedRow}>
        <View style={styles.getStartedIcon}>
          <Ionicons name="location-outline" size={20} color="#3FB68B" />
        </View>
        <View style={styles.getStartedText}>
          <Text style={styles.getStartedTitle}>Create a location to get started</Text>
          <Text style={styles.cardSub}>
            FireSight watches for heat anomalies around the places you save. Add your
            first location and its area is monitored live on this map.
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="Create a location"
        style={({ pressed }) => [
          styles.viewBtn,
          { backgroundColor: '#2E8465' },
          pressed && { backgroundColor: '#256E55', transform: [{ scale: 0.985 }] },
        ]}
      >
        <Ionicons name="add" size={16} color="#fff" />
        <Text style={styles.viewBtnText}>Create a location</Text>
      </Pressable>
    </Animated.View>
  );
}

function LocationCard({
  location,
  distKm,
  onClose,
  onView,
  width,
}: {
  location: Location;
  distKm: number | null;
  onClose: () => void;
  onView: () => void;
  width: number;
}) {
  const kindIcon: 'home' | 'school' | 'people' | 'location' =
    location.kind === 'home'
      ? 'home'
      : location.kind === 'school'
        ? 'school'
        : location.kind === 'family'
          ? 'people'
          : 'location';
  return (
    <Animated.View
      entering={cardEnter}
      style={[styles.card, { width }]}
      {...webClass('cm-fire-card')}
    >
      <View style={styles.cardHeader}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.eyebrowDot, { backgroundColor: '#3FB68B' }]} />
          <Text style={[styles.eyebrow, { color: '#3FB68B' }]}>SAVED LOCATION</Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close location details"
          style={({ pressed }) => [styles.cardClose, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={18} color={mapPalette.textMuted} />
        </Pressable>
      </View>

      <View style={styles.locationNameRow}>
        <View style={styles.locationBadge}>
          <Ionicons name={kindIcon} size={14} color="#fff" />
        </View>
        <Text style={styles.cardRegion}>{location.name}</Text>
      </View>
      <Text style={styles.cardSub}>{location.placeLabel || 'Saved place'}</Text>

      <View style={[styles.cardMetricRow, { marginTop: 12 }]}>
        <View style={styles.cardMetricHalf}>
          <Text style={styles.cardMetricLabel}>DISTANCE</Text>
          <Text style={styles.cardMetricValue}>
            {distKm === null ? '—' : distKm}
            <Text style={styles.cardMetricUnit}> km</Text>
          </Text>
        </View>
        <View style={styles.cardMetricHalf}>
          <Text style={styles.cardMetricLabel}>RADIUS</Text>
          <Text style={styles.cardMetricValue}>
            {location.radiusKm}
            <Text style={styles.cardMetricUnit}> km</Text>
          </Text>
        </View>
        <View style={styles.cardMetricHalf}>
          <Text style={styles.cardMetricLabel}>POSITION</Text>
          <Text style={styles.cardMetricValue}>
            {Math.abs(location.point.lat).toFixed(3)}°{location.point.lat >= 0 ? 'N' : 'S'}{' '}
            {Math.abs(location.point.lon).toFixed(3)}°{location.point.lon >= 0 ? 'E' : 'W'}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onView}
        accessibilityRole="button"
        accessibilityLabel={`View location — ${location.name}`}
        style={({ pressed }) => [
          styles.viewBtn,
          { backgroundColor: '#2E8465' },
          pressed && { backgroundColor: '#256E55', transform: [{ scale: 0.985 }] },
        ]}
      >
        <Text style={styles.viewBtnText}>View Location</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const G = 10; // chrome column gap

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mapPalette.oceanDeep },

  chrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 20,
  },
  chromeInner: { gap: G, alignItems: 'center' },

  brandRow: { width: '100%', flexDirection: 'row' },

  searchCol: { alignSelf: 'stretch', alignItems: 'center' },
  searchUnit: {
    alignSelf: 'stretch',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    height: 48,
    borderRadius: 16,
    backgroundColor: mapPalette.glassStrong,
    borderWidth: 1,
    borderColor: mapPalette.glassBorderSoft,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT.interRegular,
    fontSize: 15,
    color: COLOR.white,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  searchDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.1)' },
  layersBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layersBtnOn: { backgroundColor: 'rgba(232,112,42,0.16)' },
  dropAnchor: { alignSelf: 'stretch', alignItems: 'center' },

  resultsPanel: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    maxWidth: 560,
    alignSelf: 'center',
    borderRadius: 16,
    backgroundColor: mapPalette.glassStrong,
    borderWidth: 1,
    borderColor: mapPalette.glassBorderSoft,
    overflow: 'hidden',
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  resultRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  resultIcon: { width: 26, alignItems: 'center' },
  resultText: { flex: 1 },
  resultName: { fontFamily: FONT.interMedium, fontSize: 14, color: COLOR.white },
  resultArea: { fontFamily: FONT.interRegular, fontSize: 12, color: mapPalette.textFaint, marginTop: 1 },

  filtersPanel: {
    position: 'absolute',
    top: 6,
    right: 0,
    borderRadius: 16,
    backgroundColor: mapPalette.glassStrong,
    borderWidth: 1,
    borderColor: mapPalette.glassBorderSoft,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    maxWidth: '100%',
  },
  filtersTitle: {
    fontFamily: FONT.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: mapPalette.textFaint,
  },
  filtersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, maxWidth: 296 },

  toast: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: mapPalette.glassStrong,
    borderWidth: 1,
    borderColor: mapPalette.glassBorderSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  toastText: { fontFamily: FONT.interRegular, fontSize: 13, color: mapPalette.textMuted },

  controls: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
  },
  controlGap: { height: 2 },
  controlDivider: { width: 22, height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 2 },

  bottomArea: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    alignItems: 'center',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: mapPalette.glass,
    borderWidth: 1,
    borderColor: mapPalette.glassBorderSoft,
  },
  metricsRow: { flexDirection: 'row', alignItems: 'center' },
  metric: { alignItems: 'flex-end', paddingHorizontal: 12 },
  metricDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)' },
  metricValue: {
    fontFamily: FONT.interSemiBold,
    fontSize: 17,
    lineHeight: 20,
    color: COLOR.white,
    letterSpacing: -0.4,
  },
  metricLabel: {
    fontFamily: FONT.interMedium,
    fontSize: 9,
    letterSpacing: 0.8,
    color: mapPalette.textFaint,
    marginTop: 1,
  },

  attribution: {
    position: 'absolute',
    left: 14,
    alignSelf: 'flex-start',
  },
  attributionText: {
    fontFamily: FONT.interRegular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.34)',
  },

  // card
  card: {
    borderRadius: 22,
    backgroundColor: mapPalette.glassStrong,
    borderWidth: 1,
    borderColor: mapPalette.glassBorder,
    padding: 18,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  eyebrowRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLOR.accent },
  eyebrow: {
    fontFamily: FONT.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: COLOR.accent,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  categoryDot: { width: 5, height: 5, borderRadius: 2.5 },
  categoryText: {
    fontFamily: FONT.interSemiBold,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  sourceRow: { fontFamily: FONT.interRegular, fontSize: 11, color: mapPalette.textFaint },
  cardClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardRegion: {
    fontFamily: FONT.interSemiBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
    color: COLOR.white,
  },
  cardSub: { fontFamily: FONT.interRegular, fontSize: 13, color: mapPalette.textMuted },
  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  cardMetrics: { flex: 1, gap: 10 },
  concernWrap: { width: 76, height: 76 },
  concernCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  concernValue: {
    fontFamily: FONT.interSemiBold,
    fontSize: 24,
    lineHeight: 24,
    color: COLOR.white,
    letterSpacing: -0.8,
  },
  cardMetric: { alignSelf: 'stretch' },
  cardMetricLabel: {
    fontFamily: FONT.interMedium,
    fontSize: 9,
    letterSpacing: 1.1,
    color: mapPalette.textFaint,
    marginBottom: 2,
  },
  cardMetricValue: { fontFamily: FONT.interMedium, fontSize: 13, color: COLOR.white },
  cardMetricRow: { flexDirection: 'row', gap: 14 },
  cardMetricHalf: { flex: 1 },
  cardMetricUnit: { fontFamily: FONT.interRegular, fontSize: 11, color: mapPalette.textFaint },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  conditionText: { fontFamily: FONT.interMedium, fontSize: 10.5, color: mapPalette.textMuted },
  getStartedRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  getStartedIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(63,182,139,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(63,182,139,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: { flex: 1, gap: 3 },
  getStartedTitle: {
    fontFamily: FONT.interSemiBold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.4,
    color: COLOR.white,
  },
  locationNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  locationBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2E8465',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    paddingVertical: 12,
    marginTop: 14,
  },
  viewBtnText: {
    fontFamily: FONT.interSemiBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
