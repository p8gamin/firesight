/**
 * Supabase data layer for the `saved_locations` table.
 *
 * The table (created in the Supabase dashboard, RLS enabled — owner-only
 * select/insert/update/delete):
 *
 *   id          uuid primary key
 *   user_id     uuid  → auth.users(id)
 *   name        text
 *   latitude    double precision
 *   longitude   double precision
 *   created_at  timestamptz
 *
 * Row Level Security does the authorization: every query here runs with the
 * signed-in user's JWT (picked up automatically by the shared client in
 * ./supabase.ts), so a user can only ever read/modify their own rows.
 *
 * Authorization is all RLS does: it never fills in columns. `user_id` is
 * NOT NULL, so `createSavedLocation` reads the authenticated user from the
 * session and writes `user_id: user.id` explicitly (matching the
 * `auth.uid()` the WITH CHECK policy validates against).
 *
 * The table stores the location's identity (name + coordinates). Everything
 * else the FireSight UI tracks per location (monitoring radius, monitor and
 * alert toggles) has no column in the schema, so it lives in the app layer
 * (see toLocation) — persisted client-side by the store, never sent to
 * Postgres.
 */
import type { GeoPoint, Location, LocationKind } from '../types';
import { supabase } from './supabase';

/** Name of the existing table in the Supabase (public) schema. */
export const SAVED_LOCATIONS_TABLE = 'saved_locations';

/** How the app's Location fields map onto the table's columns. */
export interface SavedLocationInsert {
  name: string;
  latitude: number;
  longitude: number;
}

/** Raw row shape as it comes back from PostgREST. */
interface SavedLocationRow {
  id: string;
  user_id: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
}

/** Human, actionable copy for a failed query (network, auth, RLS…). */
export function describeLocationsError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';
  const m = raw.toLowerCase();
  if (m.includes('failed to fetch') || m.includes('network request failed'))
    return 'Network error — check your connection and try again.';
  if (m.includes('jwt') || m.includes('session') || m.includes('auth'))
    return 'Your session expired — sign in again to sync your locations.';
  if (m.includes('permission denied'))
    // Postgres grant-level denial (42501): the table exists but the
    // authenticated role has no privileges on it — a dashboard/SQL fix, not
    // an RLS filter (an RLS-filtered read returns an empty list, no error).
    return 'Access to saved locations is blocked by database permissions. ' +
      'If you operate this project, grant SELECT/INSERT/UPDATE/DELETE on ' +
      'saved_locations to the authenticated role in the Supabase SQL editor.';
  if (m.includes('row-level security'))
    return 'You do not have access to these locations.';
  if (m.includes('duplicate key'))
    return 'That location is already saved.';
  if (m.includes('violates') || m.includes('invalid input'))
    return 'This location could not be saved — check its details.';
  return raw || 'Something went wrong. Please try again.';
}

/**
 * Build the app's `Location` from a table row.
 *
 * Fields without a database column (radius/monitor/alert preferences) get
 * sensible defaults here; the store layers the user's client-side choices on
 * top. `id` is the row's uuid, so the app's `Location.id` doubles as the
 * primary key for update/delete.
 */
export function toLocation(row: SavedLocationRow, overrides?: Partial<Location>): Location {
  const lat = typeof row.latitude === 'number' && Number.isFinite(row.latitude) ? row.latitude : 0;
  const lon = typeof row.longitude === 'number' && Number.isFinite(row.longitude) ? row.longitude : 0;
  return {
    id: row.id, // uuid from the table — used for UPDATE/DELETE … eq('id')
    name: row.name?.trim() || 'Saved place',
    kind: 'custom' as LocationKind,
    point: { lat, lon } as GeoPoint,
    placeLabel: '',
    radiusKm: 25,
    alertsEnabled: true,
    monitors: { fires: true, heat: true, air: true },
    alertPrefs: {
      highConcern: true,
      moderate: true,
      newDetections: true,
      heatAnomalies: false,
      airQuality: false,
    },
    ...overrides,
  };
}

/** Fetch the signed-in user's saved locations, oldest first (stable order). */
export async function fetchSavedLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from(SAVED_LOCATIONS_TABLE)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as SavedLocationRow[];
  const byId = new Map<string, Partial<Location>>();
  // Client-side preferences survive reloads (they are not columns in the
  // table): keyed by the row uuid, merged back in by the store's hydrate.
  return rows.map((row) => toLocation(row, byId.get(row.id)));
}

/** Insert a row for the authenticated user; returns the saved Location. */
export async function createSavedLocation(draft: {
  name: string;
  point: GeoPoint;
}): Promise<Location> {
  // RLS authorizes the insert but does not populate columns, and user_id is
  // NOT NULL — the authenticated user's id must be included explicitly.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    throw new Error(
      'You must be signed in to save a location. Please sign in and try again.'
    );
  }

  const { data, error } = await supabase
    .from(SAVED_LOCATIONS_TABLE)
    .insert({
      user_id: user.id, // authenticated user from the shared client's session
      name: draft.name,
      latitude: draft.point.lat,
      longitude: draft.point.lon,
    })
    .select('*')
    .single();

  if (error) throw error;
  return toLocation(data as SavedLocationRow);
}

/** Rename a saved location (the only mutable column in the schema). */
export async function renameSavedLocation(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from(SAVED_LOCATIONS_TABLE)
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

/** Delete a saved location by row id. RLS scopes the delete to the owner. */
export async function deleteSavedLocation(id: string): Promise<void> {
  const { error } = await supabase
    .from(SAVED_LOCATIONS_TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
}
