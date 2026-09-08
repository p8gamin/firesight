import type { GeoPoint } from '../types';

/**
 * A request to centre the map on something when it next gains focus.
 *
 * Screens like Alerts call `requestMapFocus(...)` right before navigating to
 * /map. MapScreen consumes the request in a `useFocusEffect`, so it works
 * whether the map is freshly pushed or already mounted in the stack — the
 * URL/params never have to round-trip.
 */
export interface MapFocus {
  /** Focus a specific fire marker (selects it + opens its card). */
  fireId?: string;
  /** Fallback: centre on a plain coordinate (no marker). */
  point?: GeoPoint;
  /** Optional human label, e.g. the saved-location name. */
  label?: string;
}

let pending: MapFocus | null = null;

export function requestMapFocus(focus: MapFocus): void {
  pending = focus;
}

export function consumeMapFocus(): MapFocus | null {
  const f = pending;
  pending = null;
  return f;
}