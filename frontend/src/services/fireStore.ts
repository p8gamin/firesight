/**
 * Fire-data store — a tiny external store holding the shared /fires request
 * state. Multiple screens (map, fire detail, alerts, locations) read the same
 * snapshot instead of issuing duplicate requests.
 *
 * Per-location fetching: wildfire data is requested for EVERY saved location
 * (the backend's /fires endpoint is centred on one point; each location gets
 * its own request and the merged, de-duplicated results are published). With
 * no saved locations there is nothing to monitor: the store sits `idle` and
 * the map shows the get-started prompt — no requests are made.
 *
 * Lifecycle (driven by the Supabase session via the locations store):
 * - Sign-in / session restore → saved_locations rows load → the locations
 *   subscription fires → each location's fire data is requested (staggered).
 * - Data younger than FIRE_DATA_MAX_AGE_MS is reused; only stale locations
 *   are re-requested (e.g. when reopening the app or re-mounting screens).
 * - A fixed interval (FIRE_DATA_REFRESH_MS, 15 min) refreshes every location
 *   while the app is open — never a tight polling loop. The interval runs at
 *   module level, so it keeps working on any tab/screen, not just the map.
 * - Returning to the app / tab (AppState 'active') catches up immediately if
 *   the data went stale while the user was away or the tab was hidden.
 * - Adding/editing/removing a location re-syncs immediately (new or moved
 *   points fetch right away; removals drop their results).
 * - Sign-out clears everything back to idle (no cross-account leakage).
 *
 * Resilience: requests are staggered, failures back off before retrying,
 * already-fetched data stays visible while a refresh runs (stale-while-
 * revalidate) and after a failed refresh, and an empty backend result is a
 * normal `ready` state (the UI shows "no activity"). All fire intelligence
 * (FIRMS grouping, weather/AQI, FRP, concern scoring) stays in the FastAPI
 * backend — this store only calls /fires.
 */
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { GeoPoint } from '../types';
import { getFires, type FireActivityGroup } from './fireApi';
import { supabase } from '../lib/supabase';
import {
  getLocationsSnapshot,
  subscribeToLocations,
} from '../locations/store';

/** Epoch ms of the last completed force-sync (interval/foreground catch-up). */
let lastSyncAt = 0;

/** Fixed refresh cadence while the app is open (15 minutes). */
export const FIRE_DATA_REFRESH_MS = 15 * 60 * 1000;

/** Data younger than this is reused instead of re-requested. */
const FIRE_DATA_MAX_AGE_MS = FIRE_DATA_REFRESH_MS;

/** Delay before a failed location request may be retried automatically. */
const RETRY_DELAY_MS = 60 * 1000;

/** Stagger between the first requests of different locations (politeness). */
const STAGGER_MS = 500;

export type FiresStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface FiresState {
  status: FiresStatus;
  groups: FireActivityGroup[];
  /** The primary (first) saved location's point; null while idle. */
  origin: GeoPoint | null;
  /** Aggregate error (shown when nothing could be fetched at all). */
  error: string | null;
  /** Latest successful sync across locations. */
  syncedAt: string | null;
  /** True while ANY location's /fires request is in flight (initial load,
   *  interval refresh, foreground catch-up, or a newly added location). */
  syncing: boolean;
}

/** Per-location fetch bookkeeping (internal to the store). */
type EntryStatus = 'pending' | 'loading' | 'ready' | 'error';

interface LocationEntry {
  point: GeoPoint;
  status: EntryStatus;
  error: string | null;
  /** ISO time of the last successful fetch (null until one succeeds). */
  fetchedAt: string | null;
  /** Epoch ms before which an automatic retry is skipped (backoff). */
  nextAttemptAt: number | null;
}

let state: FiresState = {
  status: 'idle',
  groups: [],
  origin: null,
  error: null,
  syncedAt: null,
  syncing: false,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<FiresState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFiresState(): FiresState {
  return state;
}

/** Reactive snapshot of the shared fire-data state. */
export function useFiresState(): FiresState {
  return useSyncExternalStore(subscribe, getFiresState, getFiresState);
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** location id → latest successful /fires result for that location. */
const groupsByLocation = new Map<string, FireActivityGroup[]>();
/** location id → fetch bookkeeping. */
const entries = new Map<string, LocationEntry>();
/** Guards against superseded responses (edit/remove/refresh races). */
const runTokens = new Map<string, number>();

const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const keyOf = (p: GeoPoint): string => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;

function schedule(fn: () => void, ms: number): void {
  const t = setTimeout(() => {
    pendingTimers.delete(t);
    fn();
  }, ms);
  pendingTimers.add(t);
}

function setEntry(locationId: string, patch: Partial<LocationEntry>): void {
  const current = entries.get(locationId);
  const base: LocationEntry = current ?? {
    point: { lat: 0, lon: 0 },
    status: 'pending',
    error: null,
    fetchedAt: null,
    nextAttemptAt: null,
  };
  entries.set(locationId, { ...base, ...patch });
}

/** Merge every location's groups, de-duplicating shared detections. */
function mergeGroups(): FireActivityGroup[] {
  const best = new Map<string, FireActivityGroup>();
  for (const groups of groupsByLocation.values()) {
    for (const g of groups) {
      // Same ~100 m cell the adapter uses for ids → one marker per fire.
      const key = `${g.latitude.toFixed(3)},${g.longitude.toFixed(3)}`;
      const prev = best.get(key);
      if (
        !prev ||
        g.concern_score > prev.concern_score ||
        (g.concern_score === prev.concern_score && g.detections > prev.detections)
      ) {
        best.set(key, g);
      }
    }
  }
  return [...best.values()];
}

function isFresh(entry: LocationEntry | undefined, now: number): boolean {
  return (
    !!entry &&
    entry.status === 'ready' &&
    entry.fetchedAt !== null &&
    now - new Date(entry.fetchedAt).getTime() < FIRE_DATA_MAX_AGE_MS
  );
}

/** Recompute the published snapshot from the per-location bookkeeping. */
function recompute(): void {
  const locations = getLocationsSnapshot();
  if (locations.length === 0) return; // reset() owns the idle state

  const all = [...entries.values()];
  const merged = mergeGroups();
  const anyPending = all.some((e) => e.status === 'pending' || e.status === 'loading');
  const anyData = merged.length > 0 || all.some((e) => e.status === 'ready');
  const allErrored = all.length > 0 && all.every((e) => e.status === 'error') && !anyData;

  let status: FiresStatus;
  if (anyPending && !anyData) status = 'loading';
  else if (allErrored) status = 'error';
  else status = 'ready';

  let syncedAt: string | null = null;
  for (const e of all) {
    if (e.fetchedAt && (!syncedAt || e.fetchedAt > syncedAt)) syncedAt = e.fetchedAt;
  }

  const firstError = all.find((e) => e.error)?.error ?? null;

  setState({
    status,
    groups: merged,
    origin: locations[0] ? { ...locations[0].point } : null,
    error: status === 'error' ? firstError ?? 'Heat data is unavailable.' : null,
    syncedAt,
    // Any in-flight /fires request (initial load, refresh, catch-up) — the
    // global "retrieving live heat data" indicator reads this.
    syncing: anyPending,
  });
}

/** One /fires request for one location, with race + backoff handling. */
async function fetchLocation(locationId: string, point: GeoPoint): Promise<void> {
  const token = (runTokens.get(locationId) ?? 0) + 1;
  runTokens.set(locationId, token);

  setEntry(locationId, { status: 'loading', error: null, nextAttemptAt: null });
  recompute();

  try {
    const groups = await getFires(point.lat, point.lon);
    if (runTokens.get(locationId) !== token) return; // superseded
    groupsByLocation.set(locationId, groups);
    setEntry(locationId, {
      status: 'ready',
      error: null,
      fetchedAt: new Date().toISOString(),
      nextAttemptAt: null,
    });
  } catch (error) {
    if (runTokens.get(locationId) !== token) return; // superseded
    const message =
      error instanceof Error ? error.message : 'Heat data is unavailable.';
    if (__DEV__) console.warn('[FireSight] Heat data request failed:', message);
    // Keep any previously fetched groups (stale-while-error) and back off.
    setEntry(locationId, {
      status: 'error',
      error: message,
      nextAttemptAt: Date.now() + RETRY_DELAY_MS,
    });
  }
  recompute();
}

/**
 * Bring every saved location's fire data up to date.
 * - Fresh entries (fetched within FIRE_DATA_MAX_AGE_MS) are reused.
 * - Errored entries back off for RETRY_DELAY_MS (unless force).
 * - New/moved locations always fetch.
 * - Locations the user deleted (or that vanished in an account switch) have
 *   their entries and cached results pruned, so their markers never linger
 *   in the merged snapshot.
 */
function sync(force = false): void {
  const locations = getLocationsSnapshot();
  if (locations.length === 0) {
    resetData();
    return;
  }

  // Prune bookkeeping + cached results for locations that no longer exist.
  const currentIds = new Set(locations.map((l) => l.id));
  for (const id of [...entries.keys()]) {
    if (!currentIds.has(id)) {
      entries.delete(id);
      groupsByLocation.delete(id);
      runTokens.delete(id); // invalidates any in-flight request's token
    }
  }

  if (!refreshInterval) {
    refreshInterval = setInterval(() => {
      // Hidden-tab throttling (browsers) and native backgrounding can delay
      // or coalesce timer ticks. Skip this tick if a tick just ran (< 1 min
      // ago, e.g. the foreground catch-up), so requests never double up.
      if (Date.now() - lastSyncAt < 60 * 1000) return;
      sync(true);
    }, FIRE_DATA_REFRESH_MS);
  }

  const now = Date.now();
  let stagger = 0;
  for (const loc of locations) {
    const entry = entries.get(loc.id);
    const moved = !entry || keyOf(entry.point) !== keyOf(loc.point);

    if (!force && !moved && isFresh(entry, now)) continue;
    if (!force && !moved && entry?.nextAttemptAt && now < entry.nextAttemptAt) continue;
    if (entry?.status === 'loading' || entry?.status === 'pending') continue; // already in flight

    // Reserve the slot immediately (shows loading; dedupes concurrent syncs).
    setEntry(loc.id, { point: { ...loc.point }, status: 'pending' });
    const start = () => void fetchLocation(loc.id, { ...loc.point });
    if (stagger === 0) start();
    else schedule(start, stagger * STAGGER_MS);
    stagger++;
  }
  recompute();
  lastSyncAt = Date.now();
}

/** Clear everything back to idle (sign-out or no saved locations). */
function resetData(): void {
  for (const t of pendingTimers) clearTimeout(t);
  pendingTimers.clear();
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  groupsByLocation.clear();
  entries.clear();
  runTokens.clear();
  setState({
    status: 'idle',
    groups: [],
    origin: null,
    error: null,
    syncedAt: null,
    syncing: false,
  });
}

// Re-sync automatically whenever the saved locations change (sign-in load,
// create, edit/move, delete) — this is what makes data appear right after
// login and immediately cover a newly added location. Both this listener and
// the locations store's own auth listener are module-level, so the fetch
// chain runs on sign-in/session-restore no matter which screen is open.
subscribeToLocations(() => sync(false));

// Belt-and-suspenders: react to the session itself too. If locations are not
// loaded yet this is a harmless no-op (sync sees an empty list); the real
// trigger remains the locations update above.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') resetData();
  else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') sync(false);
});

// Foreground catch-up: native OSes pause JS timers while backgrounded and
// browsers throttle timers in hidden tabs, so the 15-minute interval alone
// can leave data older than the cadence after time away. When the app/tab
// becomes active again, sync right away — freshness-aware, so only genuinely
// stale locations are re-requested (fresh data = zero requests). Fires on
// web tab switches too (react-native-web maps it to visibilitychange), which
// is exactly the "switched away from/"back to a tab" case.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') return;
  sync(Date.now() - lastSyncAt >= FIRE_DATA_MAX_AGE_MS);
});

/** Kick off a freshness-aware load; safe to call from any screen effect. */
export function ensureFiresLoaded(): void {
  sync(false);
}

/** Manual retry / pull-to-refresh — force a fresh request for every location. */
export function refreshFires(): void {
  sync(true);
}
