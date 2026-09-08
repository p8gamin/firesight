/**
 * Data-access layer. The UI reads everything through these hooks.
 *
 * Alerts and activity groups are LIVE: they derive from the FireSight backend
 * response held in the fire store (src/services/fireStore), which requests
 * heat data around the user's primary saved location. Nothing is fabricated:
 * with no saved locations there are no groups and no alerts, and fields the
 * backend doesn't provide render as '—' downstream.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adaptFireGroups } from '../services/fireAdapter';
import { ensureFiresLoaded, refreshFires, useFiresState } from '../services/fireStore';
import { distanceKm } from '../utils/geo';
import { useLocationsStore } from '../locations/store';
import { fireSeverity } from '../map/tokens';
import type {
  ActivityGroup,
  AirEvent,
  Alert,
  Incident,
  Location,
  MapFire,
  Weather,
} from '../types';

// distanceKm lives in src/utils/geo (shared with the fire adapter, which
// cannot import this module without creating a require cycle).
export { distanceKm } from '../utils/geo';

/** Human-friendly relative time from the current time (or an overridden "now"). */
export function relativeTime(iso: string, nowIso: string = new Date().toISOString()): string {
  const diffMs = new Date(nowIso).getTime() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m} ${ampm}`;
}

export function todayLabel(iso: string): string {
  const d = new Date(iso);
  return `Today, ${formatClock(iso)}`;
}

// ---------------------------------------------------------------------------
// Live activity groups (from the shared fire store)
// ---------------------------------------------------------------------------

/** Backend satellite confidence label → 0..1 for the ActivityGroup shape. */
function confidenceFraction(label: string | undefined): number {
  if (!label) return 0.6;
  const l = label.trim().toLowerCase();
  if (l === 'high') return 0.9;
  if (l === 'nominal') return 0.7;
  if (l === 'low') return 0.4;
  return 0.6;
}

function groupFromFire(fire: MapFire): ActivityGroup {
  return {
    id: fire.id,
    label: fire.name,
    point: fire.point,
    firstDetectedAt: fire.firstDetectedAt,
    latestDetectedAt: fire.detectedAt,
    detectionCount: fire.detections,
    satellites: fire.satellites,
    confidence: confidenceFraction(fire.confidence),
    frpMw: fire.frpMw,
    severity: fireSeverity(fire),
    concernScore: fire.concern,
    incidentId: fire.hasWfigsReport ? fire.id : undefined,
  };
}

export function useActivityGroups(): {
  data: ActivityGroup[];
  loading: boolean;
  error: boolean;
  /** True while the user has no saved locations — nothing is monitored yet. */
  isIdle: boolean;
} {
  const state = useFiresState();

  // Kick off the load on first use (no-op while the user has no saved
  // locations — the store stays idle until one exists).
  useEffect(() => {
    ensureFiresLoaded();
  }, []);

  return useMemo(() => {
    if (state.status === 'ready') {
      return {
        data: adaptFireGroups(state.groups).fires.map(groupFromFire),
        loading: false,
        error: false,
        isIdle: false,
      };
    }
    return {
      data: [],
      loading: state.status === 'loading',
      error: state.status === 'error',
      isIdle: state.status === 'idle',
    };
  }, [state.status, state.groups]);
}

// ---------------------------------------------------------------------------
// Alerts — derived from live heat activity around saved locations
// ---------------------------------------------------------------------------

/** Read-state for derived alerts survives refetches (keyed by alert id). */
const readAlertIds = new Set<string>();
const alertReadListeners = new Set<() => void>();

function notifyAlertRead(): void {
  for (const listener of alertReadListeners) listener();
}

function subscribeAlertRead(listener: () => void): () => void {
  alertReadListeners.add(listener);
  return () => {
    alertReadListeners.delete(listener);
  };
}

/**
 * Build alerts from the live fire data: one alert per heat grouping whose
 * concern is worth attention, addressed to the nearest saved location.
 * WFIGS-matched incidents alert as Fire; satellite-only groupings alert as
 * Heat (detections are not confirmed wildfires).
 */
function alertsFromFires(fires: MapFire[], locations: Location[]): Alert[] {
  if (locations.length === 0) return [];
  return fires
    .filter((f) => f.concern >= 25)
    .map((fire) => {
      let nearest: { name: string; km: number } | null = null;
      for (const loc of locations) {
        const km = distanceKm(loc.point, fire.point);
        if (!nearest || km < nearest.km) nearest = { name: loc.name, km };
      }
      const name = nearest?.name ?? locations[0].name;
      const km = nearest?.km ?? 0;
      const isConfirmed = fire.hasWfigsReport === true;
      return {
        id: `alert-${fire.id}`,
        severity: fireSeverity(fire),
        category: isConfirmed ? ('fire' as const) : ('heat' as const),
        title: isConfirmed ? fire.name : 'Heat anomaly detected',
        body: isConfirmed
          ? `Officially reported wildfire activity tracked within ${Math.round(km)} km of ${name}.`
          : `Satellites detected repeated thermal anomalies within ${Math.round(km)} km of ${name}. This is heat activity — not yet confirmed as a wildfire.`,
        locationName: name,
        distanceKm: km,
        occurredAt: fire.detectedAt,
        triggerReason: isConfirmed
          ? 'Official wildfire incident in range'
          : 'Elevated thermal signatures in range',
        satellites: fire.satellites,
        concernScore: fire.concern,
        read: readAlertIds.has(`alert-${fire.id}`),
        groupId: fire.id,
        point: fire.point,
      };
    })
    .sort((a, b) => b.concernScore - a.concernScore || +new Date(b.occurredAt) - +new Date(a.occurredAt));
}

export function useAlerts(): {
  alerts: Alert[];
  loading: boolean;
  error: boolean;
  /** True while the user has no saved locations — alerts start empty. */
  hasLocations: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  retry: () => void;
} {
  const state = useFiresState();
  const { locations } = useLocationsStore();
  // Re-render when read-state changes (markRead / markAllRead).
  const [readVersion, setReadVersion] = useState(0);
  useEffect(
    () => subscribeAlertRead(() => setReadVersion((v) => v + 1)),
    []
  );

  const alerts = useMemo(
    () => {
      void readVersion; // read-state changes re-derive `read` flags
      if (state.status !== 'ready') return [];
      return alertsFromFires(adaptFireGroups(state.groups).fires, locations);
    },
    [state.status, state.groups, locations, readVersion]
  );

  const markRead = useCallback((id: string) => {
    if (!readAlertIds.has(id)) {
      readAlertIds.add(id);
      notifyAlertRead();
    }
  }, []);

  const markAllRead = useCallback(() => {
    for (const alert of alerts) readAlertIds.add(alert.id);
    notifyAlertRead();
  }, [alerts]);

  const retry = useCallback(() => refreshFires(), []);

  return {
    alerts,
    loading: state.status === 'loading',
    error: state.status === 'error',
    hasLocations: locations.length > 0,
    markRead,
    markAllRead,
    retry,
  };
}

// ---------------------------------------------------------------------------
// Enrichment hooks — the backend serves weather/air data per fire group via
// /fires; there is no standalone endpoint yet, so these return nothing rather
// than inventing values. Consumers already render '—' for missing data.
// ---------------------------------------------------------------------------

export function useWeather(): { data: Weather | undefined; loading: boolean } {
  return { data: undefined, loading: false };
}

export function useAirQuality(): {
  data: { pm25: number; aqi: number; label: string } | undefined;
  loading: boolean;
} {
  return { data: undefined, loading: false };
}

export function useAirEvents(): { data: AirEvent[]; loading: boolean } {
  return { data: [], loading: false };
}

export function useIncidents(): { data: Incident[]; loading: boolean } {
  return { data: [], loading: false };
}
