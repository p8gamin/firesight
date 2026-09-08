/**
 * Map data access. The Map screen reads every record through this module.
 *
 * All data is LIVE: wildfire/heat activity comes from the FireSight backend
 * (src/services) — requested around the user's primary saved location. There
 * is no sample fallback: with no backend response the map simply shows no
 * markers (plus the retry banner), and with no saved locations the store
 * stays idle and the map shows the get-started prompt.
 */
import { useEffect, useMemo } from 'react';
import { adaptFireGroups } from '../services/fireAdapter';
import {
  ensureFiresLoaded,
  refreshFires,
  useFiresState,
} from '../services/fireStore';
import type { FirePerimeter, MapFire, MapHeatRegion } from '../types';

export interface MapData {
  fires: MapFire[];
  heatRegions: MapHeatRegion[];
  /** The backend serves incident details, not perimeter geometry (yet). */
  perimeters: FirePerimeter[];
  /** Timestamp of the last successful backend sync. */
  syncedAt?: string;
  /** True while the live request is in flight. */
  loading: boolean;
  /** Set when the live request failed. */
  error: string | null;
  /** Force a fresh request for the current primary location. */
  refresh: () => void;
}

export function useMapData(): MapData {
  const state = useFiresState();

  // Kick off the load on first use (no-op while the user has no saved
  // locations — the map shows the get-started prompt instead).
  useEffect(() => {
    ensureFiresLoaded();
  }, []);

  const live = state.status === 'ready';
  const adapted = useMemo(
    () => (live ? adaptFireGroups(state.groups) : null),
    [live, state.groups]
  );

  return useMemo(() => {
    if (adapted) {
      return {
        fires: adapted.fires,
        heatRegions: adapted.heatRegions,
        perimeters: [] as FirePerimeter[],
        syncedAt: state.syncedAt ?? undefined,
        loading: false,
        error: null,
        refresh: refreshFires,
      };
    }
    return {
      fires: [],
      heatRegions: [],
      perimeters: [] as FirePerimeter[],
      syncedAt: undefined,
      loading: state.status === 'loading',
      error: state.status === 'error' ? state.error : null,
      refresh: refreshFires,
    };
  }, [adapted, state.status, state.error, state.syncedAt]);
}

/**
 * Resolve one fire by id for the detail screen (live data only).
 */
export function useFireById(id: string): { fire: MapFire | null; loading: boolean } {
  const state = useFiresState();

  useEffect(() => {
    ensureFiresLoaded();
  }, []);

  return useMemo(() => {
    if (state.status === 'loading') return { fire: null, loading: true };
    if (state.status === 'ready') {
      const adapted = adaptFireGroups(state.groups);
      const fire = adapted.fires.find((f) => f.id === id) ?? null;
      return { fire, loading: false };
    }
    return { fire: null, loading: false };
  }, [id, state.status, state.groups]);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** e.g. "Sep 5 · 2:14 PM" — device-local, dependency-free. */
export function formatDetected(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${MONTHS[d.getMonth()]} ${d.getDate()} · ${hh}:${m} ${ampm}`;
}
