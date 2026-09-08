/**
 * Web map surface — Leaflet + OpenStreetMap tiles. Completely free:
 * no Google Maps, no API key, no billing.
 *
 * Real OSM roads/streets/cities, smooth pan + zoom, built-in zoom control,
 * a FireSight-styled fullscreen control, the required OpenStreetMap
 * attribution, and automatic resize handling (ResizeObserver).
 *
 * Markers are FireSight-styled divIcons driven entirely by the app's live
 * data — wildfire activity groups from the FireSight backend (clustered via
 * leaflet.markercluster) and saved locations from the app's locations store.
 * Markers diff by id, so data changes add/update/remove them live.
 *
 * Only ever bundled by Metro's web resolution (`MapSurface.web.tsx`).
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

import { fireSeverity, severityPalette, mapPalette, CAMERA_BOTTOM_PAD, CAMERA_TOP_PAD } from './tokens';
import { initialCamera, WORLD_PX } from './geo';
import type { MapFire, Location } from '../types';
import type {
  MapSurfaceHandle,
  MapSurfaceProps,
} from './mapSurfaceTypes';

// ---------------------------------------------------------------------------
// Camera unit conversion (FireSight plane scale ↔ Leaflet zoom level)
// ---------------------------------------------------------------------------

function zoomForScale(scale: number): number {
  return Math.log2((scale * WORLD_PX) / 256);
}

/** FireSight locate framing (~90 px per degree of longitude) as a Leaflet zoom. */
const LOCATE_ZOOM = Math.round(zoomForScale((90 * 360) / WORLD_PX) * 10) / 10;

type Marker = L.Marker;
type MarkerEntry = { marker: Marker; sig: string };

// ---------------------------------------------------------------------------
// Marker DOM builders (raw DOM rendered inside Leaflet's marker panes)
// ---------------------------------------------------------------------------

function el(tag: string, css: Partial<CSSStyleDeclaration>): HTMLElement {
  const node = document.createElement(tag);
  Object.assign(node.style, css);
  return node;
}

const CATEGORY_SIZES = {
  low: { dot: 4.5, halo: 12, haloOpacity: 0.14, hot: 2 },
  moderate: { dot: 6, halo: 17, haloOpacity: 0.2, hot: 2.6 },
  elevated: { dot: 7.5, halo: 22, haloOpacity: 0.26, hot: 3.2 },
  high: { dot: 9, halo: 26, haloOpacity: 0.32, hot: 3.8 },
} as const;

/** FireSight fire-marker grammar: soft halo + category dot + hot core. */
function buildFireContent(
  fire: MapFire,
  category: ReturnType<typeof fireSeverity>,
  selected: boolean,
  chips: { text: string; color: string }[]
): HTMLElement {
  const color = severityPalette[category];
  const sizes = CATEGORY_SIZES[category];

  const box = el('div', { width: '44px', height: '44px', position: 'relative' });
  box.setAttribute('data-firesight', 'fire-marker');
  box.setAttribute('data-category', category);
  box.setAttribute('data-fire-id', fire.id);
  box.setAttribute('data-lat', String(fire.point.lat));
  box.setAttribute('data-lon', String(fire.point.lon));
  box.title = `${fire.name} — concern ${fire.concern}`;

  if (category !== 'low') {
    box.appendChild(
      el('div', {
        position: 'absolute',
        left: `${(44 - sizes.halo * 2) / 2}px`,
        top: `${(44 - sizes.halo * 2) / 2}px`,
        width: `${sizes.halo * 2}px`,
        height: `${sizes.halo * 2}px`,
        borderRadius: '50%',
        background: color,
        opacity: String(sizes.haloOpacity),
      })
    );
  }

  if (selected) {
    box.appendChild(
      el('div', {
        position: 'absolute',
        left: '7px',
        top: '7px',
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        border: '1.5px solid rgba(255,255,255,0.94)',
        boxShadow: '0 0 0 3px rgba(0,0,0,0.25)',
      })
    );
  }

  const dot = el('div', {
    position: 'absolute',
    left: `${(44 - sizes.dot * 2) / 2}px`,
    top: `${(44 - sizes.dot * 2) / 2}px`,
    width: `${sizes.dot * 2}px`,
    height: `${sizes.dot * 2}px`,
    borderRadius: '50%',
    background: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  });
  dot.appendChild(
    el('div', {
      width: `${sizes.hot * 2}px`,
      height: `${sizes.hot * 2}px`,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.78)',
    })
  );
  box.appendChild(dot);

  for (const chip of chips) {
    const chipEl = el('div', {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      background: 'rgba(10,14,19,0.85)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '999px',
      padding: '2px 7px',
      fontFamily: "'Inter_500Medium', sans-serif",
      fontSize: '11px',
      lineHeight: '14px',
      color: 'rgba(255,255,255,0.74)',
    });
    chipEl.appendChild(
      el('span', { width: '6px', height: '6px', borderRadius: '50%', background: chip.color })
    );
    chipEl.appendChild(document.createTextNode(chip.text));
    box.appendChild(chipEl);
  }
  return box;
}

/** Saved-location marker: the location's NAME above a teal home badge. */
function buildLocationContent(loc: Location, selected: boolean): HTMLElement {
  // 44 wide × 64 tall: a name pill (top ~20px) above the badge; the icon
  // anchor points at the badge centre (y = 20 + 22 = 42).
  const box = el('div', { width: '44px', height: '64px', position: 'relative' });
  box.setAttribute('data-firesight', 'location-marker');
  box.setAttribute('data-location-id', loc.id);
  box.setAttribute('data-name', loc.name);
  box.title = loc.name;

  // Name label — whatever the user called this place on the Locations page.
  const namePill = el('div', {
    position: 'absolute',
    top: '0px',
    left: '50%',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    fontFamily: "'Inter_600SemiBold', sans-serif",
    fontSize: '11px',
    lineHeight: '14px',
    color: '#FFFFFF',
    background: 'rgba(10,14,19,0.85)',
    border: '1px solid rgba(63,182,139,0.55)',
    borderRadius: '999px',
    padding: '2px 8px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
  });
  namePill.appendChild(document.createTextNode(loc.name));
  box.appendChild(namePill);

  box.appendChild(
    el('div', {
      position: 'absolute',
      left: '5px',
      top: '25px',
      width: '34px',
      height: '34px',
      borderRadius: '50%',
      background: 'rgba(63,182,139,0.2)',
    })
  );
  if (selected) {
    box.appendChild(
      el('div', {
        position: 'absolute',
        left: '7px',
        top: '27px',
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        border: '1.5px solid rgba(63,182,139,0.9)',
      })
    );
  }
  const badge = el('div', {
    position: 'absolute',
    left: '10px',
    top: '30px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#3FB68B',
    border: '2px solid #EAF7F1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 5px rgba(0,0,0,0.35)',
  });
  const glyph = el('div', {
    width: '12px',
    height: '12px',
    background: '#fff',
    clipPath:
      'polygon(50% 0%, 100% 45%, 88% 45%, 88% 100%, 62% 100%, 62% 66%, 38% 66%, 38% 100%, 12% 100%, 12% 45%, 0% 45%)',
  });
  badge.appendChild(glyph);
  box.appendChild(badge);
  return box;
}

/** The user's own position — FireSight teal rings. */
function buildUserDotContent(): HTMLElement {
  const box = el('div', { width: '24px', height: '24px', position: 'relative' });
  box.setAttribute('data-firesight', 'user-dot');
  box.appendChild(
    el('div', {
      position: 'absolute',
      inset: '0',
      borderRadius: '50%',
      background: 'rgba(63,182,139,0.18)',
      border: '1.5px solid #3FB68B',
    })
  );
  box.appendChild(
    el('div', {
      position: 'absolute',
      left: '9.5px',
      top: '9.5px',
      width: '5px',
      height: '5px',
      borderRadius: '50%',
      background: '#7FD9B4',
    })
  );
  return box;
}

/** Cluster bubble — ember circle with the grouped marker count. */
function buildClusterContent(count: number): HTMLElement {
  const size = count < 10 ? 34 : count < 100 ? 40 : 46;
  const box = el('div', {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: 'rgba(232,112,42,0.28)',
    border: '1.5px solid rgba(232,112,42,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter_600SemiBold', sans-serif",
    fontSize: '13px',
    color: '#fff',
    textShadow: '0 1px 2px rgba(0,0,0,0.45)',
    boxShadow: '0 1px 6px rgba(0,0,0,0.3)',
  });
  box.setAttribute('data-firesight', 'fire-cluster');
  box.appendChild(document.createTextNode(String(count)));
  return box;
}

function divIconFor(
  content: HTMLElement,
  size: [number, number],
  anchor: [number, number]
): L.DivIcon {
  return L.divIcon({
    html: content,
    className: '',
    iconSize: size,
    iconAnchor: anchor,
  });
}

// ---------------------------------------------------------------------------
// Fullscreen control (Leaflet core doesn't ship one)
// ---------------------------------------------------------------------------

function createFullscreenControl(): L.Control {
  const ControlClass = L.Control.extend({
    onAdd(): HTMLElement {
      const container = L.DomUtil.create('div', 'fs-fullscreen-control leaflet-bar');
      const button = L.DomUtil.create('a', 'fs-fullscreen-button', container);
      button.href = '#';
      button.title = 'Toggle fullscreen view';
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', 'Toggle fullscreen view');

      const EXPAND =
        '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#333" stroke-width="1.6" stroke-linecap="round"><path d="M2 6V2h4M13 6V2H9M2 9v4h4M13 9v4H9"/></svg>';
      const COMPRESS =
        '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#333" stroke-width="1.6" stroke-linecap="round"><path d="M6 2v4H2M9 2v4h4M6 13V9H2M9 13V9h4"/></svg>';
      button.innerHTML = EXPAND;

      L.DomEvent.disableClickPropagation(button);
      L.DomEvent.on(button, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          void (container.parentElement?.parentElement ?? document.documentElement).requestFullscreen?.();
        }
      });
      document.addEventListener('fullscreenchange', () => {
        button.innerHTML = document.fullscreenElement ? COMPRESS : EXPAND;
      });
      return container;
    },
  });
  return new (ControlClass as unknown as new (opts?: L.ControlOptions) => L.Control)({
    position: 'topright',
  });
}

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
  const hostRef = useRef<View | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const overlaysRef = useRef<L.LayerGroup | null>(null);
  const fireMarkers = useRef(new Map<string, MarkerEntry>());
  const locationMarkers = useRef(new Map<string, Marker>());
  const userMarkerRef = useRef<Marker | null>(null);

  const [zoom, setZoom] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  // Latest callbacks for marker event listeners (bound once per marker).
  const cbRef = useRef({ onSelectFire, onSelectLocation, onDismiss, onInteract, onCenterChange });
  cbRef.current = { onSelectFire, onSelectLocation, onDismiss, onInteract, onCenterChange };

  const interacted = useRef(false);
  const flownToDevice = useRef<string | null>(null);

  const zoomInit = useMemo(
    () =>
      zoomForScale(
        initialCamera({
          width: Math.max(1, globalThis.innerWidth ?? 400),
          height: Math.max(1, globalThis.innerHeight ?? 700),
        }).s
      ),
    []
  );
  const zoomed = zoom !== null && Math.pow(2, zoom - zoomInit) >= CHIP_ZOOM;

  const mountCenter = useRef(initialCenter);

  // --- Create the map (mount-only) ------------------------------------------
  useEffect(() => {
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;

    const map = L.map(host, {
      center: [mountCenter.current.lat, mountCenter.current.lon],
      zoom: LOCATE_ZOOM,
      zoomControl: false, // added below with an explicit position
      attributionControl: true, // required OpenStreetMap attribution
      scrollWheelZoom: true,
      worldCopyJump: true,
    });

    // Real OpenStreetMap tiles — roads, streets, cities, geography. Free.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    map.addControl(createFullscreenControl());

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) =>
        divIconFor(buildClusterContent(c.getChildCount()), [34, 34], [17, 17]),
    });
    map.addLayer(cluster);

    const overlays = L.layerGroup().addTo(map);

    mapRef.current = map;
    clusterRef.current = cluster;
    overlaysRef.current = overlays;
    setReady(true);

    const report = () => {
      const c = map.getCenter();
      cbRef.current.onCenterChange({ lat: c.lat, lon: c.lng });
      setZoom(map.getZoom());
    };
    map.on('moveend', report);
    map.on('dragstart', () => {
      interacted.current = true;
      cbRef.current.onInteract();
    });
    map.on('click', () => cbRef.current.onDismiss());

    // Keep the map sized to its container (responsive + layout changes).
    const invalidate = () => {
      map.invalidateSize();
      // The screen may have just become visible — catch up on a pending
      // auto-center flight that was deferred while the container was hidden.
      flyCenterRef.current();
    };
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => invalidate())
        : null;
    observer?.observe(host);
    window.addEventListener('resize', invalidate);
    // Tiles/size may settle one frame after mount.
    const settle = setTimeout(() => map.invalidateSize(), 50);

    return () => {
      clearTimeout(settle);
      observer?.disconnect();
      window.removeEventListener('resize', invalidate);
      fireMarkers.current.clear();
      locationMarkers.current.clear();
      userMarkerRef.current = null;
      clusterRef.current = null;
      overlaysRef.current = null;
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Fire markers (diffed by id → data changes add/update/remove live) ----
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster || !ready) return;

    const keep = new Set(fires.map((f) => f.id));
    for (const [id, entry] of fireMarkers.current) {
      if (!keep.has(id)) {
        cluster.removeLayer(entry.marker);
        fireMarkers.current.delete(id);
      }
    }

    for (const fire of fires) {
      const category = fireSeverity(fire);
      const selected = fire.id === selectedFireId;
      const chips: { text: string; color: string }[] = [];
      if (zoomed && layers.air && fire.air) {
        chips.push({ text: `AQI ${fire.air.aqi}`, color: '#8FCEB0' });
      }
      if (zoomed && layers.weather && fire.weather) {
        chips.push({
          text: `${fire.weather.tempC != null ? `${Math.round(fire.weather.tempC)}° ` : ''}${fire.weather.windDir} ${Math.round(fire.weather.windKmh)}`,
          color: '#A8C9DA',
        });
      }
      const sig = `${category}|${selected}|${chips.map((c) => c.text).join('+')}|${fire.point.lat},${fire.point.lon}`;
      const ranks = { low: 10, moderate: 20, elevated: 30, high: 40 } as const;
      const zIndexOffset = (selected ? 1000 : 0) + ranks[category];

      const existing = fireMarkers.current.get(fire.id);
      if (existing) {
        if (existing.sig !== sig) {
          existing.marker.setLatLng([fire.point.lat, fire.point.lon]);
          existing.marker.setIcon(
            divIconFor(buildFireContent(fire, category, selected, chips), [44, 44], [22, 22])
          );
          existing.marker.setZIndexOffset(zIndexOffset);
          existing.sig = sig;
        }
        continue;
      }

      const marker = L.marker([fire.point.lat, fire.point.lon], {
        icon: divIconFor(buildFireContent(fire, category, selected, chips), [44, 44], [22, 22]),
        zIndexOffset,
        keyboard: false,
      });
      marker.on('click', () => cbRef.current.onSelectFire(fire.id));
      cluster.addLayer(marker);
      fireMarkers.current.set(fire.id, { marker, sig });
    }
  }, [ready, fires, selectedFireId, zoomed, layers.air, layers.weather]);

  // --- Saved-location markers (from the app's locations store) ---------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const keep = new Set(locations.map((l) => l.id));
    for (const [id, marker] of locationMarkers.current) {
      if (!keep.has(id)) {
        map.removeLayer(marker);
        locationMarkers.current.delete(id);
      }
    }

    for (const loc of locations) {
      const selected = loc.id === selectedLocationId;
      const existing = locationMarkers.current.get(loc.id);
      if (existing) {
        existing.setLatLng([loc.point.lat, loc.point.lon]);
        existing.setIcon(
          divIconFor(buildLocationContent(loc, selected), [44, 64], [22, 42])
        );
        existing.setZIndexOffset(selected ? 800 : 500);
        continue;
      }
      const marker = L.marker([loc.point.lat, loc.point.lon], {
        icon: divIconFor(buildLocationContent(loc, selected), [44, 64], [22, 42]),
        zIndexOffset: selected ? 800 : 500,
        keyboard: false,
      });
      marker.on('click', () => cbRef.current.onSelectLocation(loc.id));
      marker.addTo(map);
      locationMarkers.current.set(loc.id, marker);
    }
  }, [ready, locations, selectedLocationId]);

  // --- User position dot ------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!userPos) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      return;
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userPos.lat, userPos.lon]);
      return;
    }
    userMarkerRef.current = L.marker([userPos.lat, userPos.lon], {
      icon: divIconFor(buildUserDotContent(), [24, 24], [12, 12]),
      zIndexOffset: 1500,
      keyboard: false,
    }).addTo(map);
  }, [ready, userPos]);

  // --- Heat footprints + perimeter geometry (layer-gated overlays) ------------
  useEffect(() => {
    const overlays = overlaysRef.current;
    if (!overlays || !ready) return;
    overlays.clearLayers();

    if (layers.heat) {
      for (const h of heatRegions) {
        L.circle([h.point.lat, h.point.lon], {
          radius: Math.max(h.rxKm, h.ryKm) * 1000,
          color: '#E8702A',
          weight: 1,
          opacity: 0.07 * h.intensity,
          fillColor: '#E8702A',
          fillOpacity: 0.1 * h.intensity,
          interactive: false,
        }).addTo(overlays);
      }
    }

    if (layers.perimeters) {
      for (const p of perimeters) {
        const active = p.fireId === selectedFireId;
        L.polygon(
          p.ring.map((pt) => [pt.lat, pt.lon]),
          {
            color: '#E8702A',
            weight: active ? 2.6 : 1.5,
            opacity: active ? 0.85 : 0.42,
            fillColor: '#E8702A',
            fillOpacity: active ? 0.055 : 0.03,
            interactive: false,
          }
        ).addTo(overlays);
      }
    }
  }, [ready, layers.heat, layers.perimeters, heatRegions, perimeters, selectedFireId]);

  // --- Fly to the monitoring home / device fix once it resolves ---------------
  // The map screen stays mounted in the router stack while hidden (0×0
  // container), where Leaflet's flyTo math produces NaN. So: only fly when the
  // container has size, and retry on the next resize when it becomes visible.
  const flyCenterRef = useRef<() => void>(() => {});
  useEffect(() => {
    const maybeFly = () => {
      const map = mapRef.current;
      if (!map || !ready || !autoCenter || interacted.current) return;
      const key = `${initialCenter.lat.toFixed(4)},${initialCenter.lon.toFixed(4)}`;
      if (flownToDevice.current === key) return;
      if (map.getSize().x <= 0 || map.getSize().y <= 0) return; // hidden — retry later
      flownToDevice.current = key;
      map.flyTo([initialCenter.lat, initialCenter.lon], LOCATE_ZOOM, { duration: 0.8 });
    };
    flyCenterRef.current = maybeFly;
    maybeFly();
  }, [ready, autoCenter, initialCenter.lat, initialCenter.lon]);

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (point, opts) => {
        const map = mapRef.current;
        if (!map || map.getSize().x <= 0 || map.getSize().y <= 0) return;
        const target =
          opts?.scale != null
            ? zoomForScale(opts.scale)
            : Math.min(18, (map.getZoom() ?? zoomInit) + 1);
        map.flyTo([point.lat, point.lon], Math.round(target * 10) / 10, { duration: 0.8 });
      },
      zoomBy: (factor) => {
        const map = mapRef.current;
        if (!map) return;
        const current = map.getZoom() ?? zoomInit;
        map.setZoom(Math.max(1, Math.min(19, current + Math.log2(factor))));
      },
      fitNorthAmerica: () => {
        const map = mapRef.current;
        if (!map || map.getSize().x <= 0 || map.getSize().y <= 0) return;
        map.flyToBounds(
          L.latLngBounds([12, -166], [82, -52]),
          {
            paddingTopLeft: L.point(40, Math.round(CAMERA_TOP_PAD * 1.6)),
            paddingBottomRight: L.point(40, Math.round(CAMERA_BOTTOM_PAD * 1.6)),
            duration: 0.8,
          }
        );
      },
    }),
    [zoomInit]
  );

  return <View ref={hostRef} style={styles.root} accessibilityLabel="OpenStreetMap map" />;
});

const styles = {
  root: {
    flex: 1,
    backgroundColor: mapPalette.ocean,
  },
} as const;

export default MapSurface;
