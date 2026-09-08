/**
 * Fire-data store — a tiny external store holding the shared /fires request
 * state. Multiple screens (map, fire detail) read the same snapshot instead
 * of issuing duplicate requests.
 *
 * The request is centred on the user's PRIMARY saved location (the first
 * location in the store) — heat anomalies are detected around where the user
 * actually chose to monitor. When the user has no saved locations yet there
 * is nothing to monitor: the store sits `idle` and the map shows the
 * get-started prompt instead of data.
 *
 * Location changes are watched: creating/editing/moving/deleting the primary
 * location automatically re-requests the backend (no page refresh needed).
 */
import { useSyncExternalStore } from 'react';
import type { GeoPoint } from '../types';
import { getFires, type FireActivityGroup } from './fireApi';
import {
  getLocationsSnapshot,
  subscribeToLocations,
} from '../locations/store';

export type FiresStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface FiresState {
  status: FiresStatus;
  groups: FireActivityGroup[];
  /** Coordinates the current data was requested for (null while idle). */
  origin: GeoPoint | null;
  error: string | null;
  syncedAt: string | null;
}

let state: FiresState = {
  status: 'idle',
  groups: [],
  origin: null,
  error: null,
  syncedAt: null,
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

/** The user's primary monitoring location (their first saved location). */
function primaryLocationPoint(): GeoPoint | null {
  const first = getLocationsSnapshot()[0];
  return first ? { ...first.point } : null;
}

const keyOf = (p: GeoPoint): string => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;

let lastRequestedKey: string | null = null;
let requestSeq = 0;

async function run(origin: GeoPoint): Promise<void> {
  const seq = ++requestSeq;
  setState({ status: 'loading', error: null });
  try {
    const groups = await getFires(origin.lat, origin.lon);
    if (seq !== requestSeq) return; // a newer request superseded this one
    setState({
      status: 'ready',
      groups,
      origin,
      error: null,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (seq !== requestSeq) return;
    const message = error instanceof Error ? error.message : 'Heat data is unavailable.';
    if (__DEV__) console.warn('[FireSight] Heat data request failed:', message);
    setState({ status: 'error', error: message, origin });
  }
}

function load(force = false): void {
  const origin = primaryLocationPoint();
  if (!origin) {
    // No saved locations → nothing to monitor; the map shows the prompt.
    requestSeq++;
    lastRequestedKey = null;
    setState({ status: 'idle', groups: [], origin: null, error: null });
    return;
  }
  const key = keyOf(origin);
  if (!force && key === lastRequestedKey && state.status !== 'error') return;
  lastRequestedKey = key;
  void run(origin);
}

// Re-request automatically whenever the saved locations change (create,
// edit, move, delete) so the map always reflects the user's choices.
subscribeToLocations(() => load());

/** Kick off the load once; safe to call from any screen effect. */
export function ensureFiresLoaded(): void {
  load();
}

/** Manual retry — forces a fresh request for the current primary location. */
export function refreshFires(): void {
  load(true);
}
