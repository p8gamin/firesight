/**
 * Locations domain helpers — the shared vocabulary between the Locations
 * list, the add/edit flow, and the location detail screen.
 *
 * Everything here derives from real records (saved locations, activity
 * groups, air events) via src/hooks — no value is invented at render time.
 * The reference "now" is the newest record timestamp in the feed (so
 * relative labels and time windows stay stable within one fetch); real
 * backend timestamps take over unchanged.
 */
import { CITIES } from '../map/gazetteer';
import { distanceKm } from '../hooks/useData';
import type { AirEvent, ActivityGroup, GeoPoint, Location } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Monitoring-radius choices offered by the add/edit flow (km). */
export const RADIUS_OPTIONS = [10, 25, 50, 100] as const;

export type TimeWindowId = '24h' | '7d' | '30d' | 'all';

export const TIME_WINDOWS: { id: TimeWindowId; label: string; hours: number }[] = [
  { id: '24h', label: '24H', hours: 24 },
  { id: '7d', label: '7D', hours: 24 * 7 },
  { id: '30d', label: '30D', hours: 24 * 30 },
  { id: 'all', label: 'All', hours: Infinity },
];

export type ActivityFilter = 'all' | 'fire' | 'heat' | 'air';

export const ACTIVITY_FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fire', label: 'Fire' },
  { id: 'heat', label: 'Heat' },
  { id: 'air', label: 'Air Quality' },
];

export type ActivityLevel = 'high' | 'moderate' | 'low';

/** Display levels, keyed by the same vocabulary as Alerts (colour never
 *  carries the meaning alone). */
export const LEVEL_META: Record<
  ActivityLevel,
  { label: string; text: string; color: string; glow: number }
> = {
  high: { label: 'High activity', text: 'HIGH', color: '#ED8C49', glow: 0.5 },
  moderate: { label: 'Moderate activity', text: 'MODERATE', color: '#D9A43C', glow: 0.3 },
  low: { label: 'Low activity', text: 'LOW', color: '#7C8A96', glow: 0.16 },
};

/** Suggested names for the add/edit flow. */
export const NAME_SUGGESTIONS = ['Home', 'School', 'Cottage', 'Work', "Grandma's House", 'Camping Trip'];

/** A thermal group reads as a fire event when its concern passes this bar;
 *  below it, it reads as a heat anomaly. */

/** An event in a location's activity timeline. */
export interface LocationEvent {
  id: string;
  category: 'fire' | 'heat' | 'air';
  title: string;
  body: string;
  /** Distance from the saved location (0 for air events at the location). */
  distanceKm: number;
  at: string; // ISO
  group?: ActivityGroup;
  air?: AirEvent;
}

// ---------------------------------------------------------------------------
// Reference clock
// ---------------------------------------------------------------------------

/** The newest record timestamp acts as "now" (backend feeds vary in freshness). */
export function datasetNow(events: { at: string }[]): number {
  let max = 0;
  for (const e of events) {
    const t = new Date(e.at).getTime();
    if (t > max) max = t;
  }
  return max > 0 ? max : Date.now();
}

export function relativeLabel(iso: string, now: number): string {
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

// ---------------------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------------------

export function withinRadius(location: Location, point: GeoPoint): boolean {
  return distanceKm(location.point, point) <= location.radiusKm;
}

/** \"Los Angeles\" / \"Big Bear Lake area\" — nearest gazetteer city. */
export function nearestCityLabel(point: GeoPoint): string {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = distanceKm(point, { lat: c.lat, lon: c.lon });
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD <= 20 ? best.name : `${best.name} area`;
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export function groupCategory(g: ActivityGroup): 'fire' | 'heat' {
  // Only WFIGS-reported incidents are confirmed wildfires; satellite-only
  // groupings are heat activity, not proven wildfires.
  return g.incidentId ? 'fire' : 'heat';
}

export interface LocationSummary {
  level: ActivityLevel;
  fires: number;
  heat: number;
  airLabel: string | null;
  nearestKm: number | null;
  lastAt: string | null;
}

/** Current activity read-out for a saved location, derived from records
 *  within its monitoring radius. */
export function locationSummary(
  location: Location,
  groups: ActivityGroup[],
  airEvents: AirEvent[]
): LocationSummary {
  const near = groups.filter((g) => withinRadius(location, g.point));
  const fires = near.filter((g) => groupCategory(g) === 'fire').length;
  const heat = near.filter((g) => groupCategory(g) === 'heat').length;

  let maxConcern = 0;
  let nearestKm: number | null = null;
  let lastAt: string | null = null;
  for (const g of near) {
    maxConcern = Math.max(maxConcern, g.concernScore);
    const d = distanceKm(location.point, g.point);
    if (nearestKm === null || d < nearestKm) nearestKm = d;
    if (!lastAt || g.latestDetectedAt > lastAt) lastAt = g.latestDetectedAt;
  }
  for (const a of airEvents) {
    if (!withinRadius(location, a.point)) continue;
    if (!lastAt || a.occurredAt > lastAt) lastAt = a.occurredAt;
  }

  const level: ActivityLevel = maxConcern >= 70 ? 'high' : maxConcern >= 35 ? 'moderate' : 'low';
  const airLabel = airEvents.find((a) => withinRadius(location, a.point))?.label ?? null;

  return { level, fires, heat, airLabel, nearestKm, lastAt };
}

// ---------------------------------------------------------------------------
// Timeline events
// ---------------------------------------------------------------------------

export function eventsFor(
  location: Location,
  groups: ActivityGroup[],
  airEvents: AirEvent[],
  windowHours: number,
  filter: ActivityFilter
): LocationEvent[] {
  const out: LocationEvent[] = [];

  for (const g of groups) {
    if (!withinRadius(location, g.point)) continue;
    const category = groupCategory(g);
    if (filter !== 'all' && category !== filter) continue;
    out.push({
      id: g.id,
      category,
      title: category === 'fire' ? 'Wildfire detected' : 'Heat anomaly detected',
      body: `${nearestCityLabel(g.point)} · ${g.detectionCount} detection${g.detectionCount === 1 ? '' : 's'} · ${g.frpMw.toFixed(1)} MW`,
      distanceKm: distanceKm(location.point, g.point),
      at: g.latestDetectedAt,
      group: g,
    });
  }

  for (const a of airEvents) {
    if (!withinRadius(location, a.point)) continue;
    if (filter !== 'all' && filter !== 'air') continue;
    out.push({
      id: a.id,
      category: 'air',
      title: 'Air quality changed',
      body: `${a.label} · PM2.5 ${a.pm25} µg/m³ · ${nearestCityLabel(a.point)}`,
      distanceKm: Math.max(0, Math.round(distanceKm(location.point, a.point))),
      at: a.occurredAt,
      air: a,
    });
  }

  // Reference clock: the newest record in this location's feed
  // (keeps windows stable as the demo ages; real backend timestamps take
  // over unchanged).
  const now = datasetNow(out);
  const filtered =
    windowHours === Infinity
      ? out
      : out.filter((e) => new Date(e.at).getTime() >= now - windowHours * 3600_000);

  return filtered.sort((a, b) => (a.at < b.at ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Trend (last N days)
// ---------------------------------------------------------------------------

export interface TrendBucket {
  label: string;
  count: number;
}

export type TrendDirection = 'increasing' | 'decreasing' | 'stable' | 'quiet';

/** Daily event counts for the last `days` days, ending on the newest record. */
export function trendFor(
  location: Location,
  groups: ActivityGroup[],
  airEvents: AirEvent[],
  days = 7
): { buckets: TrendBucket[]; direction: TrendDirection } {
  const all = eventsFor(location, groups, airEvents, Infinity, 'all');
  const now = datasetNow(all);
  const dayMs = 24 * 3600_000;

  const buckets: TrendBucket[] = [];
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = days - 1; i >= 0; i--) {
    const start = now - (i + 1) * dayMs;
    const end = now - i * dayMs;
    const count = all.filter((e) => {
      const t = new Date(e.at).getTime();
      return t >= start && t < end;
    }).length;
    const d = new Date(end - 1);
    buckets.push({ label: names[d.getDay()], count });
  }

  const firstHalf = buckets.slice(0, Math.floor(days / 2)).reduce((s, b) => s + b.count, 0);
  const secondHalf = buckets.slice(Math.floor(days / 2)).reduce((s, b) => s + b.count, 0);
  const total = buckets.reduce((s, b) => s + b.count, 0);

  let direction: TrendDirection = 'stable';
  if (total === 0) direction = 'quiet';
  else if (secondHalf > firstHalf * 1.4 && secondHalf >= 2) direction = 'increasing';
  else if (firstHalf > secondHalf * 1.4 && firstHalf >= 2) direction = 'decreasing';

  return { buckets, direction };
}

export const TREND_DIRECTION_META: Record<TrendDirection, { label: string; icon: 'trending-up' | 'trending-down' | 'remove' | 'leaf-outline'; color: string }> = {
  increasing: { label: 'Increasing', icon: 'trending-up', color: '#ED8C49' },
  decreasing: { label: 'Decreasing', icon: 'trending-down', color: '#7FB8A0' },
  stable: { label: 'Stable', icon: 'remove', color: '#9AA8B4' },
  quiet: { label: 'Quiet period', icon: 'leaf-outline', color: '#7C8A96' },
};

// ---------------------------------------------------------------------------
// Most active nearby
// ---------------------------------------------------------------------------

/** Thermal groups within 2× the monitoring radius, ranked by concern. */
export function mostActiveNearby(location: Location, groups: ActivityGroup[], limit = 3): ActivityGroup[] {
  return groups
    .filter((g) => distanceKm(location.point, g.point) <= location.radiusKm * 2)
    .sort((a, b) => b.concernScore - a.concernScore)
    .slice(0, limit);
}

export function distanceLabel(km: number): string {
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}