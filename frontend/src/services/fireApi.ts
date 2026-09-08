/**
 * FireSight API service layer.
 *
 * Every backend request the app makes goes through this module. The UI never
 * sees raw payloads: `getFires` validates the JSON defensively and returns a
 * fully-sanitized `FireActivityGroup[]` (missing/invalid fields are dropped
 * rather than propagated as NaN/undefined).
 */
import { buildFiresUrl, FIRES_TIMEOUT_MS } from './config';

// ---------------------------------------------------------------------------
// Response types — mirror the FireSight backend's /fires payload 1:1
// ---------------------------------------------------------------------------

export interface FireWeatherPayload {
  wind_speed: number;
  wind_direction: number;
  humidity: number | null;
}

export interface FireAirQualityPayload {
  pm2_5: number | null;
  aqi: number;
}

/** Official incident details attached by the backend when a match exists. */
export interface FireIncidentPayload {
  incident_name: string | null;
  incident_type: string | null;
  irwin_id: string | null;
  unique_fire_identifier: string | null;
  percent_contained: number | null;
  city: string | null;
  county: string | null;
  state: string | null;
}

export interface FireDetectionPayload {
  latitude: number;
  longitude: number;
  timestamp: string;
  satellite: string;
  frp: number;
}

/** One grouped wildfire activity cluster, exactly as the backend returns it. */
export interface FireActivityGroup {
  latitude: number;
  longitude: number;
  detections: number;
  first_time: string;
  latest_time: string;
  max_frp: number;
  readable_confidence: string;
  satellites: string[];
  detections_detail: FireDetectionPayload[];
  distance_from_home_km: number | null;
  weather: FireWeatherPayload | null;
  air_quality: FireAirQualityPayload | null;
  concern_score: number;
  category: string;
  age_hours: number | null;
  incident: FireIncidentPayload | null;
}

/** Raised for any request/parse failure; message is safe to show in the UI. */
export class FireApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'FireApiError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Safe parsing helpers
// ---------------------------------------------------------------------------

function toNum(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function toInt(value: unknown, min = 0): number | null {
  const n = toNum(value);
  return n === null ? null : Math.max(min, Math.round(n));
}

function toStrOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toStrArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

function toRecordOrNull(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parseWeather(raw: unknown): FireWeatherPayload | null {
  const r = toRecordOrNull(raw);
  if (!r) return null;
  const windSpeed = toNum(r.wind_speed);
  const windDirection = toNum(r.wind_direction);
  if (windSpeed === null || windDirection === null) return null;
  return { wind_speed: windSpeed, wind_direction: windDirection, humidity: toNum(r.humidity) };
}

function parseAirQuality(raw: unknown): FireAirQualityPayload | null {
  const r = toRecordOrNull(raw);
  if (!r) return null;
  const aqi = toNum(r.aqi);
  if (aqi === null) return null;
  return { pm2_5: toNum(r.pm2_5), aqi };
}

function parseIncident(raw: unknown): FireIncidentPayload | null {
  const r = toRecordOrNull(raw);
  if (!r) return null;
  const incident: FireIncidentPayload = {
    incident_name: toStrOrNull(r.incident_name),
    incident_type: toStrOrNull(r.incident_type),
    irwin_id: toStrOrNull(r.irwin_id),
    unique_fire_identifier: toStrOrNull(r.unique_fire_identifier),
    percent_contained: toNum(r.percent_contained),
    city: toStrOrNull(r.city),
    county: toStrOrNull(r.county),
    state: toStrOrNull(r.state),
  };
  const hasAny = Object.values(incident).some((v) => v !== null);
  return hasAny ? incident : null;
}

function parseDetections(raw: unknown): FireDetectionPayload[] {
  if (!Array.isArray(raw)) return [];
  const out: FireDetectionPayload[] = [];
  for (const item of raw) {
    const r = toRecordOrNull(item);
    if (!r) continue;
    const lat = toNum(r.latitude);
    const lon = toNum(r.longitude);
    const ts = toIsoOrNull(r.timestamp);
    if (lat === null || lon === null || ts === null) continue;
    out.push({
      latitude: lat,
      longitude: lon,
      timestamp: ts,
      satellite: toStrOrNull(r.satellite) ?? '',
      frp: toNum(r.frp) ?? 0,
    });
  }
  return out;
}

function parseFireGroup(raw: unknown): FireActivityGroup | null {
  const r = toRecordOrNull(raw);
  if (!r) return null;

  const latitude = toNum(r.latitude);
  const longitude = toNum(r.longitude);
  if (latitude === null || longitude === null) return null;

  const firstTime = toIsoOrNull(r.first_time);
  const latestTime = toIsoOrNull(r.latest_time);
  // A cluster without any usable overpass time can't be rendered honestly.
  if (!firstTime && !latestTime) return null;

  const concern = toNum(r.concern_score);
  if (concern === null) return null;

  return {
    latitude,
    longitude,
    detections: toInt(r.detections) ?? 1,
    first_time: firstTime ?? latestTime!,
    latest_time: latestTime ?? firstTime!,
    max_frp: toNum(r.max_frp) ?? 0,
    readable_confidence: toStrOrNull(r.readable_confidence) ?? '',
    satellites: toStrArray(r.satellites),
    detections_detail: parseDetections(r.firms_detections),
    distance_from_home_km: toNum(r.distance_from_home_km),
    weather: parseWeather(r.weather),
    air_quality: parseAirQuality(r.air_quality),
    concern_score: concern,
    category: toStrOrNull(r.category) ?? '',
    age_hours: toNum(r.age_hours),
    incident: parseIncident(r.wfigs),
  };
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * Fetch the wildfire activity groups around a location.
 * Requests GET {base}/fires?latitude={latitude}&longitude={longitude}.
 */
export async function getFires(latitude: number, longitude: number): Promise<FireActivityGroup[]> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new FireApiError('Invalid coordinates for the fire data request.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIRES_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(buildFiresUrl(latitude, longitude), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch {
    // Network failure, server down, or timeout.
    throw new FireApiError('Cannot reach the FireSight backend.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new FireApiError(`The FireSight backend returned an error (${response.status}).`, response.status);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new FireApiError('The FireSight backend returned invalid JSON.');
  }

  if (!Array.isArray(json)) {
    throw new FireApiError('Unexpected response shape from the FireSight backend.');
  }

  return json
    .map(parseFireGroup)
    .filter((group): group is FireActivityGroup => group !== null);
}
