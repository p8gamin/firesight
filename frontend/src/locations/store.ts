/**
 * Saved-locations store — now backed by the Supabase `saved_locations` table.
 *
 * The module-level external store (useSyncExternalStore) is kept exactly as
 * before so every screen (list, detail, add/edit flow, map, alerts) sees the
 * same locations with no context provider and no navigation changes.
 *
 * What changed under the hood:
 * - Source of truth is the Supabase table (src/lib/locationsApi.ts). The
 *   signed-in user's session scopes every read/write via RLS, so a user only
 *   ever sees their own rows.
 * - The store listens to auth state: on sign-in it fetches the user's rows;
 *   on sign-out it clears the in-memory list (no data leaks between
 *   accounts). Email/password and Google OAuth both flow through the same
 *   Supabase session, so both sign-in paths load the same data.
 * - Mutations are optimistic: the UI updates immediately, the write goes to
 *   Supabase in the background, and a failure rolls the change back and
 *   surfaces an error (returned to the caller and/or shown by the screen).
 * - Fields the UI tracks that have no column in the table (monitoring radius,
 *   monitor/alert toggles, display label) persist locally as preferences
 *   keyed by the row's uuid — device convenience only, never sent to
 *   Postgres.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Location } from '../types';
import { supabase } from '../lib/supabase';
import {
  createSavedLocation,
  deleteSavedLocation,
  fetchSavedLocations,
  renameSavedLocation,
  describeLocationsError,
} from '../lib/locationsApi';

/** Where UI-only per-location preferences persist (device-local). */
const PREFS_KEY = 'firesight.locationPrefs.v1';

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

/** UI-only fields layered on top of a table row. */
interface LocationExtras {
  kind: Location['kind'];
  placeLabel: string;
  radiusKm: number;
  alertsEnabled: boolean;
  monitors: Location['monitors'];
  alertPrefs: Location['alertPrefs'];
}

type Phase = 'idle' | 'loading' | 'ready' | 'error';

interface LocationsState {
  locations: Location[];
  phase: Phase;
  /** Human-readable load/mutation failure for the screen to render. */
  error: string | null;
}

let state: LocationsState = { locations: [], phase: 'idle', error: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<LocationsState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/** Subscribe to location changes (also used by the fire-data store). */
export function subscribeToLocations(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Current locations snapshot without a hook (also used by the fire store). */
export function getLocationsSnapshot(): Location[] {
  return state.locations;
}

function getSnapshot(): Location[] {
  return state.locations;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ---------------------------------------------------------------------------
// UI-only preference persistence (radius/monitor/alert toggles, labels)
// ---------------------------------------------------------------------------

let extras: Record<string, LocationExtras> = {};

function persistExtras(): void {
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify(extras)).catch(() => {
    // Best-effort: losing a toggle preference must never break the list.
  });
}

function loadExtras(): Promise<void> {
  return AsyncStorage.getItem(PREFS_KEY)
    .then((raw) => {
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          extras = parsed as Record<string, LocationExtras>;
        }
      } catch {
        // Corrupt cache — defaults apply.
      }
    })
    .catch(() => undefined);
}

/** Merge a row with the device-side preferences for that row id. */
function withExtras(loc: Location): Location {
  const extra = extras[loc.id];
  if (!extra) return loc;
  return {
    ...loc,
    kind: extra.kind ?? loc.kind,
    placeLabel: extra.placeLabel ?? loc.placeLabel,
    radiusKm: extra.radiusKm && extra.radiusKm > 0 ? extra.radiusKm : loc.radiusKm,
    alertsEnabled: extra.alertsEnabled ?? loc.alertsEnabled,
    monitors: extra.monitors ?? loc.monitors,
    alertPrefs: extra.alertPrefs ?? loc.alertPrefs,
  };
}

function rememberExtras(loc: Location): void {
  extras[loc.id] = {
    kind: loc.kind,
    placeLabel: loc.placeLabel,
    radiusKm: loc.radiusKm,
    alertsEnabled: loc.alertsEnabled,
    monitors: loc.monitors,
    alertPrefs: loc.alertPrefs,
  };
  persistExtras();
}

// ---------------------------------------------------------------------------
// Remote sync (auth-driven)
// ---------------------------------------------------------------------------

let loadedForUser: string | null = null;

/** Fetch the signed-in user's saved locations and publish them. */
async function loadForUser(userId: string): Promise<void> {
  if (loadedForUser === userId) return;
  loadedForUser = userId;
  setState({ phase: 'loading', error: null });
  try {
    await loadExtras();
    const rows = await fetchSavedLocations();
    // Ignore if the user signed out (or switched) while the request ran.
    if (loadedForUser !== userId) return;
    setState({ locations: rows.map(withExtras), phase: 'ready', error: null });
  } catch (e) {
    if (loadedForUser !== userId) return;
    setState({
      phase: 'error',
      error: describeLocationsError(e),
      locations: [],
    });
  }
}

/** Reset all state (sign-out or account switch). */
function reset(): void {
  loadedForUser = null;
  setState({ locations: [], phase: 'idle', error: null });
}

// Drive the store from the Supabase session. Email/password and Google OAuth
// both end in the same session, so this covers every sign-in path.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    reset();
    return;
  }
  if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
    void loadForUser(session.user.id);
  }
});

// Retry a failed initial load whenever connectivity/auth comes back.
export function retryLoadLocations(): void {
  loadedForUser = null;
  void supabase.auth
    .getSession()
    .then(({ data }) => {
      if (data.session?.user) void loadForUser(data.session.user.id);
      else reset();
    })
    .catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Mutations — optimistic, with rollback on failure
// ---------------------------------------------------------------------------

function tempId(): string {
  return `temp-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

/**
 * Add a location: optimistic card immediately, then INSERT into
 * saved_locations with the authenticated user's id (read from the session
 * in locationsApi — RLS authorizes but never fills the user_id column).
 * Resolves with the saved Location; rejects with a human-readable message
 * so the caller (add/edit modal) can show it.
 */
export async function addLocation(draft: LocationDraft): Promise<Location> {
  const optimistic: Location = { id: tempId(), ...draft };
  setState({ locations: [...state.locations, optimistic] });
  try {
    const saved = await createSavedLocation({ name: draft.name, point: draft.point });
    rememberExtras({ ...saved, ...draft, id: saved.id });
    const withPrefs = withExtras({ ...saved });
    setState({
      locations: state.locations.map((l) => (l.id === optimistic.id ? withPrefs : l)),
    });
    return withPrefs;
  } catch (e) {
    // Roll the optimistic card back — the caller shows the error.
    setState({ locations: state.locations.filter((l) => l.id !== optimistic.id) });
    throw new Error(describeLocationsError(e));
  }
}

/**
 * Edit a location. `name` is the only field with a database column, so only
 * it triggers a network write; everything else updates the device-side
 * preference for that row. Resolves when any network write completes;
 * rejects with a readable message after rolling back.
 */
export async function updateLocation(
  id: string,
  patch: Partial<LocationDraft>
): Promise<void> {
  const prev = state.locations;
  setState({
    locations: prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  });
  const updated = state.locations.find((l) => l.id === id);
  if (updated) rememberExtras(updated);

  if (patch.name === undefined) return;
  try {
    await renameSavedLocation(id, patch.name);
  } catch (e) {
    setState({ locations: prev }); // roll back
    if (updated) rememberExtras(prev.find((l) => l.id === id) ?? updated);
    throw new Error(describeLocationsError(e));
  }
}

/**
 * Remove a location: the card disappears immediately; DELETE (scoped to the
 * owner by RLS) runs behind it. Rolls back and rejects on failure.
 */
export async function removeLocation(id: string): Promise<void> {
  // Never attempt a delete for an optimistic row that never reached the
  // database (its create failed and the rollback lost the race).
  if (id.startsWith('temp-')) {
    setState({ locations: state.locations.filter((l) => l.id !== id) });
    return;
  }
  const prev = state.locations;
  setState({ locations: prev.filter((l) => l.id !== id) });
  const { [id]: removedPrefs, ...restExtras } = extras;
  extras = restExtras;
  persistExtras();
  try {
    await deleteSavedLocation(id);
  } catch (e) {
    setState({ locations: prev });
    if (removedPrefs) {
      extras = { ...extras, [id]: removedPrefs };
      persistExtras();
    }
    throw new Error(describeLocationsError(e));
  }
}

// ---------------------------------------------------------------------------
// Hook — same shape as before (locations + loading), plus error/retry
// ---------------------------------------------------------------------------

export function useLocationsStore(): {
  locations: Location[];
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    locations: snapshot,
    loading: state.phase === 'idle' || state.phase === 'loading',
    error: state.error,
    retry: retryLoadLocations,
  };
}
