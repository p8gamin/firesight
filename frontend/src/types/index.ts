/**
 * Domain model — shared by the data layer, hooks, and every screen.
 * When a real API lands, these types map 1:1 to its payloads.
 */

export type Severity = 'low' | 'moderate' | 'elevated' | 'high';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export type LocationKind = 'home' | 'school' | 'family' | 'custom';

/** What FireSight monitors around a saved location. */
export interface LocationMonitors {
  fires: boolean;
  heat: boolean;
  air: boolean;
}

/**
 * Location-specific alert preferences. The UI stores these so the backend
 * can wire push/notification delivery later; storing them is not a claim
 * that notifications are currently active.
 */
export interface LocationAlertPrefs {
  highConcern: boolean;
  moderate: boolean;
  newDetections: boolean;
  heatAnomalies: boolean;
  airQuality: boolean;
}

export interface Location {
  id: string;
  name: string;
  kind: LocationKind;
  point: GeoPoint;
  /** Human place label, e.g. "Toronto, Ontario" (resolved when saved). */
  placeLabel: string;
  /** Monitoring / alert radius in kilometres. */
  radiusKm: number;
  alertsEnabled: boolean;
  /** Which activity types FireSight watches around this location. */
  monitors: LocationMonitors;
  /** Which events this location should alert on. */
  alertPrefs: LocationAlertPrefs;
}

/** An air-quality change/reading event tied to a place and time. */
export interface AirEvent {
  id: string;
  point: GeoPoint;
  occurredAt: string;
  pm25: number;
  aqi: number;
  label: string; // e.g. 'Moderate'
  note: string;
}

export type SourceKind = 'NASA FIRMS' | 'WFIGS' | 'Weather' | 'Air Quality';

export interface Detection {
  id: string;
  groupId: string;
  point: GeoPoint;
  /** ISO timestamp of a single satellite overpass detection. */
  detectedAt: string;
  satellites: string[];
}

export interface ActivityGroup {
  id: string;
  label: string;
  /** Representative centroid used for distance calc + map. */
  point: GeoPoint;
  firstDetectedAt: string;
  latestDetectedAt: string;
  detectionCount: number;
  satellites: string[];
  /** 0..1, how consistent/repeated the detections are. */
  confidence: number;
  /** Fire Radiative Power, megawatts. */
  frpMw: number;
  severity: Severity;
  concernScore: number;
  /** Optional linked official incident id (distinct source). */
  incidentId?: string;
}

export interface Weather {
  /** °C — the backend's current conditions may not include temperature. */
  tempC?: number;
  windKmh: number;
  windDir: string; // e.g. 'NW'
  humidityPct: number;
  /** e.g. 'Clear' — optional when the backend reports no condition text. */
  condition?: string;
}

export interface AirQuality {
  pm25: number; // µg/m³
  aqi: number;
  label: string; // e.g. 'Good'
}

export interface Incident {
  id: string;
  name: string;
  type: string; // e.g. 'Wildfire'
  containmentPct: number;
  acreage: string;
  point: GeoPoint;
}

export type AlertCategory = 'fire' | 'heat' | 'air';

export interface Alert {
  id: string;
  severity: Severity;
  /** What kind of activity this alert reports — drives the Alerts filters. */
  category: AlertCategory;
  title: string;
  body: string;
  locationName: string;
  distanceKm: number;
  occurredAt: string;
  triggerReason: string; // e.g. 'Elevated activity detected'
  satellites: string[];
  concernScore: number;
  read: boolean;
  /** Linked activity-group id (enriches detail: detections, FRP, confidence). */
  groupId?: string;
  /** Activity location — used to centre the map from “View on Map”. */
  point?: GeoPoint;
}

/** A factor contributing to a Concern Score, with impact weighting. */
export interface ConcernFactor {
  label: string;
  impact: 'Low impact' | 'Moderate impact' | 'High impact';
}

// ---------------------------------------------------------------------------
// FireSight Map — wildfire intelligence layers. When the Python backend is
// connected these interfaces map 1:1 to its payloads (NASA FIRMS detections,
// WFIGS perimeters/incidents, weather + air-quality feeds).
// ---------------------------------------------------------------------------

/** Visual severity tier for a fire marker (derived from concern + FRP). */
export type FireTier = 'small' | 'moderate' | 'high';

/** A satellite-detected wildfire event shown on the map. */
export interface MapFire {
  id: string;
  /** Short event/complex name, e.g. "Red Lake Complex". */
  name: string;
  /** Human region label, e.g. "Northern Ontario". */
  region: string;
  point: GeoPoint;
  /** Latest satellite detection time (ISO). */
  detectedAt: string;
  firstDetectedAt: string;
  /** Number of individual satellite detections clustered into this event. */
  detections: number;
  satellites: string[];
  /** Fire Radiative Power in megawatts. */
  frpMw: number;
  /** FireSight concern score, 0..100. */
  concern: number;
  /**
   * Concern Score category as reported by the backend (Low / Moderate /
   * Elevated / High). Optional: derived from the concern score when absent
   * (older responses).
   */
  category?: Severity;
  /** Satellite detection confidence label from the backend, when reported. */
  confidence?: string;
  /**
   * True only when the backend matched these detections to an official
   * WFIGS incident report — i.e. a CONFIRMED wildfire. Satellite-only
   * groupings are heat activity/anomalies, not proven wildfires, and the
   * UI wording must reflect that distinction.
   */
  hasWfigsReport?: boolean;
  /** Site conditions when reported by the backend (optional per event). */
  weather?: Weather;
  air?: AirQuality;
  /** Optional linked heat anomaly + perimeter geometry ids. */
  heatId?: string;
  perimeterId?: string;
}

/** A diffuse heat-anomaly footprint (soft warm region, km-scale). */
export interface MapHeatRegion {
  id: string;
  fireId?: string;
  point: GeoPoint;
  /** Approximate semi-axes in kilometres. */
  rxKm: number;
  ryKm: number;
  /** 0..1 intensity — drives opacity of the glow. */
  intensity: number;
}

/** Fire perimeter polygon (official WFIGS perimeter when available). */
export interface FirePerimeter {
  id: string;
  fireId: string;
  ring: GeoPoint[];
}
