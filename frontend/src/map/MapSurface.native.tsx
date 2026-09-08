/**
 * Native map surface — react-native-maps (Expo SDK 57).
 *
 * The interactive map layer behind the FireSight Map screen on iOS/Android:
 * Google Maps on Android, Apple Maps on iOS (dark-styled), full pan/pinch,
 * FireSight-styled markers coloured by Concern Score category, soft heat
 * circles, WFIGS perimeter polygons when the backend serves geometry, and
 * the teal user-location dot.
 *
 * Only ever bundled by Metro's native resolution (`MapSurface.native.tsx`).
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, {
  Circle,
  Marker,
  Polygon,
  type Camera as RNCamera,
  type Region,
} from 'react-native-maps';

import { fireSeverity, severityPalette, type ConcernCategory } from './tokens';
import { CAMERA_BOTTOM_PAD, CAMERA_TOP_PAD, mapPalette } from './tokens';
import { GOOGLE_DARK_MAP_STYLE } from './googleMapStyle';
import { initialCamera, WORLD_PX } from './geo';
import { FONT } from '../design/constants';
import type { Location, MapFire } from '../types';
import type {
  MapSurfaceHandle,
  MapSurfaceProps,
} from './mapSurfaceTypes';

// ---------------------------------------------------------------------------
// Camera unit conversion
//
// FireSight speaks "plane scale" (screen px per plane px; the plane is
// WORLD_PX across). Google/Apple zoom levels express the same thing as
// 256·2^z screen px across the whole world.
// ---------------------------------------------------------------------------

function zoomForScale(scale: number): number {
  return Math.log2((scale * WORLD_PX) / 256);
}

/** hex #rrggbb + alpha → rgba() string (map colors are plain hex tokens). */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const USER_TEAL = '#3FB68B';

/**
 * Marker grammar per Concern Score category — the same dot + soft halo +
 * hot core as the web markers, scaled by category severity.
 */
const CATEGORY_VISUAL: Record<
  ConcernCategory,
  { dot: number; halo: number; haloOpacity: number; hot: number; rank: number }
> = {
  low: { dot: 4.5, halo: 12, haloOpacity: 0.14, hot: 2, rank: 1 },
  moderate: { dot: 6, halo: 17, haloOpacity: 0.2, hot: 2.6, rank: 2 },
  elevated: { dot: 7.5, halo: 22, haloOpacity: 0.26, hot: 3.2, rank: 3 },
  high: { dot: 9, halo: 26, haloOpacity: 0.32, hot: 3.8, rank: 4 },
};

/**
 * react-native-maps re-renders custom marker views only while
 * tracksViewChanges is true — which is expensive. Keep it true briefly
 * whenever the marker's content (or selection state) changes, then freeze.
 */
function useStableView(trackingKey: unknown): boolean {
  const [changing, setChanging] = useState(true);
  useEffect(() => {
    setChanging(true);
    const t = setTimeout(() => setChanging(false), 600);
    return () => clearTimeout(t);
  }, [trackingKey]);
  return changing;
}

// ---------------------------------------------------------------------------
// Fire marker
// ---------------------------------------------------------------------------

const MARKER_BOX = 44; // marker hit/visual box

const FireMarker = React.memo(function FireMarker({
  fire,
  selected,
  zoomed,
  chips,
  onSelect,
}: {
  fire: MapFire;
  selected: boolean;
  /** Relative zoom level — the zoom-gated chips change with it. */
  zoomed: boolean;
  /** Condition chips (air quality / weather) shown when zoomed in. */
  chips: React.ReactNode;
  onSelect: (id: string) => void;
}) {
  const category = fireSeverity(fire);
  const v = CATEGORY_VISUAL[category];
  const color = severityPalette[category];
  const stable = useStableView(`${fire.id}:${selected}:${category}:${zoomed}`);
  const centered = (d: number) => ({
    top: (MARKER_BOX - d) / 2,
    left: (MARKER_BOX - d) / 2,
  });

  return (
    <Marker
      coordinate={{ latitude: fire.point.lat, longitude: fire.point.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={() => onSelect(fire.id)}
      tracksViewChanges={stable}
      zIndex={v.rank * 10 + (selected ? 100 : 0)}
      accessibilityLabel={`${fire.name}, ${fire.region}. ${category} concern.`}
    >
      <View style={styles.markerBox}>
        {category !== 'low' ? (
          <View
            style={[
              styles.markerLayer,
              centered(v.halo * 2),
              {
                width: v.halo * 2,
                height: v.halo * 2,
                borderRadius: v.halo,
                backgroundColor: color,
                opacity: v.haloOpacity,
              },
            ]}
          />
        ) : null}
        {selected ? (
          <View
            style={[
              styles.markerLayer,
              centered(30),
              {
                width: 30,
                height: 30,
                borderRadius: 15,
                borderWidth: 1.5,
                borderColor: mapPalette.on,
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.markerLayer,
            styles.markerDot,
            centered(v.dot * 2),
            { width: v.dot * 2, height: v.dot * 2, borderRadius: v.dot },
          ]}
        >
          <View
            style={{
              width: v.hot * 2,
              height: v.hot * 2,
              borderRadius: v.hot,
              backgroundColor: 'rgba(255,255,255,0.78)',
            }}
          />
        </View>
        {chips}
      </View>
    </Marker>
  );
});

// ---------------------------------------------------------------------------
// User location dot (FireSight teal — same visual as the web billboard)
// ---------------------------------------------------------------------------

const UserDotMarker = React.memo(function UserDotMarker({
  lat,
  lon,
}: {
  lat: number;
  lon: number;
}) {
  const stable = useStableView('user');
  return (
    <Marker
      coordinate={{ latitude: lat, longitude: lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={stable}
      zIndex={1000}
      accessibilityLabel="Your location"
    >
      <View style={styles.userBox}>
        <View style={styles.userRingOuter} />
        <View style={styles.userRing} />
        <View style={styles.userCore} />
      </View>
    </Marker>
  );
});

// ---------------------------------------------------------------------------
// Condition chips (air / weather) — shown once zoomed well in
// ---------------------------------------------------------------------------

function ConditionChip({ iconName, text, color, offsetY }: {
  iconName: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
  offsetY: number;
}) {
  return (
    <View style={[styles.chip, { top: offsetY }]}>
      <Ionicons name={iconName} size={11} color={color} />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Saved-location marker (teal home badge — distinct from fire dots)
// ---------------------------------------------------------------------------

const LocationMarker = React.memo(function LocationMarker({
  loc,
  selected,
  onSelect,
}: {
  loc: Location;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const stable = useStableView(`${loc.id}:${selected}`);
  // 66 tall: the location's NAME pill above the badge; the anchor points at
  // the badge centre (y = 20 + 22 = 42 of 66).
  return (
    <Marker
      coordinate={{ latitude: loc.point.lat, longitude: loc.point.lon }}
      anchor={{ x: 0.5, y: 42 / 66 }}
      onPress={() => onSelect(loc.id)}
      tracksViewChanges={stable}
      zIndex={selected ? 200 : 50}
      accessibilityLabel={`Saved location ${loc.name}`}
    >
      <View style={styles.locationBox}>
        <View style={styles.locationLabel}>
          <Text style={styles.locationLabelText}>{loc.name}</Text>
        </View>
        <View style={styles.locationMarkerBody}>
          <View style={styles.locationHalo} />
          {selected ? <View style={styles.locationRing} /> : null}
          <View style={styles.locationBadge}>
            <Ionicons name="home" size={12} color="#fff" />
          </View>
        </View>
      </View>
    </Marker>
  );
});

// ---------------------------------------------------------------------------
// Surface
// ---------------------------------------------------------------------------

const CHIP_ZOOM = 2.6; // relative zoom (vs initial framing) where chips appear

const MapSurface = forwardRef<MapSurfaceHandle, MapSurfaceProps>(function MapSurface(
  {
    fires,
    heatRegions,
    perimeters,
    layers,
    selectedFireId,
    selectedLocationId,
    locations,
    userPos,
    initialCenter,
    autoCenter,
    onSelectFire,
    onSelectLocation,
    onDismiss,
    onInteract,
    onCenterChange,
  },
  ref
) {
  const { width, height } = useWindowDimensions();
  const mapRef = useRef<MapView | null>(null);

  // Initial framing: the FireSight "locate" scale (~90 px/deg) around the
  // current request origin (backend default until the device fix arrives).
  const initialRegion = useMemo(() => {
    const scale = (90 * 360) / WORLD_PX;
    const pxPerDeg = (scale * WORLD_PX) / 360;
    const latDelta = Math.min(150, height / pxPerDeg);
    const lonDelta = Math.min(150, width / pxPerDeg);
    return {
      latitude: initialCenter.lat,
      longitude: initialCenter.lon,
      latitudeDelta: Math.max(0.05, latDelta),
      longitudeDelta: Math.max(0.05, lonDelta),
    };
    // Deliberately mount-only: later centre changes fly via animateCamera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomInit = useMemo(
    () => zoomForScale(initialCamera({ width, height }).s),
    [width, height]
  );
  const [zoom, setZoom] = useState<number | null>(null);
  const zoomed = zoom !== null && Math.pow(2, zoom - zoomInit) >= CHIP_ZOOM;

  const [mapReady, setMapReady] = useState(false);
  const centerKey = `${initialCenter.lat.toFixed(4)},${initialCenter.lon.toFixed(4)}`;
  const flownTo = useRef<string | null>(null);
  const interacted = useRef(false);

  // Fly to the monitoring home / device fix once it resolves — only after
  // the map is ready and only if the user hasn't already taken the camera.
  useEffect(() => {
    if (!mapReady || !autoCenter || interacted.current) return;
    if (flownTo.current === centerKey || width === 0 || height === 0) return;
    const map = mapRef.current;
    if (!map) return;
    flownTo.current = centerKey;
    Promise.resolve(
      map.animateCamera(
        {
          center: { latitude: initialCenter.lat, longitude: initialCenter.lon },
          zoom: zoomForScale((90 * 360) / WORLD_PX),
          heading: 0,
          pitch: 0,
        },
        { duration: 680 }
      )
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey, mapReady, autoCenter]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (point, opts) => {
        const map = mapRef.current;
        if (!map) return;
        const camera: RNCamera = {
          center: { latitude: point.lat, longitude: point.lon },
          zoom:
            opts?.scale != null
              ? zoomForScale(opts.scale)
              : Math.min(16, (zoom ?? zoomInit) + 1),
          heading: 0,
          pitch: 0,
        };
        Promise.resolve(map.animateCamera(camera, { duration: 650 })).catch(() => {});
      },
      zoomBy: (factor) => {
        const map = mapRef.current;
        if (!map) return;
        map
          .getCamera()
          .then((cam) => {
            const target = Math.max(1, Math.min(19, (cam.zoom ?? zoomInit) + Math.log2(factor)));
            Promise.resolve(
              map.animateCamera({ ...cam, zoom: target }, { duration: 300 })
            ).catch(() => {});
          })
          .catch(() => {});
      },
      fitNorthAmerica: () => {
        Promise.resolve(
          mapRef.current?.fitToCoordinates(
            [
              { latitude: 12, longitude: -166 },
              { latitude: 82, longitude: -52 },
            ],
            {
              edgePadding: {
                top: Math.round(CAMERA_TOP_PAD * 1.6),
                right: 40,
                bottom: Math.round(CAMERA_BOTTOM_PAD * 1.6),
                left: 40,
              },
              animated: true,
            }
          )
        ).catch(() => {});
      },
    }),
    [zoom, zoomInit]
  );

  const onRegionChangeComplete = useCallback(
    (region: Region) => {
      // Google zoom from the visible longitude span (Mercator ≈ at centre).
      const z =
        width > 0 && region.longitudeDelta > 0
          ? Math.log2((width * 360) / (256 * region.longitudeDelta))
          : zoom;
      setZoom(z);
      onCenterChange({ lat: region.latitude, lon: region.longitude });
    },
    [width, zoom, onCenterChange]
  );

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      customMapStyle={GOOGLE_DARK_MAP_STYLE}
      userInterfaceStyle="dark"
      showsCompass={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsMyLocationButton={false}
      showsUserLocation={false}
      loadingEnabled
      loadingBackgroundColor={mapPalette.oceanDeep}
      onMapReady={() => setMapReady(true)}
      onPress={(e) => {
        if (e.nativeEvent.action !== 'marker-press') onDismiss();
      }}
      onPanDrag={() => {
        // The user took over the camera — cancel any pending auto-centre.
        interacted.current = true;
        onInteract();
      }}
      onRegionChangeComplete={onRegionChangeComplete}
    >
      {/* soft heat footprints (when the layer is on) */}
      {layers.heat
        ? heatRegions.map((h) => (
            <Circle
              key={h.id}
              center={{ latitude: h.point.lat, longitude: h.point.lon }}
              radius={Math.max(h.rxKm, h.ryKm) * 1000}
              strokeWidth={1}
              strokeColor={withAlpha('#E8702A', 0.07 * h.intensity)}
              fillColor={withAlpha('#E8702A', 0.1 * h.intensity)}
              zIndex={1}
            />
          ))
        : null}

      {/* WFIGS perimeter geometry — rendered when the backend serves rings */}
      {layers.perimeters
        ? perimeters.map((p) => {
            const active = p.fireId === selectedFireId;
            return (
              <Polygon
                key={p.id}
                coordinates={p.ring.map((pt) => ({ latitude: pt.lat, longitude: pt.lon }))}
                strokeWidth={active ? 2.6 : 1.5}
                strokeColor={withAlpha('#E8702A', active ? 0.85 : 0.42)}
                fillColor={withAlpha('#E8702A', active ? 0.055 : 0.03)}
                zIndex={2}
              />
            );
          })
        : null}

      {userPos ? <UserDotMarker lat={userPos.lat} lon={userPos.lon} /> : null}

      {/* Saved locations — the app's locations store (user-created included) */}
      {locations.map((loc) => (
        <LocationMarker
          key={loc.id}
          loc={loc}
          selected={loc.id === selectedLocationId}
          onSelect={onSelectLocation}
        />
      ))}

      {fires.map((fire) => {
        const selected = fire.id === selectedFireId;
        const chips = (
          <>
            {layers.air && fire.air && zoomed ? (
              <ConditionChip
                key="air"
                iconName="leaf-outline"
                color="#8FCEB0"
                text={`AQI ${fire.air.aqi}`}
                offsetY={-30}
              />
            ) : null}
            {layers.weather && fire.weather && zoomed ? (
              <ConditionChip
                key="wx"
                iconName="navigate"
                color="#A8C9DA"
                text={`${fire.weather.tempC != null ? `${Math.round(fire.weather.tempC)}° ` : ''}${fire.weather.windDir} ${Math.round(fire.weather.windKmh)}`}
                offsetY={30}
              />
            ) : null}
          </>
        );
        return (
          <FireMarker
            key={fire.id}
            fire={fire}
            selected={selected}
            zoomed={zoomed}
            chips={
              (layers.air && fire.air) || (layers.weather && fire.weather) ? chips : null
            }
            onSelect={onSelectFire}
          />
        );
      })}
    </MapView>
  );
});

const styles = StyleSheet.create({
  markerBox: { width: MARKER_BOX, height: MARKER_BOX },
  markerLayer: { position: 'absolute' },
  markerDot: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },

  locationBox: { width: MARKER_BOX, height: 66, alignItems: 'center' },
  locationLabel: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    backgroundColor: 'rgba(10,14,19,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(63,182,139,0.55)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  locationLabelText: {
    fontFamily: FONT.interSemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: '#FFFFFF',
  },
  locationMarkerBody: { position: 'absolute', top: 20, width: MARKER_BOX, height: MARKER_BOX, alignItems: 'center', justifyContent: 'center' },
  locationHalo: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(63,182,139,0.2)',
  },
  locationRing: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(63,182,139,0.9)',
  },
  locationBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: USER_TEAL,
    borderWidth: 2,
    borderColor: '#EAF7F1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },

  userBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  userRingOuter: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(63,182,139,0.18)',
  },
  userRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: USER_TEAL,
    backgroundColor: 'rgba(63,182,139,0.12)',
  },
  userCore: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#7FD9B4' },

  chip: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,14,19,0.82)',
    borderWidth: 1,
    borderColor: mapPalette.glassBorderSoft,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    minHeight: 22,
  },
  chipText: {
    fontFamily: FONT.interMedium,
    fontSize: 11,
    lineHeight: 14,
    color: mapPalette.textMuted,
  },
});

export default MapSurface;
