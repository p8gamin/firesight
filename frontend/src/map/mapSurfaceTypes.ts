/**
 * Map surface contract — the platform-neutral types shared by the Map
 * screen's two map implementations:
 *
 *   • MapSurface.native.tsx — react-native-maps (iOS / Android)
 *   • MapSurface.web.tsx    — FireSight's SVG basemap + gesture camera
 *
 * (MapSurface.tsx is the type-level module TS resolves for the import;
 * Metro swaps in the platform implementation at bundle time, which keeps
 * react-native-maps out of the web bundle.)
 */
import type { GeoPoint, Location, MapFire, MapHeatRegion, FirePerimeter } from '../types';
import type { MapLayerId } from './tokens';

export interface MapSurfaceProps {
  /** Fire markers to render (already filtered by the layer toggles). */
  fires: MapFire[];
  /** Soft heat footprints (already gated by the heat layer toggle). */
  heatRegions: MapHeatRegion[];
  /** Perimeter geometry to render when available (gated by its toggle). */
  perimeters: FirePerimeter[];
  /** Layer toggles that affect the surface itself. */
  layers: Record<MapLayerId, boolean>;
  /** Currently selected fire id (drives the highlighted marker). */
  selectedFireId: string | null;
  /** Saved locations (the app's locations store) — distinct teal markers. */
  locations: Location[];
  /** Currently selected saved-location id (drives the highlighted marker). */
  selectedLocationId: string | null;
  /** The user's position — rendered as the FireSight teal dot when known. */
  userPos: GeoPoint | null;
  /**
   * Where the map should centre: the user's primary saved location (their
   * monitoring home) when one exists, otherwise the device fix.
   */
  initialCenter: GeoPoint;
  /**
   * True when `initialCenter` is a real target (saved location or device
   * fix) — the surface then flies there once. Never yanks the map if the
   * user is already driving.
   */
  autoCenter: boolean;
  onSelectFire: (id: string) => void;
  /** Marker press for a saved location. */
  onSelectLocation: (id: string) => void;
  /** Tap on the empty map — clears the selection card. */
  onDismiss: () => void;
  /** The user started dragging/pinching — close transient chrome. */
  onInteract: () => void;
  /** View centre changed (pan, zoom, programmatic flight). */
  onCenterChange: (center: GeoPoint) => void;
}

/** Imperative camera actions the Map screen's chrome drives. */
export interface MapSurfaceHandle {
  /**
   * Fly the camera so `point` sits at the viewport centre. `scale` is the
   * FireSight plane scale (screen px per plane px); omit to zoom in one step
   * from the current view.
   */
  flyTo(point: GeoPoint, opts?: { scale?: number }): void;
  /** Multiply the current zoom by `factor` (>1 in, <1 out), keeping the centre. */
  zoomBy(factor: number): void;
  /** Return to FireSight's North America framing. */
  fitNorthAmerica(): void;
}
