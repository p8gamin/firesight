/**
 * Backend → domain adapter.
 *
 * Maps the sanitized `FireActivityGroup[]` payloads from the FireSight
 * backend onto the existing domain types in src/types (MapFire,
 * MapHeatRegion). The UI and its types don't change — this is the only
 * place that knows the backend field names.
 *
 * Nothing is invented: labels are derived from the incident details the
 * backend attaches, otherwise from the nearest known place or coordinates.
 */
import type { MapFire, MapHeatRegion, Severity } from '../types';
import type { FireActivityGroup } from './fireApi';
import { SEARCH_PLACES } from '../map/gazetteer';
import { distanceKm } from '../utils/geo';

/** FIRMS satellite codes → human labels; unknown codes pass through. */
const SATELLITE_LABELS: Record<string, string> = {
  N20: 'NOAA-20',
  N21: 'NOAA-21',
  SNPP: 'Suomi NPP',
};

/** Valid backend category strings, in the same order as `Severity`. */
const CATEGORIES: Record<string, Severity> = {
  Low: 'low',
  Moderate: 'moderate',
  Elevated: 'elevated',
  High: 'high',
};

/**
 * Derive the concern category from the score when the backend didn't send
 * one (or sent an unknown label). Thresholds mirror the backend's own
 * category bands (see backend fire_engine): 25 / 50 / 75.
 */
function categoryOf(concern: number, reported: string | null): Severity {
  if (reported) {
    const known = CATEGORIES[reported.trim()];
    if (known) return known;
  }
  if (concern < 25) return 'low';
  if (concern < 50) return 'moderate';
  if (concern < 75) return 'elevated';
  return 'high';
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function degreesToCardinal(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 22.5) % COMPASS.length];
}

/** Standard US-EPA AQI category for a US AQI value. */
function aqiCategoryLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for sensitive groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

function nearestPlaceLabel(lat: number, lon: number): string | null {
  let best: { name: string; area: string; km: number } | null = null;
  for (const place of SEARCH_PLACES) {
    const km = distanceKm({ lat, lon }, { lat: place.lat, lon: place.lon });
    if (!best || km < best.km) best = { name: place.name, area: place.area, km };
  }
  if (!best || best.km > 300) return null;
  return best.area ? `Near ${best.name}, ${best.area}` : `Near ${best.name}`;
}

function formatCoordsLabel(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
}

/** Human region label: attached incident details, else nearest known place. */
function regionLabel(group: FireActivityGroup): string {
  const incident = group.incident;
  if (incident) {
    const parts = [incident.city ?? incident.county, incident.state].filter(
      (part): part is string => part !== null
    );
    if (parts.length > 0) return parts.join(', ');
  }
  return nearestPlaceLabel(group.latitude, group.longitude) ?? formatCoordsLabel(group.latitude, group.longitude);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function fireId(group: FireActivityGroup): string {
  const official = group.incident?.irwin_id ?? group.incident?.unique_fire_identifier;
  if (official) return official.replace(/[^a-zA-Z0-9_-]+/g, '-');
  // Stable-ish centroid id (~100 m grid) so ids survive refetches.
  return `fire-${group.latitude.toFixed(3)}-${group.longitude.toFixed(3)}`;
}

export interface AdaptedFires {
  fires: MapFire[];
  heatRegions: MapHeatRegion[];
}

/**
 * Convert backend activity groups into the map domain types.
 * Every group yields one fire marker and one soft heat footprint sized by
 * its radiative power (the backend serves no separate geometry layers).
 */
export function adaptFireGroups(groups: FireActivityGroup[]): AdaptedFires {
  const fires: MapFire[] = [];
  const heatRegions: MapHeatRegion[] = [];
  const usedIds = new Set<string>();

  for (const group of groups) {
    let id = fireId(group);
    if (usedIds.has(id)) id = `${id}-${fires.length}`;
    usedIds.add(id);

    const concern = clampPercent(group.concern_score);
    const fire: MapFire = {
      id,
      // WFIGS-reported incidents keep their official name; satellite-only
      // groupings are heat activity, not confirmed wildfires.
      name: group.incident?.incident_name ?? 'Detected heat activity',
      region: regionLabel(group),
      point: { lat: group.latitude, lon: group.longitude },
      firstDetectedAt: group.first_time,
      detectedAt: group.latest_time,
      detections: group.detections,
      satellites: group.satellites.map((s) => SATELLITE_LABELS[s] ?? s),
      frpMw: group.max_frp,
      concern,
      category: categoryOf(concern, group.category),
      confidence: group.readable_confidence.length > 0 ? group.readable_confidence : undefined,
      hasWfigsReport: group.incident !== null,
    };

    if (group.weather) {
      fire.weather = {
        windKmh: group.weather.wind_speed,
        windDir: degreesToCardinal(group.weather.wind_direction),
        humidityPct: group.weather.humidity ?? 0,
      };
    }
    if (group.air_quality) {
      fire.air = {
        pm25: group.air_quality.pm2_5 ?? 0,
        aqi: group.air_quality.aqi,
        label: aqiCategoryLabel(group.air_quality.aqi),
      };
    }

    fires.push(fire);

    // Soft heat footprint — radius grows with radiative power, opacity with concern.
    const rxKm = Math.min(40, 8 + Math.sqrt(Math.max(0, fire.frpMw)) * 3.5);
    heatRegions.push({
      id: `heat-${id}`,
      fireId: id,
      point: fire.point,
      rxKm,
      ryKm: rxKm * 0.78,
      intensity: Math.min(0.9, 0.3 + (concern / 100) * 0.6),
    });
  }

  return { fires, heatRegions };
}
