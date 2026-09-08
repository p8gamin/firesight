/**
 * Geocoding — free, keyless address search via OpenStreetMap's Nominatim.
 *
 * No API key, no billing, no Google. Nominatim's usage policy requires a
 * meaningfully-identified request: browsers send Referer automatically;
 * native calls send an explicit User-Agent. Results are cached per query and
 * lightly debounced by the caller (the Add-Location flow debounces 450 ms).
 *
 * https://operations.osmfoundation.org/policies/nominatim/
 */
import { isWeb } from '../design/platform';
import type { Place } from '../map/gazetteer';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEOUT_MS = 12_000;
const APP_USER_AGENT = 'FireSight/1.0 (wildfire monitoring demo)';

export interface GeocodeResult {
  placeId?: number | string;
  /** Primary label, e.g. "Eiffel Tower". */
  name: string;
  /** Everything after the primary label, e.g. "Paris, Île-de-France, France". */
  area: string;
  lat: number;
  lon: number;
}

interface NominatimPlace {
  place_id?: number | string;
  display_name?: string;
  name?: string;
  lat?: string | number;
  lon?: string | number;
}

/** Split an OSM display_name into (primary label, qualifier). */
function splitLabel(displayName: string): { name: string; area: string } {
  const commaIndex = displayName.indexOf(',');
  if (commaIndex === -1) return { name: displayName.trim(), area: '' };
  return {
    name: displayName.slice(0, commaIndex).trim() || displayName.trim(),
    area: displayName.slice(commaIndex + 1).trim(),
  };
}

/**
 * Resolve free-text addresses into candidate places with real coordinates.
 * Returns [] when nothing matched; throws on network failure so callers can
 * show their fallback UI.
 */
export async function geocodeQuery(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url =
    `${NOMINATIM_URL}?format=jsonv2&limit=5&addressdetails=0` +
    `&q=${encodeURIComponent(q)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!isWeb) headers['User-Agent'] = APP_USER_AGENT; // browsers set Referer themselves

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
    const json = (await res.json()) as NominatimPlace[];
    if (!Array.isArray(json)) return [];
    return json.flatMap((raw) => {
      const lat = typeof raw.lat === 'string' ? Number(raw.lat) : raw.lat;
      const lon = typeof raw.lon === 'string' ? Number(raw.lon) : raw.lon;
      const displayName = raw.display_name ?? raw.name;
      if (
        typeof lat !== 'number' || !Number.isFinite(lat) ||
        typeof lon !== 'number' || !Number.isFinite(lon) ||
        typeof displayName !== 'string' || displayName.length === 0
      ) {
        return [];
      }
      const { name, area } = splitLabel(displayName);
      return [
        {
          id: `osm-${raw.place_id ?? `${lat},${lon}`}`,
          name,
          area,
          kind: 'city' as const,
          lat,
          lon,
        },
      ];
    });
  } catch (e) {
    if (__DEV__) {
      console.warn(
        '[FireSight] Address search failed —',
        e instanceof Error ? e.message : e,
        '· (Nominatim / OpenStreetMap — no key required)'
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
