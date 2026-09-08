/**
 * Saved-locations store.
 *
 * Module-level state exposed through useSyncExternalStore so every screen
 * (list, detail, add/edit flow, the map) sees the same locations without a
 * context provider.
 *
 * Persistence: the list is saved to AsyncStorage on every mutation and
 * re-hydrated on startup, so user-created locations survive reloads and app
 * restarts. The store starts EMPTY — no sample locations; everything on the
 * map comes from what the user actually creates.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GeoPoint, Location } from '../types';

const STORAGE_KEY = 'firesight.locations.v1';

export interface LocationDraft {
  name: string;
  kind: Location['kind'];
  point: Location['point'];
  placeLabel: string;
  radiusKm: number;
  alertsEnabled: boolean;
  monitors: Location['monitors'];
  alertPrefs: Location['alertPrefs'];
}

let locations: Location[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Subscribe to location changes (also used by the fire-data store). */
export function subscribeToLocations(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Current locations snapshot without a hook (also used by the fire store). */
export function getLocationsSnapshot(): Location[] {
  return locations;
}

function getSnapshot(): Location[] {
  return locations;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function nextId(): string {
  return `loc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function persist(): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(locations)).catch(() => {
    // Storage is best-effort; the in-memory store stays authoritative.
  });
}

/** Defensive parse — a bad record is dropped rather than breaking the screen. */
function parseLocation(raw: unknown): Location | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const point = r.point as Record<string, unknown> | null | undefined;
  const lat = typeof point?.lat === 'number' && Number.isFinite(point.lat) ? point.lat : null;
  const lon = typeof point?.lon === 'number' && Number.isFinite(point.lon) ? point.lon : null;
  if (lat === null || lon === null) return null;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;
  const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.length > 0 ? v : fallback;
  return {
    id: r.id,
    name: str(r.name, 'Saved place'),
    kind: (r.kind === 'home' || r.kind === 'school' || r.kind === 'family' ? r.kind : 'custom') as Location['kind'],
    point: { lat, lon } as GeoPoint,
    placeLabel: str(r.placeLabel, ''),
    radiusKm: typeof r.radiusKm === 'number' && r.radiusKm > 0 ? r.radiusKm : 25,
    alertsEnabled: r.alertsEnabled !== false,
    monitors: {
      fires: (r.monitors as Record<string, unknown> | undefined)?.fires !== false,
      heat: (r.monitors as Record<string, unknown> | undefined)?.heat !== false,
      air: (r.monitors as Record<string, unknown> | undefined)?.air !== false,
    },
    alertPrefs: {
      highConcern: true,
      moderate: true,
      newDetections: true,
      heatAnomalies: false,
      airQuality: false,
      ...(r.alertPrefs as Partial<Location['alertPrefs']> | undefined),
    },
  };
}

//
// Legacy-data purge.
//
// Before the app went empty-by-default it shipped seeded sample locations
// ("Home", "School", "Mom's House", "Weekend Cabin" — one pinned to the old
// backend default at 43.7001, -79.4163). Those records may still sit in a
// user's persisted storage; on hydration they are detected and dropped so
// the app truly starts from nothing the user created. One-time, then the
// storage key is rewritten clean.
//
const LEGACY_SEED_NAMES = new Set(['home', 'school', "mom's house", 'weekend cabin']);
const LEGACY_DEFAULT_POINT = { lat: 43.7001, lon: -79.4163 };

function isLegacySeed(loc: Location): boolean {
  if (LEGACY_SEED_NAMES.has(loc.name.trim().toLowerCase())) return true;
  // A record sitting exactly on the old backend default — including one the
  // user renamed — is a leftover, not a real place the user picked.
  return (
    Math.abs(loc.point.lat - LEGACY_DEFAULT_POINT.lat) < 1e-6 &&
    Math.abs(loc.point.lon - LEGACY_DEFAULT_POINT.lon) < 1e-6
  );
}

// Hydrate from storage at startup — stored data is the only source.
let hydrated = false;
void (async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw != null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const parsedList = parsed
          .map(parseLocation)
          .filter((l): l is Location => l !== null);
        const kept = parsedList.filter((l) => !isLegacySeed(l));
        if (kept.length !== parsedList.length) {
          // Purge legacy seeds and rewrite storage so the cleanup sticks.
          locations = kept;
          persist();
        } else {
          locations = parsedList;
        }
        emit();
      }
    }
  } catch {
    // Corrupt or unavailable storage — start empty.
  } finally {
    hydrated = true;
    emit();
  }
})();

export function addLocation(draft: LocationDraft): Location {
  const loc: Location = { id: nextId(), ...draft };
  locations = [...locations, loc];
  emit();
  persist();
  return loc;
}

export function updateLocation(id: string, patch: Partial<LocationDraft>): void {
  locations = locations.map((l) => (l.id === id ? { ...l, ...patch } : l));
  emit();
  persist();
}

export function removeLocation(id: string): void {
  locations = locations.filter((l) => l.id !== id);
  emit();
  persist();
}

/**
 * Live list of saved locations (adds/updates/removes propagate instantly to
 * every mounted screen — the map included) plus a short loading window while
 * storage hydrates so the list's skeleton state is a real UI path.
 */
export function useLocationsStore(): {
  locations: Location[];
  loading: boolean;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [storageSettled, setStorageSettled] = useState(hydrated);
  const [minLoading, setMinLoading] = useState(true);

  useEffect(() => {
    if (!storageSettled) {
      const poll = setInterval(() => {
        if (hydrated) {
          setStorageSettled(true);
          clearInterval(poll);
        }
      }, 60);
      return () => clearInterval(poll);
    }
  }, [storageSettled]);

  // Simulated fetch latency (once per mount) for the skeleton state.
  useEffect(() => {
    const t = setTimeout(() => setMinLoading(false), 320);
    return () => clearTimeout(t);
  }, []);

  return { locations: snapshot, loading: minLoading || !storageSettled };
}
